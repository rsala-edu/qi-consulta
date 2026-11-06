// Accés a les dades de pacient. Tot el que entra i surt passa per src/crypto:
// aquí no es guarda mai res en clar, excepte els identificadors i les dates.

import type { DadesConflicte } from '../sincronia/fusioClinica'
import type { z } from 'zod'
import { desxifrarJson, xifrarJson, type ClauEmbolcallada, type EmbolcallSecret } from '../crypto'
import {
  esquemaDadesFitxaClinica,
  fitxaClinicaBuida,
  type DadesFitxaClinica,
  type FitxaClinica,
} from '../domini/fitxaClinica'
import {
  esquemaPacientGuardat,
  type DadesPacient,
  type Pacient,
  type PacientGuardat,
} from '../domini/pacient'
import { esquemaCitaGuardada, esquemaDadesCita, type Cita, type DadesCita } from '../domini/cita'
import { esquemaEsborranyGuardat, type Esborrany, type EsborranyGuardat } from '../domini/esborrany'
import { araIso, nouId } from '../domini/registre'
import { desarPerCamp, desarSencer, esborrarRegistres } from '../sincronia/escriptura'
import type { NomTaula, QiDB, RegistreXifrat } from './esquema'

/** Les dades associades lliguen cada text xifrat a la seva taula i al seu id. */
export function context(taula: NomTaula, id: string): string {
  return `qi:${taula}:${id}`
}

async function obrir<S extends z.ZodType>(
  clau: CryptoKey,
  taula: NomTaula,
  registre: RegistreXifrat,
  esquema: S,
): Promise<z.output<S>> {
  const valor = await desxifrarJson(clau, registre.xifrat, context(taula, registre.id))
  return esquema.parse(valor)
}

export interface Magatzem {
  llistarPacients(): Promise<Pacient[]>
  obtenirPacient(id: string): Promise<Pacient | undefined>
  crearPacient(dades: DadesPacient): Promise<Pacient>
  /** `inicial`: les dades quan es va obrir el formulari (només es desa el que s'ha canviat) */
  actualitzarPacient(id: string, dades: DadesPacient, inicial?: DadesPacient): Promise<Pacient>
  arxivarPacient(id: string, arxivat: boolean): Promise<Pacient>
  /** La doctora ha revisat que les dues fitxes són persones diferents: es treu l'avís de totes dues */
  descartarDuplicat(id: string, altreId: string): Promise<Pacient>
  obtenirFitxaClinica(pacientId: string): Promise<FitxaClinica>
  desarFitxaClinica(pacientId: string, dades: DadesFitxaClinica, inicial?: DadesFitxaClinica): Promise<FitxaClinica>
  llistarEsborranys(): Promise<Esborrany[]>
  desarEsborrany(clau: string, esborrany: EsborranyGuardat): Promise<void>
  esborrarEsborrany(clau: string): Promise<void>
  /** Cites amb inici dins [desDe, finsA) (dies o dies i hora locals), ordenades */
  llistarCites(desDe: string, finsA: string): Promise<Cita[]>
  citesDelPacient(pacientId: string): Promise<Cita[]>
  obtenirCita(id: string): Promise<Cita | undefined>
  crearCita(dades: DadesCita): Promise<Cita>
  actualitzarCita(id: string, dades: DadesCita, inicial?: DadesCita): Promise<Cita>
  esborrarCita(id: string): Promise<void>
  /** Camps d'un registre clínic editats en dos dispositius alhora, encara per revisar */
  conflictesDe(registreId: string): Promise<CampEnConflicte[]>
  /** La doctora ha revisat el camp (s'hagi quedat la versió actual o hagi recuperat l'altra) */
  resoldreConflicte(conflicteId: string, camp: string): Promise<void>
}

/** Un camp amb dues versions: la que hi ha i l'altra, que no va guanyar */
export interface CampEnConflicte {
  conflicteId: string
  camp: string
  valor: unknown
  versioAt: string
}

export function crearMagatzem(db: QiDB, clau: CryptoKey): Magatzem {
  async function llegirPacient(r: RegistreXifrat): Promise<Pacient> {
    const dades = await obrir(clau, 'pacients', r, esquemaPacientGuardat)
    return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, ...dades }
  }

  async function guardarPacient(
    id: string,
    creatAt: string,
    dades: PacientGuardat,
    inicial?: PacientGuardat,
  ): Promise<Pacient> {
    const valid = esquemaPacientGuardat.parse(dades)
    const modificatAt = araIso()
    await desarPerCamp(db, clau, 'pacients', { id, creatAt, modificatAt }, valid, Object.keys(esquemaPacientGuardat.shape), inicial)
    // El que ha quedat de veritat (amb el que hagi arribat d'un altre dispositiu)
    return inicial ? pacientExistent(id) : { id, creatAt, modificatAt, ...valid }
  }

  async function pacientExistent(id: string): Promise<Pacient> {
    const p = await magatzem.obtenirPacient(id)
    if (!p) throw new Error(`No existeix el pacient ${id}`)
    return p
  }

  async function llegirCita(r: RegistreXifrat): Promise<Cita> {
    const dades = await obrir(clau, 'cites', r, esquemaCitaGuardada)
    return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId: r.pacientId!, inici: r.inici!, ...dades }
  }

  async function guardarCita(id: string, creatAt: string, dades: DadesCita, inicial?: DadesCita): Promise<Cita> {
    const valid = esquemaDadesCita.parse(dades)
    await pacientExistent(valid.pacientId)
    const { pacientId, inici, ...resta } = valid
    const modificatAt = araIso()
    await desarPerCamp(
      db,
      clau,
      'cites',
      { id, creatAt, modificatAt, pacientId, inici },
      esquemaCitaGuardada.parse(resta),
      Object.keys(esquemaCitaGuardada.shape),
      inicial,
    )
    if (inicial) return (await magatzem.obtenirCita(id))!
    return { id, creatAt, modificatAt, ...valid }
  }

  const magatzem: Magatzem = {
    async llistarPacients() {
      const registres = await db.pacients.toArray()
      return Promise.all(registres.map(llegirPacient))
    },

    async obtenirPacient(id) {
      const r = await db.pacients.get(id)
      return r && llegirPacient(r)
    },

    async crearPacient(dades) {
      const ara = araIso()
      return guardarPacient(nouId(), ara, { ...dades, arxivat: false })
    },

    async actualitzarPacient(id, dades, inicial) {
      const actual = await pacientExistent(id)
      const extres = {
        arxivat: actual.arxivat,
        // L'avís de possible duplicat es manté fins que la doctora el revisa
        ...(actual.revisarDuplicat ? { revisarDuplicat: actual.revisarDuplicat } : {}),
      }
      return guardarPacient(id, actual.creatAt, { ...dades, ...extres }, inicial ? { ...inicial, ...extres } : undefined)
    },

    async arxivarPacient(id, arxivat) {
      const actual = await pacientExistent(id)
      // l'esquema descarta id i dates abans de xifrar
      return guardarPacient(id, actual.creatAt, { ...actual, arxivat })
    },

    async descartarDuplicat(id, altreId) {
      const treure = async (de: string, quin: string) => {
        const p = await magatzem.obtenirPacient(de)
        if (!p?.revisarDuplicat) return p
        const { revisarDuplicat, ...resta } = p
        const queden = revisarDuplicat.filter((x) => x !== quin)
        return guardarPacient(de, p.creatAt, { ...resta, ...(queden.length > 0 ? { revisarDuplicat: queden } : {}) })
      }
      await treure(altreId, id)
      return (await treure(id, altreId)) ?? pacientExistent(id)
    },

    async obtenirFitxaClinica(pacientId) {
      const r = await db.fitxesCliniques.where('pacientId').equals(pacientId).first()
      if (!r) {
        // Encara no s'ha omplert: fitxa buida, sense guardar res.
        const ara = araIso()
        return { id: '', creatAt: ara, modificatAt: ara, pacientId, ...fitxaClinicaBuida() }
      }
      const dades = await obrir(clau, 'fitxesCliniques', r, esquemaDadesFitxaClinica)
      return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId, ...dades }
    },

    async desarFitxaClinica(pacientId, dades, inicial) {
      await pacientExistent(pacientId)
      const valid = esquemaDadesFitxaClinica.parse(dades)
      const existent = await db.fitxesCliniques.where('pacientId').equals(pacientId).first()
      // Un id que depèn del pacient: si dos dispositius creen la fitxa alhora, és la mateixa
      const id = existent?.id ?? `fitxa-${pacientId}`
      const creatAt = existent?.creatAt ?? araIso()
      const modificatAt = araIso()
      await desarPerCamp(
        db,
        clau,
        'fitxesCliniques',
        { id, pacientId, creatAt, modificatAt },
        valid,
        Object.keys(esquemaDadesFitxaClinica.shape),
        inicial ? { ...inicial, pacientId } : undefined,
      )
      return inicial ? magatzem.obtenirFitxaClinica(pacientId) : { id, pacientId, creatAt, modificatAt, ...valid }
    },

    async llistarEsborranys() {
      const registres = await db.esborranys.orderBy('modificatAt').reverse().toArray()
      return Promise.all(
        registres.map(async (r) => ({
          clau: r.id,
          modificatAt: r.modificatAt,
          ...(await obrir(clau, 'esborranys', r, esquemaEsborranyGuardat)),
        })),
      )
    },

    async desarEsborrany(clauFormulari, esborrany) {
      const existent = await db.esborranys.get(clauFormulari)
      const ara = araIso()
      await db.esborranys.put({
        id: clauFormulari,
        creatAt: existent?.creatAt ?? ara,
        modificatAt: ara,
        xifrat: await xifrarJson(clau, esborrany, context('esborranys', clauFormulari)),
      })
    },

    async esborrarEsborrany(clauFormulari) {
      await db.esborranys.delete(clauFormulari)
    },

    async llistarCites(desDe, finsA) {
      const registres = await db.cites.where('inici').between(desDe, finsA, true, false).sortBy('inici')
      return Promise.all(registres.map(llegirCita))
    },

    async citesDelPacient(pacientId) {
      const registres = await db.cites.where('pacientId').equals(pacientId).sortBy('inici')
      return Promise.all(registres.map(llegirCita))
    },

    async obtenirCita(id) {
      const r = await db.cites.get(id)
      return r && llegirCita(r)
    },

    async crearCita(dades) {
      return guardarCita(nouId(), araIso(), dades)
    },

    async actualitzarCita(id, dades, inicial) {
      const actual = await db.cites.get(id)
      if (!actual) throw new Error(`No existeix la cita ${id}`)
      return guardarCita(id, actual.creatAt, dades, inicial)
    },

    async esborrarCita(id) {
      await esborrarRegistres(db, 'cites', [id])
    },

    async conflictesDe(registreId) {
      const registres = await db.conflictes.where('registreId').equals(registreId).toArray()
      const camps: CampEnConflicte[] = []
      for (const r of registres.sort((a, b) => a.creatAt.localeCompare(b.creatAt))) {
        const d = (await desxifrarJson(clau, r.xifrat, context('conflictes', r.id))) as DadesConflicte
        for (const c of d.camps) camps.push({ conflicteId: r.id, camp: c.camp, valor: c.valor, versioAt: d.versioAt })
      }
      return camps
    },

    async resoldreConflicte(conflicteId, camp) {
      const r = await db.conflictes.get(conflicteId)
      if (!r) return
      const d = (await desxifrarJson(clau, r.xifrat, context('conflictes', r.id))) as DadesConflicte
      const resta = d.camps.filter((c) => c.camp !== camp)
      if (resta.length === 0) {
        await esborrarRegistres(db, 'conflictes', [conflicteId])
        return
      }
      await desarSencer(
        db,
        'conflictes',
        { ...r, modificatAt: araIso(), xifrat: await xifrarJson(clau, { ...d, camps: resta }, context('conflictes', r.id)) },
        r.id,
      )
    },
  }
  return magatzem
}

// --- Clau mestra embolcallada (no és dada de pacient; ja va xifrada) ---

export async function llegirClauEmbolcallada(db: QiDB): Promise<ClauEmbolcallada | undefined> {
  const r = await db.meta.get('clauMestra')
  return r?.clau === 'clauMestra' ? r.valor : undefined
}

export async function guardarClauEmbolcallada(db: QiDB, valor: ClauEmbolcallada, at = new Date().toISOString()): Promise<void> {
  await db.meta.bulkPut([
    { clau: 'clauMestra', valor },
    { clau: 'clauMestraAt', valor: at },
  ])
}

export async function llegirClauMestraAt(db: QiDB): Promise<string> {
  const r = await db.meta.get('clauMestraAt')
  return r?.clau === 'clauMestraAt' ? r.valor : '1970-01-01T00:00:00.000Z'
}

export async function llegirSecrets(db: QiDB): Promise<EmbolcallSecret[]> {
  const r = await db.meta.get('secrets')
  return r?.clau === 'secrets' ? r.valor : []
}

export async function guardarSecrets(db: QiDB, valor: EmbolcallSecret[]): Promise<void> {
  await db.meta.put({ clau: 'secrets', valor })
}

// --- Bloqueig per inactivitat (ajust d'aquest dispositiu, no és dada de pacient) ---

/** Opcions que es poden triar a Ajustos > Seguretat */
export const OPCIONS_MINUTS_BLOQUEIG = [5, 10, 15, 30] as const
export const MINUTS_BLOQUEIG_PER_DEFECTE = 10

export async function llegirMinutsBloqueig(db: QiDB): Promise<number> {
  const r = await db.meta.get('minutsBloqueig')
  return r?.clau === 'minutsBloqueig' && (OPCIONS_MINUTS_BLOQUEIG as readonly number[]).includes(r.valor)
    ? r.valor
    : MINUTS_BLOQUEIG_PER_DEFECTE
}

export async function guardarMinutsBloqueig(db: QiDB, minuts: number): Promise<void> {
  if (!(OPCIONS_MINUTS_BLOQUEIG as readonly number[]).includes(minuts)) throw new Error(`Minuts no vàlids: ${minuts}`)
  await db.meta.put({ clau: 'minutsBloqueig', valor: minuts })
}

export interface EstatGoogle {
  connectatAt: string
  ultimaCopia: string | null
  /** Identificador intern del compte de Google (no el correu): pista per renovar el permís */
  sub?: string
}

export async function llegirEstatGoogle(db: QiDB): Promise<EstatGoogle | null> {
  const r = await db.meta.get('google')
  return r?.clau === 'google' ? r.valor : null
}

export async function guardarEstatGoogle(db: QiDB, valor: EstatGoogle): Promise<void> {
  await db.meta.put({ clau: 'google', valor })
}
