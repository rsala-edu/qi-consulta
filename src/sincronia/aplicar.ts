// Aplica a la base de dades local els registres que arriben d'un altre lloc
// (Drive, un fitxer .qi). La regla de seguretat (escenari n, docs/sincronia.md):
// mai es substitueix cap taula; cada registre es fusiona amb el registre local
// tal com és en aquell moment i s'escriu només si, entre la lectura i
// l'escriptura, no ha canviat (si la doctora l'acaba de desar, es torna a
// fusionar). Un canvi local no pot desaparèixer mai.

import type { QiDB, RegistreConflicte, RegistreEsborrat, TaulaSincronitzada } from '../db/esquema'
import { TAULES } from './copia'
import { encuar, rellotgeDe } from './escriptura'
import {
  esPerCamp,
  fusionarCamps,
  fusionarRegistre,
  hlcDeRegistre,
  hlcEsborrat,
  obrirRegistre,
  registreConflicte,
  tancarRegistre,
  viuDespresDe,
  type CampPerdut,
  type Registre,
} from './registres'

export interface EntradaRemota {
  taula: string
  clau: string
  registre?: Registre
  esborrat?: RegistreEsborrat
}

export interface OpcionsAplicar {
  /** Els registres que canviïn s'apunten a la cua (fitxers .qi, fusió amb una altra clau): s'han de pujar */
  encuar?: boolean
}

export interface ResultatAplicar {
  /** Registres del dispositiu que han canviat */
  canviats: number
  /** Conflictes nous per revisar */
  conflictes: number
}

const CONEGUDES = new Set<string>(TAULES.map((t) => t.nom))
const CLAU_TAULA = new Map<string, string>(TAULES.map((t) => [t.nom, t.clau]))

/** La clau primària d'un registre d'una taula coneguda */
export const clauDe = (taula: string, r: Registre) => String(r[CLAU_TAULA.get(taula) ?? 'id'])

const igualJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export async function aplicarRemots(
  db: QiDB,
  clau: CryptoKey,
  entrades: readonly EntradaRemota[],
  opcions: OpcionsAplicar = {},
): Promise<ResultatAplicar> {
  const { rellotge } = await rellotgeDe(db)
  const r: ResultatAplicar = { canviats: 0, conflictes: 0 }
  for (const e of entrades) {
    // El rellotge d'aquest dispositiu avança fins al canvi més nou que ha vist
    rellotge.veure(e.registre ? hlcDeRegistre(e.registre) : e.esborrat ? hlcEsborrat(e.esborrat) : undefined)
    const fet = CONEGUDES.has(e.taula)
      ? await aplicarUn(db, clau, e as EntradaRemota & { taula: TaulaSincronitzada }, opcions)
      : await aplicarDesconegut(db, e)
    r.canviats += fet.canviats
    r.conflictes += fet.conflictes
  }
  await db.meta.put({ clau: 'hlc', valor: rellotge.actual })
  return r
}

const mateix = (a: unknown, b: unknown) => igualJson(a ?? null, b ?? null)

async function aplicarUn(
  db: QiDB,
  clau: CryptoKey,
  e: EntradaRemota & { taula: TaulaSincronitzada },
  opcions: OpcionsAplicar,
): Promise<ResultatAplicar> {
  const t = db.table(e.taula)
  const idEsborrat = `${e.taula}:${e.clau}`
  for (let intent = 0; intent < 8; intent++) {
    const local = (await t.get(e.clau)) as Registre | undefined
    const marca = await db.esborrats.get(idEsborrat)
    /** undefined: no canvia; null: s'esborra */
    let nou: Registre | null | undefined
    let novaMarca: RegistreEsborrat | undefined
    let perduts: CampPerdut[] = []

    if (e.esborrat) {
      if (!marca || hlcEsborrat(e.esborrat) > hlcEsborrat(marca)) novaMarca = e.esborrat
      if (local && !viuDespresDe(local, e.esborrat)) nou = null
    } else if (e.registre) {
      if (marca && !viuDespresDe(e.registre, marca)) {
        // Esborrat després: no torna
      } else if (!local) {
        if (e.taula === 'fitxesCliniques') {
          const altra = await db.fitxesCliniques.where('pacientId').equals(String(e.registre.pacientId)).first()
          if (altra && altra.id !== e.clau) return fitxesDuplicades(db, clau, altra as unknown as Registre, e.registre)
        }
        nou = e.registre
      } else {
        const f = await fusionarRegistre(clau, e.taula, local, e.registre)
        if (!mateix(f.registre, local)) nou = f.registre
        perduts = f.perduts
      }
    }
    if (nou === undefined && !novaMarca && perduts.length === 0) return { canviats: 0, conflictes: 0 }

    const base = nou ?? local
    const conflictes =
      base && esPerCamp(e.taula) ? await Promise.all(perduts.map((p) => registreConflicte(clau, e.taula as 'pacients', base, p))) : []

    const resultat = await db.transaction('rw', [t, db.esborrats, db.conflictes, db.canvisPropis, db.meta], async () => {
      // Si el registre ha canviat mentrestant (s'acaba de desar), es torna a fusionar
      if (!mateix(await t.get(e.clau), local) || !mateix(await db.esborrats.get(idEsborrat), marca)) return null
      if (nou === null) await t.delete(e.clau)
      else if (nou) await t.put(nou)
      if (novaMarca) await db.esborrats.put(novaMarca)
      const nousConflictes = await desarConflictes(db, conflictes)
      if (opcions.encuar && (nou !== undefined || novaMarca)) await encuar(db, [{ taula: e.taula, clau: e.clau }], (await rellotgeDe(db)).rellotge.actual)
      return { canviats: nou !== undefined ? 1 : 0, conflictes: nousConflictes }
    })
    if (resultat) return resultat
  }
  throw new Error(`No s'ha pogut aplicar ${e.taula}`)
}

/**
 * Desa els conflictes que encara no hi són (ni s'han resolt ja). Dins una
 * transacció amb conflictes, esborrats, canvisPropis i meta. S'apunten a la
 * cua: el valor que ha perdut només és aquí (el diari d'aquest dispositiu ja
 * porta el guanyador), i l'altre dispositiu també l'ha de poder revisar.
 */
async function desarConflictes(db: QiDB, conflictes: readonly (RegistreConflicte & { hlc: string })[]): Promise<number> {
  const nous: string[] = []
  for (const c of conflictes) {
    if (await db.conflictes.get(c.id)) continue
    const resolt = await db.esborrats.get(`conflictes:${c.id}`)
    if (resolt && hlcEsborrat(resolt) >= c.hlc) continue
    await db.conflictes.put(c)
    nous.push(c.id)
  }
  if (nous.length > 0) {
    await encuar(
      db,
      nous.map((clau) => ({ taula: 'conflictes', clau })),
      (await rellotgeDe(db)).rellotge.actual,
    )
  }
  return nous.length
}

/**
 * Dues fitxes clíniques del mateix pacient (creades per versions antigues en
 * dos dispositius): es fusionen camp a camp a la més antiga (la mateixa a tots
 * els dispositius) i l'altra s'esborra. Es pugen totes dues coses.
 */
async function fitxesDuplicades(db: QiDB, clau: CryptoKey, local: Registre, remota: Registre): Promise<ResultatAplicar> {
  const [guanya, perd] = [local, remota].sort(
    (a, b) => String(a.creatAt).localeCompare(String(b.creatAt)) || String(a.id).localeCompare(String(b.id)),
  ) as [Registre, Registre]
  const [og, op] = await Promise.all([obrirRegistre(clau, 'fitxesCliniques', guanya), obrirRegistre(clau, 'fitxesCliniques', perd)])
  const { obert, perduts } = fusionarCamps(og, op)
  const registre = await tancarRegistre(clau, 'fitxesCliniques', guanya, obert)
  const conflictes = await Promise.all(perduts.map((p) => registreConflicte(clau, 'fitxesCliniques', registre, p)))
  const { rellotge } = await rellotgeDe(db)
  const h = rellotge.nou()
  return db.transaction('rw', [db.fitxesCliniques, db.esborrats, db.conflictes, db.canvisPropis, db.meta], async () => {
    const actual = await db.fitxesCliniques.get(String(local.id))
    if (!mateix(actual, local)) throw new Error('La fitxa ha canviat mentre es fusionava')
    await db.fitxesCliniques.delete(String(perd.id))
    await db.fitxesCliniques.put(registre as never)
    const marca: RegistreEsborrat = {
      id: `fitxesCliniques:${String(perd.id)}`,
      taula: 'fitxesCliniques',
      clau: String(perd.id),
      esborratAt: new Date().toISOString(),
      hlc: h,
    }
    await db.esborrats.put(marca)
    const n = await desarConflictes(db, conflictes)
    await encuar(
      db,
      [
        { taula: 'fitxesCliniques', clau: String(guanya.id) },
        { taula: 'fitxesCliniques', clau: String(perd.id) },
      ],
      h,
    )
    return { canviats: 1, conflictes: n }
  })
}

/** Taula que aquesta versió no coneix: es guarda tal qual (guanya el més nou) */
async function aplicarDesconegut(db: QiDB, e: EntradaRemota): Promise<ResultatAplicar> {
  const id = `${e.taula}:${e.clau}`
  return db.transaction('rw', [db.desconegudes, db.esborrats], async () => {
    const local = await db.desconegudes.get(id)
    const marca = await db.esborrats.get(id)
    if (e.esborrat) {
      if (!marca || hlcEsborrat(e.esborrat) > hlcEsborrat(marca)) await db.esborrats.put(e.esborrat)
      if (local && !viuDespresDe(local.registre, e.esborrat)) {
        await db.desconegudes.delete(id)
        return { canviats: 1, conflictes: 0 }
      }
      return { canviats: 0, conflictes: 0 }
    }
    if (!e.registre || (marca && !viuDespresDe(e.registre, marca))) return { canviats: 0, conflictes: 0 }
    if (local && hlcDeRegistre(local.registre) >= hlcDeRegistre(e.registre)) return { canviats: 0, conflictes: 0 }
    await db.desconegudes.put({ id, taula: e.taula, clau: e.clau, registre: e.registre })
    return { canviats: 1, conflictes: 0 }
  })
}
