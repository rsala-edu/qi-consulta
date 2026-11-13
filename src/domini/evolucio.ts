// Evolució d'un episodi (etapa 3C): tot es calcula a partir de les sessions,
// dels punts i de les escales que ja hi ha (no hi ha cap taula nova). Sense
// React ni textos: les pantalles hi posen el format.

import { resumSeccio } from '../cataleg/motor'
import { EXPLORACIO } from '../cataleg/exploracio'
import type { Camp, DadesSeccio, DadesSeccions, Seccio } from '../cataleg/tipus'
import { diaDe } from './cita'
import { perfilMymop } from './escales'
import type { PuntMarcat, Tecnica } from './puntMarcat'
import { diferenciaPunts, llistaPunts, type Sessio } from './sessio'
import type { Valoracio } from './valoracio'

/** Les dades d'una sessió que fan servir els gràfics, la cronologia i la comparació */
export type SessioEvolucio = Pick<
  Sessio,
  'id' | 'episodiId' | 'numero' | 'iniciAt' | 'estat' | 'comEsta' | 'punts' | 'retencio' | 'tancar' | 'mymop' | 'exploracio'
>

/** Les sessions de l'episodi en ordre (número i, si n'hi ha dos d'iguals, hora) */
export function ordenades<S extends Pick<Sessio, 'numero' | 'iniciAt'>>(sessions: readonly S[]): S[] {
  return [...sessions].sort((a, b) => a.numero - b.numero || a.iniciAt.localeCompare(b.iniciAt))
}

/** El dia local d'una hora ISO («2026-09-09») */
const dia = (iso: string) => diaDe(new Date(iso))

/** Punts de tractament (els dolorosos a la palpació són exploració, no tractament) */
export function puntsTractament(punts: Sessio['punts']): PuntMarcat[] {
  return llistaPunts(punts).filter((p) => p.tecnica !== 'palpacio')
}

const sensePalpacio = (punts: Sessio['punts']): Sessio['punts'] =>
  Object.fromEntries(Object.entries(punts).filter(([, p]) => p.tecnica !== 'palpacio'))

/** Minuts de retenció (null si no es van posar agulles amb el temporitzador) */
export const minutsRetencio = (s: Pick<Sessio, 'retencio'>): number | null => (s.retencio.iniciAt ? s.retencio.minuts : null)

// --- Sèrie sessió a sessió ------------------------------------------------------

export interface PuntSerie {
  sessioId: string
  numero: number
  /** Dia de la sessió («2026-09-03») */
  dia: string
  principal: number | null
  secundari1: number | null
  secundari2: number | null
  /** Punts de tractament */
  punts: number
  retencio: number | null
  /** S'han afegit o tret punts respecte de la sessió anterior */
  canviTractament: boolean
  incidencies: boolean
}

export function serieEvolucio(sessions: readonly SessioEvolucio[]): PuntSerie[] {
  const llista = ordenades(sessions)
  return llista.map((s, i) => {
    const anterior = llista[i - 1]
    const dif = anterior ? diferenciaPunts(sensePalpacio(s.punts), sensePalpacio(anterior.punts)) : null
    return {
      sessioId: s.id,
      numero: s.numero,
      dia: dia(s.iniciAt),
      principal: s.comEsta.escala,
      secundari1: s.comEsta.secundari1.escala,
      secundari2: s.comEsta.secundari2.escala,
      punts: puntsTractament(s.punts).length,
      retencio: minutsRetencio(s),
      canviTractament: !!dif && dif.mes + dif.menys > 0,
      incidencies: s.tancar.incidencies.trim() !== '',
    }
  })
}

/** El nom de cada símptoma secundari: el més recent que s'hi ha escrit */
export function nomsSecundaris(sessions: readonly SessioEvolucio[]): { secundari1: string; secundari2: string } {
  const nom = (k: 'secundari1' | 'secundari2') =>
    ordenades(sessions)
      .map((s) => s.comEsta[k].nom.trim())
      .filter(Boolean)
      .at(-1) ?? ''
  return { secundari1: nom('secundari1'), secundari2: nom('secundari2') }
}

// --- Resum: «De 7 a 3 en 6 sessions (−57 %)» -----------------------------------

export interface ResumEscala {
  inicial: number
  final: number
  /** Sessions de la primera a l'última amb valor (totes dues incloses) */
  sessions: number
  /** Canvi en percentatge respecte de l'inicial (arrodonit); null si l'inicial és 0 */
  percentatge: number | null
}

const arrodonir = (x: number) => Math.sign(x) * Math.round(Math.abs(x))

/** null si no hi ha almenys dues sessions amb valor */
export function resumEscala(serie: readonly { numero: number; valor: number | null }[]): ResumEscala | null {
  const amb = serie.filter((p): p is { numero: number; valor: number } => p.valor !== null)
  const primer = amb[0]
  const darrer = amb.at(-1)
  if (!primer || !darrer || amb.length < 2) return null
  return {
    inicial: primer.valor,
    final: darrer.valor,
    sessions: darrer.numero - primer.numero + 1,
    // Arrodonit lluny del zero (−62,5 → −63), igual per a la millora i per a l'empitjorament
    percentatge: primer.valor === 0 ? null : arrodonir(((darrer.valor - primer.valor) / primer.valor) * 100),
  }
}

// --- Altres escales: THI, DHI i SNOT-22 (valoració) i MYMOP (sessió) --------------

export interface PuntEscala {
  sessioId: string | null
  numero: number
  dia: string
  valor: number
}

export type IdEscalaEvolucio = 'thi' | 'dhi' | 'snot22' | 'mymop'

/**
 * Cada versió de la valoració porta les escales ORL (una revisió copia les
 * d'abans): hi ha un punt nou a la primera versió amb valor i quan el total
 * canvia. Cada punt va a la sessió on es va fer la versió.
 */
export function serieEscalaOrl(
  id: 'thi' | 'dhi' | 'snot22',
  valoracions: readonly Pick<Valoracio, 'versio' | 'sessioId' | 'creadaAt' | 'seccions'>[],
  sessions: readonly SessioEvolucio[],
): PuntEscala[] {
  const perId = new Map(sessions.map((s) => [s.id, s]))
  const resultat: PuntEscala[] = []
  let abans: number | null = null
  for (const v of [...valoracions].sort((a, b) => a.versio - b.versio)) {
    const valor = (v.seccions['orl:escales']?.valors?.[id] as { total?: unknown } | undefined)?.total
    if (typeof valor !== 'number' || valor === abans) continue
    abans = valor
    const s = v.sessioId ? perId.get(v.sessioId) : undefined
    resultat.push({ sessioId: s?.id ?? null, numero: s?.numero ?? 1, dia: dia(s?.iniciAt ?? v.creadaAt), valor })
  }
  return resultat
}

/** El perfil MYMOP (0–6, 0 és el millor) de les sessions on es va fer */
export function serieMymop(sessions: readonly SessioEvolucio[]): PuntEscala[] {
  return ordenades(sessions).flatMap((s) => {
    const valor = perfilMymop(s.mymop)
    return valor === null ? [] : [{ sessioId: s.id, numero: s.numero, dia: dia(s.iniciAt), valor }]
  })
}

// --- Punts més usats ------------------------------------------------------------

export type FiltreMapa = 'cos' | 'orella' | 'tots'

export interface UsPunt {
  /** «mapa:codi» */
  clau: string
  mapa: PuntMarcat['mapa']
  codi: string
  /** Sessions on es va fer servir */
  sessions: number
  /** Sessions comptades (les de l'àmbit triat) */
  de: number
  primera: { numero: number; dia: string }
  ultima: { numero: number; dia: string }
  /** La tècnica que s'hi ha fet més vegades (si n'hi ha dues empatades, la més recent) */
  tecnica: Tecnica
}

/** Els punts de tractament per nombre de sessions (més usats primer; empat: per codi) */
export function puntsMesUsats(sessions: readonly SessioEvolucio[], filtre: FiltreMapa = 'tots'): UsPunt[] {
  const llista = [...sessions].sort((a, b) => a.iniciAt.localeCompare(b.iniciAt))
  const perClau = new Map<string, UsPunt & { tecniques: Map<Tecnica, { n: number; darrera: number }> }>()
  llista.forEach((s, i) => {
    for (const p of puntsTractament(s.punts)) {
      if (filtre !== 'tots' && p.mapa !== filtre) continue
      const clau = `${p.mapa}:${p.codi}`
      const quan = { numero: s.numero, dia: dia(s.iniciAt) }
      const u = perClau.get(clau) ?? {
        clau,
        mapa: p.mapa,
        codi: p.codi,
        sessions: 0,
        de: llista.length,
        primera: quan,
        ultima: quan,
        tecnica: p.tecnica,
        tecniques: new Map(),
      }
      u.sessions++
      u.ultima = quan
      const t = u.tecniques.get(p.tecnica) ?? { n: 0, darrera: i }
      u.tecniques.set(p.tecnica, { n: t.n + 1, darrera: i })
      perClau.set(clau, u)
    }
  })
  return [...perClau.values()]
    .map(({ tecniques, ...u }) => ({
      ...u,
      tecnica: [...tecniques.entries()].sort((a, b) => b[1].n - a[1].n || b[1].darrera - a[1].darrera)[0]![0],
    }))
    .sort((a, b) => b.sessions - a.sessions || a.codi.localeCompare(b.codi, 'ca', { numeric: true }))
}

// --- Comparar dues sessions -------------------------------------------------------

export interface PuntMantingut {
  abans: PuntMarcat
  despres: PuntMarcat
  canviTecnica: boolean
  canviCostat: boolean
}

export interface DiferenciaValor {
  abans: number | null
  despres: number | null
  /** despres − abans (null si en falta un) */
  diferencia: number | null
}

const diferencia = (abans: number | null, despres: number | null): DiferenciaValor => ({
  abans,
  despres,
  diferencia: abans === null || despres === null ? null : despres - abans,
})

export interface ComparacioSessions {
  afegits: PuntMarcat[]
  trets: PuntMarcat[]
  mantinguts: PuntMantingut[]
  principal: DiferenciaValor
  secundari1: DiferenciaValor & { nom: string }
  secundari2: DiferenciaValor & { nom: string }
  retencio: DiferenciaValor
  incidencies: { abans: string; despres: string }
}

const perCodi = (a: PuntMarcat, b: PuntMarcat) => a.mapa.localeCompare(b.mapa) || a.codi.localeCompare(b.codi, 'ca', { numeric: true })

/** Què ha canviat d'`a` (la més antiga) a `b` */
export function compararSessions(a: SessioEvolucio, b: SessioEvolucio): ComparacioSessions {
  const pa = new Map(puntsTractament(a.punts).map((p) => [`${p.mapa}:${p.codi}`, p]))
  const pb = new Map(puntsTractament(b.punts).map((p) => [`${p.mapa}:${p.codi}`, p]))
  const nomSec = (k: 'secundari1' | 'secundari2') => b.comEsta[k].nom.trim() || a.comEsta[k].nom.trim()
  return {
    afegits: [...pb].filter(([k]) => !pa.has(k)).map(([, p]) => p).sort(perCodi),
    trets: [...pa].filter(([k]) => !pb.has(k)).map(([, p]) => p).sort(perCodi),
    mantinguts: [...pb]
      .filter(([k]) => pa.has(k))
      .map(([k, despres]) => {
        const abans = pa.get(k)!
        return { abans, despres, canviTecnica: abans.tecnica !== despres.tecnica, canviCostat: abans.costat !== despres.costat }
      })
      .sort((x, y) => perCodi(x.despres, y.despres)),
    principal: diferencia(a.comEsta.escala, b.comEsta.escala),
    secundari1: { ...diferencia(a.comEsta.secundari1.escala, b.comEsta.secundari1.escala), nom: nomSec('secundari1') },
    secundari2: { ...diferencia(a.comEsta.secundari2.escala, b.comEsta.secundari2.escala), nom: nomSec('secundari2') },
    retencio: diferencia(minutsRetencio(a), minutsRetencio(b)),
    incidencies: { abans: a.tancar.incidencies.trim(), despres: b.tancar.incidencies.trim() },
  }
}

export interface CanviExploracio {
  /** «Llengua», «Pols» */
  seccio: string
  camp: string
  abans: string
  despres: string
}

/** Text d'un camp d'una secció (el mateix resum que les capçaleres plegades) */
function textCamp(s: Seccio, c: Camp, d: DadesSeccio | undefined): string {
  const v = d?.valors?.[c.id]
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return ''
  return resumSeccio({ ...s, camps: [c] }, { valors: { [c.id]: v } }, '')
}

/**
 * Llengua i pols: només els camps que han canviat (i «Normal» i les
 * observacions, si han canviat). `textNormal`: com es diu «Normal».
 */
export function canvisExploracio(a: DadesSeccions, b: DadesSeccions, textNormal: string, textAltres: string): CanviExploracio[] {
  const canvis: CanviExploracio[] = []
  for (const s of EXPLORACIO.seccions.filter((x) => x.id === 'exploracio:llengua' || x.id === 'exploracio:pols')) {
    const [da, db] = [a[s.id], b[s.id]]
    const afegir = (camp: string, abans: string, despres: string) => abans !== despres && canvis.push({ seccio: s.ca, camp, abans, despres })
    afegir(textNormal, da?.normal ? textNormal : '', db?.normal ? textNormal : '')
    for (const c of s.camps) afegir(c.ca, textCamp(s, c, da), textCamp(s, c, db))
    afegir(textAltres, da?.altres?.trim() ?? '', db?.altres?.trim() ?? '')
  }
  return canvis
}

// --- Cronologia i tancament ---------------------------------------------------------

export type Tendencia = 'puja' | 'baixa' | 'igual' | null

/** L'escala principal respecte de l'última sessió anterior que en té */
export function tendencies(serie: readonly PuntSerie[]): Tendencia[] {
  let abans: number | null = null
  return serie.map((p) => {
    if (p.principal === null) return null
    const t: Tendencia = abans === null ? null : p.principal > abans ? 'puja' : p.principal < abans ? 'baixa' : 'igual'
    abans = p.principal
    return t
  })
}

export interface ResumTancament {
  sessions: number
  /** Primer i últim dia de sessió */
  des: string | null
  fins: string | null
  /** Setmanes entre la primera i l'última sessió (arrodonides; 0 si és el mateix dia) */
  setmanes: number
  escala: ResumEscala | null
  /** Fins a 3, amb el nombre de sessions */
  punts: UsPunt[]
}

export function resumTancament(sessions: readonly SessioEvolucio[]): ResumTancament {
  const llista = ordenades(sessions)
  const primera = llista[0]
  const darrera = llista.at(-1)
  const des = primera ? dia(primera.iniciAt) : null
  const fins = darrera ? dia(darrera.iniciAt) : null
  const dies = des && fins ? Math.round((Date.parse(fins) - Date.parse(des)) / 86_400_000) : 0
  return {
    sessions: llista.length,
    des,
    fins,
    setmanes: Math.round(dies / 7),
    escala: resumEscala(serieEvolucio(llista).map((p) => ({ numero: p.numero, valor: p.principal }))),
    punts: puntsMesUsats(llista).slice(0, 3),
  }
}
