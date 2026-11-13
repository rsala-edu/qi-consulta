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
import { episodisActius, esquemaDadesEpisodi, idEpisodiDeCita, nouEpisodi, senseMotiu, type DadesEpisodi, type Episodi } from '../domini/episodi'
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
import {
  citesRepetides,
  esPotDesfer,
  valorsDesfets,
  type Ajuntament,
  type FitxaPerAjuntar,
} from '../domini/ajuntar'
import { dadesDePacient } from '../domini/pacient'
import { recalcularTipusVisita } from './tipusVisita'
import { esquemaDadesValoracio, idValoracio, novaValoracio, type DadesValoracio, type Valoracio } from '../domini/valoracio'
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
  /** `inicial`: les dades quan es va obrir el formulari (només es desa el que s'ha canviat) */
  actualitzarEpisodi(id: string, dades: DadesEpisodi, inicial?: DadesEpisodi): Promise<Episodi>
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

  // --- Etapa 3B: valoració inicial (una per episodi, amb versions) ---
  /** Totes les versions, de la primera a la darrera */
  valoracionsDe(episodiId: string): Promise<Valoracio[]>
  /** Desa una versió (només els camps canviats respecte d'`inicial`); si encara no existeix, la crea */
  desarValoracio(dades: DadesValoracio, inicial?: DadesValoracio): Promise<Valoracio>
  /** «Revisar la valoració»: una versió nova a partir de l'última (l'anterior es conserva) */
  revisarValoracio(episodiId: string, sessioId: string | null): Promise<Valoracio>

  // --- Part 2: ajuntar fitxes de la mateixa persona ---
  /** Les dades del pacient i la fitxa clínica per comparar-les */
  dadesPerAjuntar(pacientId: string): Promise<FitxaPerAjuntar>
  /**
   * Ajunta `treuId` a `quedaId`: les cites, episodis, sessions i addendes
   * passen a `quedaId`, que es queda amb `dades`; les cites repetides es
   * treuen, i `treuId` s'arxiva amb tot el que cal per desfer-ho.
   */
  ajuntarPacients(quedaId: string, treuId: string, dades: { pacient: DadesPacient; fitxa: DadesFitxaClinica }): Promise<InformeAjuntament>
  /** Desfà l'ajuntament (dins dels 30 dies): cada cosa torna a la seva fitxa */
  desferAjuntament(treuId: string): Promise<void>
  /**
   * El que un altre dispositiu hagi creat per a una fitxa ja ajuntada (abans
   * de saber-ho) passa a la fitxa que es queda. Torna quants registres ha mogut.
   */
  redirigirAjuntades(): Promise<number>
}

export interface InformeAjuntament {
  cites: number
  episodis: number
  sessions: number
  addendes: number
  /** Cites que eren a totes dues fitxes (mateix dia, hora i durada) i se n'ha tret una */
  citesRepetides: number
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
        ...(actual.ajuntadaAmb ? { ajuntadaAmb: actual.ajuntadaAmb } : {}),
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

  async function guardarEpisodi(id: string, pacientId: string, dades: DadesEpisodi, inicial?: DadesEpisodi): Promise<Episodi> {
    const valid = esquemaDadesEpisodi.parse(dades)
    const existent = await db.episodis.get(id)
    const creatAt = existent?.creatAt ?? araIso()
    const modificatAt = araIso()
    await desarPerCamp(
      db,
      clau,
      'episodis',
      { id, creatAt, modificatAt, pacientId },
      valid,
      Object.keys(esquemaDadesEpisodi.shape),
      inicial ? { ...inicial, pacientId } : undefined,
    )
    if (inicial) return (await magatzem.obtenirEpisodi(id))!
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
    async actualitzarEpisodi(id: string, dades: DadesEpisodi, inicial?: DadesEpisodi) {
      const e = await db.episodis.get(id)
      if (!e) throw new Error(`No existeix l'episodi ${id}`)
      return guardarEpisodi(id, e.pacientId!, dades, inicial)
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
      // Un episodi obert per una cita sense motiu agafa el de la primera cita que en porti
      const episodi = await magatzem.obtenirEpisodi(episodiId)
      if (episodi && senseMotiu(episodi.motiu) && !senseMotiu(cita.motiu)) {
        const { id: _ei, creatAt: _ec, modificatAt: _em, pacientId: _ep, ...dadesEpisodi } = episodi
        await magatzem.actualitzarEpisodi(episodiId, { ...dadesEpisodi, motiu: cita.motiu.trim() }, dadesEpisodi)
      }
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


  // --- Valoracions ---

  async function llegirValoracio(r: RegistreXifrat): Promise<Valoracio> {
    const xifrades = await desxifrarJson(clau, r.xifrat, context('valoracions', r.id))
    const dades = esquemaDadesValoracio.parse({ ...(xifrades as object), episodiId: r.episodiId })
    return { id: r.id, creatAt: r.creatAt, modificatAt: r.modificatAt, pacientId: r.pacientId!, ...dades }
  }

  async function guardarValoracio(pacientId: string, dades: DadesValoracio, inicial?: DadesValoracio): Promise<Valoracio> {
    const { episodiId, ...resta } = esquemaDadesValoracio.parse(dades)
    const id = idValoracio(episodiId, dades.versio)
    const existent = await db.valoracions.get(id)
    const conegudes = Object.keys(esquemaDadesValoracio.shape).filter((k) => k !== 'episodiId')
    await desarPerCamp(
      db,
      clau,
      'valoracions',
      { id, creatAt: existent?.creatAt ?? araIso(), modificatAt: araIso(), pacientId, episodiId },
      resta,
      conegudes,
      inicial ? { ...inicial } : undefined,
    )
    return llegirValoracio((await db.valoracions.get(id))!)
  }

  Object.assign(magatzem, {
    async valoracionsDe(episodiId: string) {
      const registres = await db.valoracions.where('episodiId').equals(episodiId).toArray()
      return (await Promise.all(registres.map(llegirValoracio))).sort((a, b) => a.versio - b.versio)
    },
    async desarValoracio(dades: DadesValoracio, inicial?: DadesValoracio) {
      const e = await db.episodis.get(dades.episodiId)
      if (!e) throw new Error(`No existeix l'episodi ${dades.episodiId}`)
      return guardarValoracio(e.pacientId!, dades, inicial)
    },
    async revisarValoracio(episodiId: string, sessioId: string | null) {
      const totes = await magatzem.valoracionsDe(episodiId)
      const darrera = totes.at(-1)
      return magatzem.desarValoracio(novaValoracio(episodiId, (darrera?.versio ?? 0) + 1, sessioId, darrera))
    },
  })

  // --- Ajuntar fitxes ---

  const TAULES_MOGUDES = ['episodis', 'cites', 'sessions', 'addendes', 'valoracions'] as const

  const senseMeta = <T extends { id: string; creatAt: string; modificatAt: string }>(x: T) => {
    const { id: _i, creatAt: _c, modificatAt: _m, ...resta } = x
    return resta
  }

  /** Passa un registre d'un pacient a un altre (només canvia el pacient: la resta es manté) */
  async function moure(taula: (typeof TAULES_MOGUDES)[number], id: string, a: string): Promise<boolean> {
    if (taula === 'cites') {
      const c = await magatzem.obtenirCita(id)
      if (!c || c.pacientId === a) return false
      const d = senseMeta(c)
      await guardarCita(id, c.creatAt, { ...d, pacientId: a }, d)
    } else if (taula === 'episodis') {
      const r = await db.episodis.get(id)
      if (!r || r.pacientId === a) return false
      const e = senseMeta(await llegirEpisodi(r))
      const { pacientId, ...dades } = e
      await desarPerCamp(
        db,
        clau,
        'episodis',
        { id, creatAt: r.creatAt, modificatAt: araIso(), pacientId: a },
        dades,
        Object.keys(esquemaDadesEpisodi.shape),
        { ...dades, pacientId },
      )
    } else if (taula === 'sessions') {
      const s = await magatzem.obtenirSessio(id)
      if (!s || s.pacientId === a) return false
      const { pacientId: _p, ...dades } = senseMeta(s)
      await guardarSessio(id, a, dades, dades)
    } else if (taula === 'valoracions') {
      const v = await db.valoracions.get(id)
      if (!v || v.pacientId === a) return false
      const actual = await llegirValoracio(v)
      const { pacientId: _p, ...dades } = senseMeta(actual)
      await guardarValoracio(a, dades, dades)
    } else {
      const r = await db.addendes.get(id)
      if (!r || r.pacientId === a) return false
      await desarSencer(db, 'addendes', { ...r, pacientId: a, modificatAt: araIso() }, id)
    }
    return true
  }

  async function idsDe(taula: (typeof TAULES_MOGUDES)[number], pacientId: string): Promise<string[]> {
    return (await db.table(taula).where('pacientId').equals(pacientId).primaryKeys()) as string[]
  }

  /** La fitxa on ha d'anar a parar tot el d'un pacient ajuntat (si s'ha ajuntat més d'un cop, la del final) */
  async function desti(p: Pacient): Promise<string | null> {
    let actual = p
    for (let i = 0; i < 10 && actual.ajuntadaAmb && actual.ajuntadaAmb.desfetAt === null; i++) {
      const seguent = await magatzem.obtenirPacient(actual.ajuntadaAmb.pacientId)
      if (!seguent) break
      actual = seguent
    }
    return actual.id === p.id ? null : actual.id
  }


  Object.assign(magatzem, {
    async dadesPerAjuntar(pacientId: string): Promise<FitxaPerAjuntar> {
      const p = await pacientExistent(pacientId)
      const f = await magatzem.obtenirFitxaClinica(pacientId)
      const { id: _i, creatAt: _c, modificatAt, pacientId: _p, ...fitxa } = f
      return {
        pacient: dadesDePacient(p),
        fitxa: f.id ? fitxa : null,
        pacientModificatAt: p.modificatAt,
        fitxaModificatAt: f.id ? modificatAt : null,
      }
    },

    async ajuntarPacients(quedaId: string, treuId: string, dades: { pacient: DadesPacient; fitxa: DadesFitxaClinica }) {
      if (quedaId === treuId) throw new Error('No es pot ajuntar una fitxa amb ella mateixa')
      const queda = await pacientExistent(quedaId)
      const treu = await pacientExistent(treuId)
      if (treu.ajuntadaAmb && treu.ajuntadaAmb.desfetAt === null) throw new Error('Aquesta fitxa ja està ajuntada')
      const fitxaAbans = await magatzem.dadesPerAjuntar(quedaId)
      const at = araIso()

      // Cites repetides (mateix dia, hora i durada): se'n treu una i es guarda per poder-la tornar a posar
      const repetides = citesRepetides(await magatzem.citesDelPacient(quedaId), await magatzem.citesDelPacient(treuId))
      const citesTretes = repetides.map(({ treure }) => ({ id: treure.id, pacientId: treure.pacientId, dades: senseMeta(treure) }))
      await esborrarRegistres(db, 'cites', citesTretes.map((c) => c.id))

      // Primer els episodis (les cites i les sessions hi apunten), després la resta
      const moguts: Ajuntament['moguts'] = { cites: [], episodis: [], sessions: [], addendes: [], valoracions: [] }
      for (const taula of TAULES_MOGUDES) {
        for (const id of await idsDe(taula, treuId)) if (await moure(taula, id, quedaId)) moguts[taula].push(id)
      }

      // La fitxa que es queda, amb les dades triades
      const duplicatsAbans = { queda: queda.revisarDuplicat ?? [], treu: treu.revisarDuplicat ?? [] }
      const sense = (l: string[], x: string) => {
        const r = l.filter((y) => y !== x)
        return r.length > 0 ? { revisarDuplicat: r } : {}
      }
      const { revisarDuplicat: _rq, ...restaQueda } = queda
      await guardarPacient(quedaId, queda.creatAt, { ...restaQueda, ...dades.pacient, arxivat: false, ...sense(duplicatsAbans.queda, treuId) })
      const teFitxa = fitxaAbans.fitxa !== null || (await db.fitxesCliniques.where('pacientId').equals(treuId).count()) > 0
      if (teFitxa) await magatzem.desarFitxaClinica(quedaId, dades.fitxa)

      // La que es treu: arxivada, amb el que cal per desfer-ho
      const ajuntament: Ajuntament = {
        pacientId: quedaId,
        at,
        desfetAt: null,
        moguts,
        citesTretes,
        abans: { pacient: fitxaAbans.pacient, fitxa: fitxaAbans.fitxa },
        despres: { pacient: dades.pacient, fitxa: dades.fitxa },
        duplicatsAbans,
      }
      const { revisarDuplicat: _rt, ...restaTreu } = treu
      await guardarPacient(treuId, treu.creatAt, { ...restaTreu, arxivat: true, ...sense(duplicatsAbans.treu, quedaId), ajuntadaAmb: ajuntament })

      await recalcularTipusVisita(magatzem, [quedaId])
      return {
        cites: moguts.cites.length,
        episodis: moguts.episodis.length,
        sessions: moguts.sessions.length,
        addendes: moguts.addendes.length,
        citesRepetides: citesTretes.length,
      }
    },

    async desferAjuntament(treuId: string) {
      const treu = await pacientExistent(treuId)
      const a = treu.ajuntadaAmb
      if (!a || !esPotDesfer(a, Date.now())) throw new Error('Aquest ajuntament ja no es pot desfer')
      const quedaId = a.pacientId
      // Primer es marca desfet: així ningú (ni un altre dispositiu) no ho torna a moure
      const { revisarDuplicat: _rt, ...restaTreu } = treu
      await guardarPacient(treuId, treu.creatAt, {
        ...restaTreu,
        arxivat: false,
        ...(a.duplicatsAbans.treu.length > 0 ? { revisarDuplicat: a.duplicatsAbans.treu } : {}),
        ajuntadaAmb: { ...a, desfetAt: araIso() },
      })
      // Cada cosa torna a la seva fitxa (si encara és a la que es quedava)
      for (const taula of TAULES_MOGUDES) {
        for (const id of a.moguts[taula]) {
          const r = await db.table(taula).get(id)
          if (r?.pacientId === quedaId) await moure(taula, id, treuId)
        }
      }
      // Les cites repetides que es van treure (amb un id nou: el vell està esborrat)
      for (const c of a.citesTretes) {
        if (!(await db.pacients.get(c.pacientId))) continue
        await guardarCita(nouId(), araIso(), { ...c.dades, pacientId: c.pacientId })
      }
      // Les dades de la que es quedava tornen a ser les d'abans (excepte el que s'hagi editat després)
      const queda = await magatzem.obtenirPacient(quedaId)
      if (queda) {
        const dadesQueda = valorsDesfets(dadesDePacient(queda), a.abans.pacient, a.despres.pacient)
        const dupl = a.duplicatsAbans.queda
        const { revisarDuplicat: _rq, ...restaQueda } = queda
        await guardarPacient(quedaId, queda.creatAt, { ...restaQueda, ...dadesQueda, ...(dupl.length > 0 ? { revisarDuplicat: dupl } : {}) })
        const f = await magatzem.obtenirFitxaClinica(quedaId)
        if (f.id) {
          const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...actual } = f
          const abans = a.abans.fitxa ?? fitxaClinicaBuida()
          await magatzem.desarFitxaClinica(quedaId, valorsDesfets(actual, abans, a.despres.fitxa))
        }
      }
      await recalcularTipusVisita(magatzem, [quedaId, treuId])
    },

    async redirigirAjuntades() {
      let total = 0
      for (const p of await magatzem.llistarPacients()) {
        if (!p.ajuntadaAmb || p.ajuntadaAmb.desfetAt !== null) continue
        const a = await desti(p)
        if (!a) continue
        const moguts = structuredClone(p.ajuntadaAmb.moguts)
        let n = 0
        for (const taula of TAULES_MOGUDES) {
          for (const id of await idsDe(taula, p.id)) {
            if (!(await moure(taula, id, a))) continue
            if (!moguts[taula].includes(id)) moguts[taula].push(id)
            n++
          }
        }
        if (n === 0) continue
        await guardarPacient(p.id, p.creatAt, { ...senseMeta(p), ajuntadaAmb: { ...p.ajuntadaAmb, moguts } })
        await recalcularTipusVisita(magatzem, [a])
        total += n
      }
      return total
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
