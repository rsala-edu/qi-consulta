// Accés a les dades de pacient. Tot el que entra i surt passa per src/crypto:
// aquí no es guarda mai res en clar, excepte els identificadors i les dates.

import type { z } from 'zod'
import { desxifrarJson, xifrarJson, type ClauEmbolcallada } from '../crypto'
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
import { araIso, nouId } from '../domini/registre'
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
  }
  return magatzem
}

// --- Clau mestra embolcallada (no és dada de pacient; ja va xifrada) ---

export async function llegirClauEmbolcallada(db: QiDB): Promise<ClauEmbolcallada | undefined> {
  return (await db.meta.get('clauMestra'))?.valor
}

export async function guardarClauEmbolcallada(db: QiDB, valor: ClauEmbolcallada): Promise<void> {
  await db.meta.put({ clau: 'clauMestra', valor })
}
