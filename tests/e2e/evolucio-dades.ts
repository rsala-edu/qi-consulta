// Episodis inventats amb moltes sessions per a l'evolució (etapa 3C). Es
// creen amb el magatzem de l'app (window.__qiProvesMagatzem, que només existeix
// en desenvolupament i al mode «proves»): les dades passen pel xifratge com
// sempre. Només dades inventades.
import type { Page } from '@playwright/test'

export interface PuntInventat {
  codi: string
  mapa?: 'cos' | 'orella'
  tecnica?: 'agulla' | 'moxa' | 'ventosa' | 'llavor' | 'electro' | 'xinxeta'
  costat?: 'E' | 'D' | 'bilateral'
}

export interface SessioInventada {
  /** «2026-09-09» */
  dia: string
  escala: number | null
  secundari1?: number | null
  secundari2?: number | null
  punts: PuntInventat[]
  retencio?: number | null
  incidencies?: string
  mymop?: { simptoma1: number; simptoma2: number; activitat: number; benestar: number }
  /** PGIC (1–7) */
  pgic?: number
  /** DHI (valoració): es desa a la sessió */
  dhi?: number
  /** Es deixa en curs (no es finalitza) */
  enCurs?: boolean
}

export interface EpisodiInventat {
  pacientId: string
  motiu: string
  noms?: { secundari1?: string; secundari2?: string; mymop?: [string, string, string] }
  sessions: SessioInventada[]
  addenda?: { sessio: number; text: string }
}

/** Crea les cites i les sessions; torna l'id de l'episodi i el de cada sessió */
export async function crearEpisodiInventat(page: Page, e: EpisodiInventat): Promise<{ episodiId: string; sessions: string[] }> {
  return page.evaluate(async (e) => {
    // Tipus mínims del magatzem (aquí no es poden importar)
    type Qualsevol = Record<string, unknown>
    const m = (window as unknown as { __qiProvesMagatzem?: Record<string, (...a: unknown[]) => Promise<Qualsevol>> }).__qiProvesMagatzem
    if (!m) throw new Error('No hi ha el magatzem de proves (cal el mode de desenvolupament o «proves»)')
    const sense = (r: Qualsevol) => {
      const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...d } = r
      return d as Qualsevol
    }
    const ids: string[] = []
    let episodiId = ''
    let valoracio: Qualsevol | null = null
    for (const [i, s] of e.sessions.entries()) {
      const cita = await m.crearCita!({
        pacientId: e.pacientId,
        inici: `${s.dia}T10:00`,
        durada: 60,
        tipus: i === 0 ? 'primera' : 'seguiment',
        estat: 'programada',
        motiu: e.motiu,
        notes: '',
        sessioId: null,
        nouEpisodi: i === 0,
        episodiId: null,
      })
      const sessio = await m.comencarVisita!(cita.id)
      episodiId = sessio.episodiId as string
      const iniciAt = new Date(`${s.dia}T10:05:00`).toISOString()
      const finalAt = new Date(`${s.dia}T10:55:00`).toISOString()
      const inicial = sense(sessio)
      const punts = Object.fromEntries(
        s.punts.map((p) => {
          const mapa = p.mapa ?? 'cos'
          return [
            `${mapa}:${p.codi}`,
            { mapa, codi: p.codi, costat: p.costat ?? 'bilateral', tecnica: p.tecnica ?? (mapa === 'orella' ? 'llavor' : 'agulla'), metode: 'neutre', profunditat: '', temps: '', notes: '' },
          ]
        }),
      )
      const comEsta = inicial.comEsta as Qualsevol
      const dades = {
        ...inicial,
        iniciAt,
        retencio: { iniciAt: s.retencio ? new Date(`${s.dia}T10:20:00`).toISOString() : null, minuts: s.retencio ?? 28 },
        comEsta: {
          ...comEsta,
          canvis: '',
          escala: s.escala,
          secundari1: { nom: e.noms?.secundari1 ?? '', escala: s.secundari1 ?? null },
          secundari2: { nom: e.noms?.secundari2 ?? '', escala: s.secundari2 ?? null },
        },
        mymop: s.mymop
          ? {
              simptoma1: { nom: e.noms?.mymop?.[0] ?? '', puntuacio: s.mymop.simptoma1 },
              simptoma2: { nom: e.noms?.mymop?.[1] ?? '', puntuacio: s.mymop.simptoma2 },
              activitat: { nom: e.noms?.mymop?.[2] ?? '', puntuacio: s.mymop.activitat },
              benestar: s.mymop.benestar,
            }
          : null,
        pgic: s.pgic ?? null,
        punts,
        tancar: { recomanacions: '', incidencies: s.incidencies ?? '', capIncidencia: !s.incidencies },
      }
      await m.actualitzarSessio!(sessio.id, dades, inicial)
      if (!s.enCurs) {
        const tancada = await m.finalitzarSessio!(sessio.id, { retirades: null, motiu: '' })
        // L'hora real d'aquell dia (en finalitzar es posa la d'ara)
        const d = sense(tancada)
        await m.actualitzarSessio!(sessio.id, { ...d, finalAt }, d)
      }
      if (s.dhi !== undefined) {
        const seccions = { 'orl:escales': { valors: { dhi: { total: s.dhi } } } }
        if (!valoracio) {
          valoracio = await m.desarValoracio!({ episodiId, versio: 1, sessioId: sessio.id, creadaAt: iniciAt, seccions, orl: true })
        } else {
          const nova = sense(await m.revisarValoracio!(episodiId, sessio.id))
          valoracio = await m.desarValoracio!({ ...nova, seccions: { ...(nova.seccions as Qualsevol), ...seccions } }, nova)
        }
      }
      ids.push(sessio.id as string)
    }
    if (e.addenda) await m.afegirAddenda!(ids[e.addenda.sessio - 1], e.addenda.text)
    return { episodiId, sessions: ids }
  }, e)
}

/** L'id d'un pacient pel nom complet */
export async function idPacient(page: Page, nom: string): Promise<string> {
  return page.evaluate(async (nom) => {
    const m = (window as unknown as { __qiProvesMagatzem: { llistarPacients(): Promise<{ id: string; nom: string; llinatges: string }[]> } }).__qiProvesMagatzem
    const p = (await m.llistarPacients()).find((x) => `${x.nom} ${x.llinatges}` === nom)
    if (!p) throw new Error(`No hi ha cap pacient ${nom}`)
    return p.id
  }, nom)
}

const cervical = (extra: PuntInventat[] = []): PuntInventat[] => [
  { codi: 'GB20' },
  { codi: 'GB21' },
  { codi: 'SI3', costat: 'bilateral' },
  { codi: 'BL10' },
  { codi: 'LI4' },
  { codi: 'TF4', mapa: 'orella' },
  { codi: 'AH13', mapa: 'orella' },
  ...extra,
]

/**
 * Cervicàlgia inventada: 8 sessions setmanals (setembre i octubre de 2026),
 * l'escala baixa de 8 a 3 amb un rebrot a la cinquena; dos símptomes
 * secundaris; MYMOP a la 1a i a la 5a; DHI a la 1a, la 5a i la 8a; una
 * incidència i una addenda.
 */
export function cervicalgiaInventada(pacientId: string): EpisodiInventat {
  const sense = (codi: string, l: PuntInventat[]) => l.filter((p) => p.codi !== codi)
  return {
    pacientId,
    motiu: 'Cervicàlgia',
    noms: { secundari1: 'Insomni', secundari2: 'Mal de cap', mymop: ['Dolor de coll', 'Insomni', 'Treballar a l\'ordinador'] },
    sessions: [
      { dia: '2026-09-09', escala: 8, secundari1: 7, secundari2: 6, punts: cervical(), retencio: 20, mymop: { simptoma1: 5, simptoma2: 4, activitat: 5, benestar: 4 }, pgic: 4, dhi: 46 },
      { dia: '2026-09-16', escala: 7, secundari1: 7, secundari2: 6, punts: cervical([{ codi: 'ST36' }]), retencio: 25 },
      { dia: '2026-09-23', escala: 6, secundari1: 6, secundari2: 5, punts: cervical([{ codi: 'ST36' }]), retencio: 25 },
      { dia: '2026-09-30', escala: 5, secundari1: 5, secundari2: 4, punts: [...sense('GB21', cervical([{ codi: 'ST36' }])), { codi: 'TE5' }], retencio: 28 },
      {
        dia: '2026-10-07',
        escala: 7,
        secundari1: 6,
        secundari2: 6,
        punts: [...sense('GB21', cervical([{ codi: 'ST36' }, { codi: 'LR3' }, { codi: 'GB34', tecnica: 'moxa' }])), { codi: 'TE5' }],
        retencio: 28,
        mymop: { simptoma1: 4, simptoma2: 4, activitat: 4, benestar: 3 },
        pgic: 3,
        dhi: 34,
        incidencies: 'Petit hematoma a GB21 (inventat)',
      },
      { dia: '2026-10-14', escala: 5, secundari1: 4, secundari2: 4, punts: [...sense('GB21', cervical([{ codi: 'ST36' }, { codi: 'LR3' }])), { codi: 'TE5' }], retencio: 28 },
      { dia: '2026-10-21', escala: 4, secundari1: 4, secundari2: 3, punts: [...sense('GB21', cervical([{ codi: 'ST36' }])), { codi: 'TE5' }], retencio: 25 },
      { dia: '2026-10-28', escala: 3, secundari1: 3, secundari2: 2, punts: [...sense('GB21', cervical([{ codi: 'ST36' }])), { codi: 'TE5' }], retencio: 25, pgic: 2, dhi: 22 },
    ],
    addenda: { sessio: 5, text: 'Ha trucat: el coll li fa menys mal (inventat)' },
  }
}
