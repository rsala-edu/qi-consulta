// Totes les escriptures de dades que se sincronitzen passen per aquí: cada
// desada (o esborrat) escriu el registre amb la seva versió (HLC) i, dins la
// mateixa transacció de Dexie, l'apunta a la cua de canvis pendents de pujar
// (`canvisPropis`) amb un número de seqüència creixent. Així cap canvi no es
// pot quedar fora de la cua, i la sincronia sap exactament què ha de pujar
// (docs/sincronia.md, 8.2).

import type { QiDB, RegistreEsborrat, TaulaSincronitzada } from '../db/esquema'
import { RellotgeHlc, type Hlc } from './hlc'
import { aplanar, desplegar, esPerCamp, obrirRegistre, tancarRegistre, CAMPS_CLARS, type Registre, type TaulaPerCamp, type Versions } from './registres'

interface Rellotge {
  dispositiu: string
  rellotge: RellotgeHlc
}

/** Identificador d'aquesta pestanya: dues pestanyes del mateix dispositiu mai generen el mateix HLC */
const PESTANYA = crypto.randomUUID().slice(0, 4)
const rellotges = new WeakMap<QiDB, Promise<Rellotge>>()

/** El dispositiu (per compte) i el seu rellotge lògic, que continua on era en tornar a obrir */
export function rellotgeDe(db: QiDB): Promise<Rellotge> {
  let r = rellotges.get(db)
  if (!r) {
    r = (async () => {
      let dispositiu = (await db.meta.get('dispositiu'))?.valor as string | undefined
      if (!dispositiu) {
        dispositiu = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        await db.meta.put({ clau: 'dispositiu', valor: dispositiu })
      }
      const ultim = (await db.meta.get('hlc'))?.valor as string | undefined
      return { dispositiu, rellotge: new RellotgeHlc(`${dispositiu}.${PESTANYA}`, ultim ?? null) }
    })()
    rellotges.set(db, r)
  }
  return r
}

/** Apunta a la cua els registres canviats. S'ha de cridar dins una transacció amb canvisPropis i meta. */
export async function encuar(db: QiDB, entrades: readonly { taula: string; clau: string }[], hlc: Hlc): Promise<void> {
  if (entrades.length === 0) return
  const seq = (((await db.meta.get('seq'))?.valor as number | undefined) ?? 0) + entrades.length
  await db.canvisPropis.bulkPut(entrades.map((e, i) => ({ id: `${e.taula}:${e.clau}`, taula: e.taula, clau: e.clau, seq: seq - entrades.length + 1 + i })))
  await db.meta.bulkPut([
    { clau: 'seq', valor: seq },
    { clau: 'hlc', valor: hlc },
  ])
}

const mateix = (a: Registre | undefined, b: Registre | undefined) =>
  a === b || (!!a && !!b && a.hlc === b.hlc && JSON.stringify(a.xifrat ?? a) === JSON.stringify(b.xifrat ?? b))

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export class ErrorEscriptura extends Error {
  constructor() {
    super('No s\'ha pogut desar: el registre canviava contínuament')
    this.name = 'ErrorEscriptura'
  }
}

/**
 * Desa un registre clínic (pacient, fitxa, cita). `base`: les metadades i els
 * camps en clar (id, creatAt, modificatAt, pacientId, inici). `dades`: el que
 * va xifrat. `conegudes`: els camps que aquesta versió coneix; els altres que
 * ja tenia el registre (d'una versió més nova de l'app) es conserven.
 */
export async function desarPerCamp(
  db: QiDB,
  clau: CryptoKey,
  taula: TaulaPerCamp,
  base: Registre & { id: string },
  dades: Record<string, unknown>,
  conegudes?: readonly string[],
): Promise<Registre> {
  const { rellotge } = await rellotgeDe(db)
  const t = db.table(taula)
  for (let intent = 0; intent < 5; intent++) {
    const abans = (await t.get(base.id)) as Registre | undefined
    const obert = abans ? await obrirRegistre(clau, taula, abans) : { camps: {}, versions: {} as Versions }
    const clars = Object.fromEntries(CAMPS_CLARS[taula].filter((c) => base[c] !== undefined).map((c) => [c, base[c]]))
    let completes = dades
    if (conegudes && abans) {
      const anteriors = desplegar(Object.fromEntries(Object.entries(obert.camps).filter(([c]) => !CAMPS_CLARS[taula].includes(c))))
      const desconeguts = Object.fromEntries(Object.entries(anteriors).filter(([k]) => !conegudes.includes(k)))
      completes = { ...desconeguts, ...dades }
    }
    const camps = aplanar({ ...completes, ...clars })
    const canviats = [...new Set([...Object.keys(obert.camps), ...Object.keys(camps)])].filter((c) => !igual(obert.camps[c], camps[c]))
    if (abans && canviats.length === 0) return abans
    const h = rellotge.nou()
    const versions: Versions = { ...obert.versions }
    for (const c of canviats) versions[c] = [h, obert.versions[c]?.[0] ?? null]
    const registre = await tancarRegistre(clau, taula, { ...(abans ?? {}), ...base }, { camps, versions })
    const fet = await db.transaction('rw', [t, db.canvisPropis, db.meta], async () => {
      if (!mateix((await t.get(base.id)) as Registre | undefined, abans)) return false
      await t.put(registre)
      await encuar(db, [{ taula, clau: base.id }], h)
      return true
    })
    if (fet) return registre
  }
  throw new ErrorEscriptura()
}

/** Desa un registre que se sincronitza sencer (calibratge, precaucions, horari…). */
export async function desarSencer(db: QiDB, taula: TaulaSincronitzada, registre: Registre, clau: string): Promise<void> {
  if (esPerCamp(taula)) throw new Error(`${taula} es desa camp a camp`)
  const t = db.table(taula)
  const { hlc: _h, ...sense } = ((await t.get(clau)) as Registre | undefined) ?? {}
  const { hlc: _n, ...nou } = registre
  if (igual(sense, nou)) return
  const { rellotge } = await rellotgeDe(db)
  const h = rellotge.nou()
  await db.transaction('rw', [t, db.canvisPropis, db.meta], async () => {
    await t.put({ ...nou, hlc: h })
    await encuar(db, [{ taula, clau }], h)
  })
}

/** Esborra registres: es treuen i queda la marca d'esborrat (amb HLC) perquè s'esborrin a tot arreu */
export async function esborrarRegistres(db: QiDB, taula: TaulaSincronitzada, claus: readonly string[]): Promise<void> {
  if (claus.length === 0) return
  const { rellotge } = await rellotgeDe(db)
  const h = rellotge.nou()
  const esborratAt = new Date().toISOString()
  const t = db.table(taula)
  await db.transaction('rw', [t, db.esborrats, db.canvisPropis, db.meta], async () => {
    await t.bulkDelete([...claus])
    await db.esborrats.bulkPut(claus.map((clau): RegistreEsborrat => ({ id: `${taula}:${clau}`, taula, clau, esborratAt, hlc: h })))
    await encuar(db, claus.map((clau) => ({ taula, clau })), h)
  })
}

/** Quants registres hi ha a la cua que encara no són a Drive */
export async function pendentsDePujar(db: QiDB): Promise<number> {
  const fins = ((await db.meta.get('pujatFins'))?.valor as number | undefined) ?? 0
  return db.canvisPropis.where('seq').above(fins).count()
}
