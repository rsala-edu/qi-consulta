// Accés a les dades de pacient. Tot el que entra i surt passa per src/crypto:
// aquí no es guarda mai res en clar, excepte els identificadors i les dates.

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
import { registrarEsborrats } from './esborrats'
import type { NomTaula, QiDB, RegistreXifrat } from './esquema'

/** Les dades associades lliguen cada text xifrat a la seva taula i al seu id. */
function context(taula: NomTaula, id: string): string {
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
  actualitzarPacient(id: string, dades: DadesPacient): Promise<Pacient>
  arxivarPacient(id: string, arxivat: boolean): Promise<Pacient>
  obtenirFitxaClinica(pacientId: string): Promise<FitxaClinica>
  desarFitxaClinica(pacientId: string, dades: DadesFitxaClinica): Promise<FitxaClinica>
  llistarEsborranys(): Promise<Esborrany[]>
  desarEsborrany(clau: string, esborrany: EsborranyGuardat): Promise<void>
  esborrarEsborrany(clau: string): Promise<void>
  /** Cites amb inici dins [desDe, finsA) (dies o dies i hora locals), ordenades */
  llistarCites(desDe: string, finsA: string): Promise<Cita[]>
  citesDelPacient(pacientId: string): Promise<Cita[]>
  obtenirCita(id: string): Promise<Cita | undefined>
  crearCita(dades: DadesCita): Promise<Cita>
  actualitzarCita(id: string, dades: DadesCita): Promise<Cita>
  esborrarCita(id: string): Promise<void>
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
  ): Promise<Pacient> {
    const valid = esquemaPacientGuardat.parse(dades)
    const modificatAt = araIso()
    await db.pacients.put({
      id,
      creatAt,
      modificatAt,
      xifrat: await xifrarJson(clau, valid, context('pacients', id)),
    })
    return { id, creatAt, modificatAt, ...valid }
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

  async function guardarCita(id: string, creatAt: string, dades: DadesCita): Promise<Cita> {
    const valid = esquemaDadesCita.parse(dades)
    await pacientExistent(valid.pacientId)
    const { pacientId, inici, ...resta } = valid
    const modificatAt = araIso()
    await db.cites.put({
      id,
      creatAt,
      modificatAt,
      pacientId,
      inici,
      xifrat: await xifrarJson(clau, esquemaCitaGuardada.parse(resta), context('cites', id)),
    })
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

    async actualitzarPacient(id, dades) {
      const actual = await pacientExistent(id)
      return guardarPacient(id, actual.creatAt, { ...dades, arxivat: actual.arxivat })
    },

    async arxivarPacient(id, arxivat) {
      const actual = await pacientExistent(id)
      // l'esquema descarta id i dates abans de xifrar
      return guardarPacient(id, actual.creatAt, { ...actual, arxivat })
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

    async desarFitxaClinica(pacientId, dades) {
      await pacientExistent(pacientId)
      const valid = esquemaDadesFitxaClinica.parse(dades)
      const existent = await db.fitxesCliniques.where('pacientId').equals(pacientId).first()
      const id = existent?.id ?? nouId()
      const creatAt = existent?.creatAt ?? araIso()
      const modificatAt = araIso()
      await db.fitxesCliniques.put({
        id,
        pacientId,
        creatAt,
        modificatAt,
        xifrat: await xifrarJson(clau, valid, context('fitxesCliniques', id)),
      })
      return { id, pacientId, creatAt, modificatAt, ...valid }
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

    async actualitzarCita(id, dades) {
      const actual = await db.cites.get(id)
      if (!actual) throw new Error(`No existeix la cita ${id}`)
      return guardarCita(id, actual.creatAt, dades)
    },

    async esborrarCita(id) {
      await db.cites.delete(id)
      await registrarEsborrats(db, 'cites', [id])
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
