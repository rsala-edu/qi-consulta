// Les dades clíniques mai es descarten en silenci. Abans de fusionar la còpia
// de Drive amb la del dispositiu (copia.ts, on per a cada registre guanya el
// canvi més nou), es busquen els registres clínics que s'han editat en dos
// dispositius alhora i es fusionen camp a camp (fusioCamps.ts):
// - el mateix registre editat als dos llocs des de l'última sincronia;
// - dues fitxes clíniques del mateix pacient (creades als dos dispositius).
// Els valors que no guanyen es desen xifrats a la taula `conflictes`, que
// també se sincronitza, perquè la doctora els revisi.

import { desxifrarJson, xifrarJson } from '../crypto'
import type { NomTaula, RegistreConflicte, RegistreEsborrat, RegistreXifrat } from '../db/esquema'
import { context } from '../db/magatzem'
import type { Contingut } from './copia'
import { fusionarCamps, type ConflicteCamp, type Dades } from './fusioCamps'

/**
 * Taules amb dades clíniques que es poden fusionar. Quan n'hi hagi de noves
 * (valoracions, sessions de l'etapa 3), s'han d'afegir aquí.
 */
export const TAULES_CLINIQUES: readonly { nom: NomTaula & keyof Contingut['taules']; unic?: 'pacientId' }[] = [
  { nom: 'pacients' },
  { nom: 'fitxesCliniques', unic: 'pacientId' },
  { nom: 'cites' },
]

/** Camps que van en clar fora del xifrat (cites): també es fusionen */
const CAMPS_CLARS = ['pacientId', 'inici'] as const

/** El que es xifra dins un registre de conflicte */
export interface DadesConflicte {
  camps: ConflicteCamp[]
  /** Quan es va desar la versió que no ha guanyat */
  versioAt: string
}

type Registre = RegistreXifrat & Record<string, unknown>

/** Registres clínics (xifrats) tal com van quedar a l'última sincronia, per taula */
export type BaseSincronia = Partial<Record<string, RegistreXifrat[]>>

/** La base per a la pròxima sincronia: els registres clínics del contingut */
export function baseDe(c: Contingut): BaseSincronia {
  return Object.fromEntries(TAULES_CLINIQUES.map(({ nom }) => [nom, c.taules[nom] as unknown as RegistreXifrat[]]))
}

async function obrir(clau: CryptoKey, taula: NomTaula, r: Registre): Promise<Dades> {
  return (await desxifrarJson(clau, r.xifrat, context(taula, r.id))) as Dades
}

export async function nouConflicte(
  clau: CryptoKey,
  taula: NomTaula,
  registre: Pick<RegistreXifrat, 'id' | 'pacientId'>,
  dades: DadesConflicte,
  ara: string,
): Promise<RegistreConflicte> {
  const id = `${taula}:${registre.id}:${ara}:${crypto.randomUUID().slice(0, 8)}`
  return {
    id,
    taula,
    registreId: registre.id,
    ...(registre.pacientId ? { pacientId: registre.pacientId } : {}),
    creatAt: ara,
    modificatAt: ara,
    xifrat: await xifrarJson(clau, dades, context('conflictes', id)),
  }
}

/**
 * Fusiona camp a camp dues o més versions (la primera és la que es queda
 * l'id). Torna el registre resultant i, si hi ha hagut conflictes, el
 * registre de conflicte.
 */
export async function fusionarVersions(
  clau: CryptoKey,
  taula: NomTaula,
  guanyador: Registre,
  versions: readonly Registre[],
  ara: string,
  /** La versió de l'última sincronia, si se sap: el que només ha canviat en un lloc no és conflicte */
  base?: Registre,
): Promise<{ registre: Registre; conflicte: RegistreConflicte | null }> {
  const dadesBase = base ? await obrir(clau, taula, base) : undefined
  const clarsBase = base ? Object.fromEntries(CAMPS_CLARS.filter((c) => c in base).map((c) => [c, base[c]])) : undefined
  // De la més nova a la més antiga: la més nova guanya
  const ordenades = [...versions].sort((a, b) => b.modificatAt.localeCompare(a.modificatAt))
  let dades = await obrir(clau, taula, ordenades[0]!)
  let clars: Dades = Object.fromEntries(CAMPS_CLARS.filter((c) => c in ordenades[0]!).map((c) => [c, ordenades[0]![c]]))
  const conflictes: ConflicteCamp[] = []
  for (const anterior of ordenades.slice(1)) {
    const r = fusionarCamps(dades, await obrir(clau, taula, anterior), '', dadesBase)
    dades = r.dades
    conflictes.push(...r.conflictes)
    const c = fusionarCamps(
      clars,
      Object.fromEntries(CAMPS_CLARS.filter((x) => x in anterior).map((x) => [x, anterior[x]])),
      '',
      clarsBase,
    )
    clars = c.dades
    // pacientId no pot canviar dins una fusió de fitxes; l'hora d'una cita, sí
    conflictes.push(...c.conflictes.filter((x) => x.camp !== 'pacientId'))
  }
  const registre: Registre = {
    ...guanyador,
    ...clars,
    modificatAt: ara,
    xifrat: await xifrarJson(clau, dades, context(taula, guanyador.id)),
  }
  const conflicte =
    conflictes.length > 0
      ? await nouConflicte(clau, taula, registre, { camps: conflictes, versioAt: ordenades[1]!.modificatAt }, ara)
      : null
  return { registre, conflicte }
}

export interface ResultatFusioClinica {
  local: Contingut
  remot: Contingut
  /** Registres fusionats camp a camp (amb conflicte o sense) */
  fusionats: number
  /** Camps amb dues versions, que la doctora ha de revisar */
  conflictes: number
}

function ambRegistres(
  c: Contingut,
  taula: keyof Contingut['taules'],
  registres: Registre[],
  conflictes: RegistreConflicte[],
  esborrats: RegistreEsborrat[],
): Contingut {
  const nous = conflictes as unknown as Contingut['taules']['conflictes']
  return {
    ...c,
    taules: { ...c.taules, [taula]: registres, conflictes: [...(c.taules.conflictes ?? []), ...nous] },
    esborrats: [...c.esborrats, ...esborrats],
  }
}

/**
 * Prepara el contingut local i el remot perquè la fusió de copia.ts no
 * descarti cap dada clínica. `darrera`: hora de l'última sincronia correcta
 * d'aquest dispositiu (el que s'ha modificat després, als dos llocs, és un
 * conflicte). Sense `darrera`, només es fusionen les fitxes duplicades.
 */
export async function fusionarClinics(
  clau: CryptoKey,
  local: Contingut,
  remot: Contingut,
  darrera: string | null,
  ara: string,
  /** Els registres clínics tal com van quedar a l'última sincronia */
  base: BaseSincronia = {},
): Promise<ResultatFusioClinica> {
  let l = local
  let r = remot
  let fusionats = 0
  let conflictes = 0
  const esborrat = new Set([...l.esborrats, ...r.esborrats].map((e) => e.id))

  for (const { nom, unic } of TAULES_CLINIQUES) {
    const bases = new Map((base[nom] ?? []).map((x) => [x.id, x as Registre]))
    const locals = new Map((l.taules[nom] as Registre[]).map((x) => [x.id, x]))
    const remots = new Map((r.taules[nom] as Registre[]).map((x) => [x.id, x]))
    const nousConflictes: RegistreConflicte[] = []
    const nousEsborrats: RegistreEsborrat[] = []
    const resultat = new Map<string, Registre>()

    // 1. El mateix registre editat als dos dispositius des de l'última sincronia
    for (const [id, a] of locals) {
      const b = remots.get(id)
      if (!b || !darrera || a.modificatAt === b.modificatAt) continue
      if (a.modificatAt <= darrera || b.modificatAt <= darrera) continue
      const f = await fusionarVersions(clau, nom, a, [a, b], ara, bases.get(id))
      resultat.set(id, f.registre)
      if (f.conflicte) nousConflictes.push(f.conflicte)
      fusionats++
      conflictes += f.conflicte ? 1 : 0
    }

    // 2. Dos registres per al mateix valor únic (dues fitxes del mateix pacient)
    if (unic) {
      const tots = new Map<string, Registre>()
      for (const x of [...locals.values(), ...remots.values()]) {
        if (esborrat.has(`${nom}:${x.id}`)) continue
        const actual = resultat.get(x.id) ?? x
        const ja = tots.get(x.id)
        if (!ja || actual.modificatAt > ja.modificatAt) tots.set(x.id, actual)
      }
      const perValor = new Map<string, Registre[]>()
      for (const x of tots.values()) {
        const v = String(x[unic])
        perValor.set(v, [...(perValor.get(v) ?? []), x])
      }
      for (const grup of perValor.values()) {
        if (grup.length < 2) continue
        // Es queda l'id de la més antiga (el mateix a tots els dispositius)
        const guanyador = [...grup].sort((a, b) => a.creatAt.localeCompare(b.creatAt) || a.id.localeCompare(b.id))[0]!
        const f = await fusionarVersions(clau, nom, guanyador, grup, ara)
        resultat.set(guanyador.id, f.registre)
        if (f.conflicte) nousConflictes.push(f.conflicte)
        for (const x of grup)
          if (x.id !== guanyador.id) {
            nousEsborrats.push({ id: `${nom}:${x.id}`, taula: nom, clau: x.id, esborratAt: ara })
            resultat.delete(x.id)
          }
        fusionats++
        conflictes += f.conflicte ? 1 : 0
      }
    }

    if (resultat.size === 0 && nousEsborrats.length === 0) continue
    const perduts = new Set(nousEsborrats.map((e) => e.clau))
    const aplicar = (originals: Map<string, Registre>) => {
      const llista = [...originals.values()].filter((x) => !perduts.has(x.id)).map((x) => resultat.get(x.id) ?? x)
      for (const [id, x] of resultat) if (!originals.has(id)) llista.push(x)
      return llista
    }
    l = ambRegistres(l, nom, aplicar(locals), nousConflictes, nousEsborrats)
    r = ambRegistres(r, nom, aplicar(remots), nousConflictes, nousEsborrats)
  }
  return { local: l, remot: r, fusionats, conflictes }
}

/**
 * Una sola vegada per dispositiu: busca a les còpies diàries i mensuals de
 * Drive les fitxes clíniques que una versió anterior de l'app (59f3425)
 * podia haver descartat en trobar-ne dues del mateix pacient, i les torna a
 * fusionar camp a camp amb la que hi ha ara. Torna quantes n'ha recuperat.
 */
export async function recuperarFitxesDescartades(
  clau: CryptoKey,
  actual: Contingut,
  copies: readonly Contingut[],
  ara: string,
): Promise<{ contingut: Contingut; recuperades: number }> {
  const taula = 'fitxesCliniques' as const
  const fitxes = actual.taules[taula] as Registre[]
  const ids = new Set(fitxes.map((f) => f.id))
  const esborrat = new Set(actual.esborrats.map((e) => e.id))
  // L'última versió de cada fitxa que ja no hi és (i que ningú no ha esborrat)
  const perdudes = new Map<string, Registre>()
  for (const c of copies)
    for (const f of (c.taules[taula] ?? []) as Registre[]) {
      if (ids.has(f.id) || esborrat.has(`${taula}:${f.id}`)) continue
      const ja = perdudes.get(f.id)
      if (!ja || f.modificatAt > ja.modificatAt) perdudes.set(f.id, f)
    }
  if (perdudes.size === 0) return { contingut: actual, recuperades: 0 }

  const resultat = new Map(fitxes.map((f) => [f.id, f]))
  const conflictes: RegistreConflicte[] = []
  const esborrats: RegistreEsborrat[] = []
  for (const perduda of perdudes.values()) {
    const viva = [...resultat.values()].find((f) => f.pacientId === perduda.pacientId)
    if (!viva) {
      // El pacient ja no en té cap: es recupera tal qual
      resultat.set(perduda.id, perduda)
      continue
    }
    const f = await fusionarVersions(clau, taula, viva, [viva, perduda], ara)
    resultat.set(viva.id, f.registre)
    if (f.conflicte) conflictes.push(f.conflicte)
    esborrats.push({ id: `${taula}:${perduda.id}`, taula, clau: perduda.id, esborratAt: ara })
  }
  return {
    contingut: ambRegistres(actual, taula, [...resultat.values()], conflictes, esborrats),
    recuperades: perdudes.size,
  }
}
