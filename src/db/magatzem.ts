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
import { episodisActius, esquemaDadesEpisodi, idEpisodiDeCita, nouEpisodi, type DadesEpisodi, type Episodi } from '../domini/episodi'
import {
  esEditable,
  esquemaDadesAddenda,
  esquemaDadesSessio,
  novaSessio,
  type Addenda,
  type DadesSessio,
  type Sessio,
} from '../domini/sessio'
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

  // --- Etapa 3A: episodis, sessions i addendes ---
  llistarEpisodis(pacientId: string): Promise<Episodi[]>
  obtenirEpisodi(id: string): Promise<Episodi | undefined>
  /** `id`: per a la migració (ids que depenen de la cita, iguals a tots els dispositius) */
  crearEpisodi(pacientId: string, dades: DadesEpisodi, id?: string): Promise<Episodi>
  actualitzarEpisodi(id: string, dades: DadesEpisodi): Promise<Episodi>
  obtenirSessio(id: string): Promise<Sessio | undefined>
  sessioDeCita(citaId: string): Promise<Sessio | undefined>
  sessionsDelPacient(pacientId: string): Promise<Sessio[]>
  /** «Començar visita»: crea la sessió de la cita (o torna la que ja hi ha) i posa la cita en curs */
  comencarVisita(citaId: string, minutsRetencio?: number): Promise<Sessio>
  /** Desa la sessió (només els camps canviats respecte d'`inicial`). Si ja no és editable, ErrorSessioBloquejada */
  actualitzarSessio(id: string, dades: DadesSessio, inicial?: DadesSessio): Promise<Sessio>
  /** «Finalitzar visita»: tanca la sessió, hi posa l'hora de final i la cita passa a feta */
  finalitzarSessio(id: string, agulles: { retirades: number | null; motiu: string }): Promise<Sessio>
  addendesDe(sessioId: string): Promise<Addenda[]>
  afegirAddenda(sessioId: string, text: string): Promise<Addenda>
}

/** La sessió fa més de 24 hores que es va tancar: només s'hi poden afegir addendes */
export class ErrorSessioBloquejada extends Error {
  constructor() {
    super('La sessió ja no es pot editar')
    this.name = 'ErrorSessioBloquejada'
  }
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

  // Els mètodes de l'etapa 3A s'hi afegeixen més avall (Object.assign)
  const magatzem = {
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
      const id = nouId()
      return guardarCita(id, araIso(), { ...dades, episodiId: await episodiDeCita(id, dades) })
    },

    async actualitzarCita(id, dades, inicial) {
      const actual = await db.cites.get(id)
      if (!actual) throw new Error(`No existeix la cita ${id}`)
      return guardarCita(id, actual.creatAt, { ...dades, episodiId: await episodiDeCita(id, dades) }, inicial)
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
  } as Magatzem

  // --- Episodis ---

  async function llegirEpisodi(r: RegistreXifrat): Promise<Episodi> {
    const dades = await obrir(clau, 'episodis', r, esquemaDadesEpisodi)
    return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId: r.pacientId!, ...dades }
  }

  async function guardarEpisodi(id: string, pacientId: string, dades: DadesEpisodi): Promise<Episodi> {
    const valid = esquemaDadesEpisodi.parse(dades)
    const existent = await db.episodis.get(id)
    const creatAt = existent?.creatAt ?? araIso()
    const modificatAt = araIso()
    await desarPerCamp(db, clau, 'episodis', { id, creatAt, modificatAt, pacientId }, valid, Object.keys(esquemaDadesEpisodi.shape))
    return { id, creatAt, modificatAt, pacientId, ...valid }
  }

  /**
   * L'episodi d'una cita: «Nou episodi» n'obre un (amb un id que depèn de la
   * cita); si no, el que ja tenia, l'actiu més recent del pacient o, si no en
   * té cap d'actiu, un de nou.
   */
  async function episodiDeCita(citaId: string, dades: DadesCita): Promise<string> {
    const obrirNou = async () => {
      const eid = idEpisodiDeCita(citaId)
      if (!(await db.episodis.get(eid))) await guardarEpisodi(eid, dades.pacientId, nouEpisodi(dades.motiu, dades.inici.slice(0, 10)))
      return eid
    }
    if (dades.nouEpisodi) return obrirNou()
    const propis = await magatzem.llistarEpisodis(dades.pacientId)
    if (dades.episodiId && propis.some((e) => e.id === dades.episodiId)) return dades.episodiId
    return episodisActius(propis)[0]?.id ?? obrirNou()
  }

  // --- Sessions ---

  async function llegirSessio(r: RegistreXifrat): Promise<Sessio> {
    const xifrades = await desxifrarJson(clau, r.xifrat, context('sessions', r.id))
    const dades = esquemaDadesSessio.parse({ ...(xifrades as object), citaId: r.citaId, episodiId: r.episodiId })
    return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId: r.pacientId!, ...dades }
  }

  async function guardarSessio(id: string, pacientId: string, dades: DadesSessio, inicial?: DadesSessio): Promise<Sessio> {
    const { citaId, episodiId, ...resta } = esquemaDadesSessio.parse(dades)
    const existent = await db.sessions.get(id)
    const creatAt = existent?.creatAt ?? araIso()
    const conegudes = Object.keys(esquemaDadesSessio.shape).filter((k) => k !== 'citaId' && k !== 'episodiId')
    await desarPerCamp(
      db,
      clau,
      'sessions',
      { id, creatAt, modificatAt: araIso(), pacientId, citaId, episodiId },
      resta,
      conegudes,
      inicial ? { ...inicial } : undefined,
    )
    return (await magatzem.obtenirSessio(id))!
  }

  Object.assign(magatzem, {
    async llistarEpisodis(pacientId: string) {
      const registres = await db.episodis.where('pacientId').equals(pacientId).toArray()
      return (await Promise.all(registres.map(llegirEpisodi))).sort((a, b) => a.dataInici.localeCompare(b.dataInici))
    },
    async obtenirEpisodi(id: string) {
      const r = await db.episodis.get(id)
      return r && llegirEpisodi(r)
    },
    async crearEpisodi(pacientId: string, dades: DadesEpisodi, id?: string) {
      return guardarEpisodi(id ?? nouId(), pacientId, dades)
    },
    async actualitzarEpisodi(id: string, dades: DadesEpisodi) {
      const e = await db.episodis.get(id)
      if (!e) throw new Error(`No existeix l'episodi ${id}`)
      return guardarEpisodi(id, e.pacientId!, dades)
    },
    async obtenirSessio(id: string) {
      const r = await db.sessions.get(id)
      return r && llegirSessio(r)
    },
    async sessioDeCita(citaId: string) {
      const r = await db.sessions.where('citaId').equals(citaId).first()
      return r && llegirSessio(r)
    },
    async sessionsDelPacient(pacientId: string) {
      const registres = await db.sessions.where('pacientId').equals(pacientId).toArray()
      return (await Promise.all(registres.map(llegirSessio))).sort((a, b) => a.iniciAt.localeCompare(b.iniciAt))
    },
    async comencarVisita(citaId: string, minutsRetencio?: number) {
      const ja = await magatzem.sessioDeCita(citaId)
      const cita = await magatzem.obtenirCita(citaId)
      if (!cita) throw new Error(`No existeix la cita ${citaId}`)
      if (ja) return ja
      const episodiId = cita.episodiId ?? (await episodiDeCita(citaId, cita))
      const delEpisodi = (await magatzem.sessionsDelPacient(cita.pacientId)).filter((s) => s.episodiId === episodiId)
      const id = nouId()
      const sessio = await guardarSessio(
        id,
        cita.pacientId,
        novaSessio({ citaId, episodiId, numero: delEpisodi.length + 1, iniciAt: araIso(), minuts: minutsRetencio }),
      )
      const { id: _i, creatAt: _c, modificatAt: _m, ...dadesCita } = cita
      await magatzem.actualitzarCita(citaId, { ...dadesCita, estat: 'enCurs', sessioId: id, episodiId }, { ...dadesCita })
      return sessio
    },
    async actualitzarSessio(id: string, dades: DadesSessio, inicial?: DadesSessio) {
      const actual = await magatzem.obtenirSessio(id)
      if (!actual) throw new Error(`No existeix la sessió ${id}`)
      if (!esEditable(actual, Date.now())) throw new ErrorSessioBloquejada()
      return guardarSessio(id, actual.pacientId, dades, inicial)
    },
    async finalitzarSessio(id: string, agulles: { retirades: number | null; motiu: string }) {
      const actual = await magatzem.obtenirSessio(id)
      if (!actual) throw new Error(`No existeix la sessió ${id}`)
      const { id: _i, creatAt: _c, modificatAt: _m, pacientId, ...dades } = actual
      const tancada: DadesSessio = {
        ...dades,
        estat: 'tancada',
        finalAt: dades.finalAt ?? araIso(),
        agulles: { ...dades.agulles, retirades: agulles.retirades, motiu: agulles.motiu },
      }
      const s = await guardarSessio(id, pacientId, tancada, dades)
      const cita = await magatzem.obtenirCita(dades.citaId)
      if (cita) {
        const { id: _ci, creatAt: _cc, modificatAt: _cm, ...dc } = cita
        await magatzem.actualitzarCita(cita.id, { ...dc, estat: 'feta', sessioId: id }, { ...dc })
      }
      return s
    },
    async addendesDe(sessioId: string) {
      const registres = await db.addendes.where('sessioId').equals(sessioId).toArray()
      const llista = await Promise.all(
        registres.map(async (r) => {
          const d = (await desxifrarJson(clau, r.xifrat, context('addendes', r.id))) as { text: string; at: string }
          return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId: r.pacientId!, sessioId, ...d }
        }),
      )
      return llista.sort((a, b) => a.at.localeCompare(b.at))
    },
    async afegirAddenda(sessioId: string, text: string) {
      const s = await magatzem.obtenirSessio(sessioId)
      if (!s || s.estat !== 'tancada') throw new Error('Les addendes són per a les sessions tancades')
      const id = nouId()
      const at = araIso()
      const dades = esquemaDadesAddenda.parse({ sessioId, text, at })
      await desarSencer(
        db,
        'addendes',
        {
          id,
          creatAt: at,
          modificatAt: at,
          pacientId: s.pacientId,
          sessioId,
          xifrat: await xifrarJson(clau, { text: dades.text, at }, context('addendes', id)),
        },
        id,
      )
      return { id, creatAt: at, modificatAt: at, pacientId: s.pacientId, ...dades }
    },
  })

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
