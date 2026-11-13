import { describe, expect, it } from 'vitest'
import {
  canvisExploracio,
  compararSessions,
  nomsSecundaris,
  puntsMesUsats,
  resumEscala,
  resumTancament,
  serieEscalaOrl,
  serieEvolucio,
  serieMymop,
  tendencies,
  type SessioEvolucio,
} from './evolucio'
import { mymopBuit } from './escales'
import { nouPuntMarcat, type PuntMarcat } from './puntMarcat'
import { mapaPunts, novaSessio } from './sessio'
import type { Valoracio } from './valoracio'

// Només dades inventades
function sessio(numero: number, dia: string, escala: number | null, punts: PuntMarcat[] = [], extra: Partial<SessioEvolucio> = {}): SessioEvolucio {
  const d = novaSessio({ citaId: `c${numero}`, episodiId: 'e1', numero, iniciAt: `${dia}T10:00:00.000Z` })
  return { ...d, id: `s${numero}`, comEsta: { ...d.comEsta, escala }, punts: mapaPunts(punts), ...extra }
}
const p = (codi: string, tecnica: PuntMarcat['tecnica'] = 'agulla', mapa: PuntMarcat['mapa'] = 'cos') =>
  nouPuntMarcat(codi, 'bilateral', tecnica, mapa)

describe('resum de l\'escala («De 7 a 3 en 6 sessions (−57 %)»)', () => {
  it('de la primera a l\'última amb valor', () => {
    expect(resumEscala([7, 6, 6, 4, 5, 3].map((valor, i) => ({ numero: i + 1, valor })))).toEqual({
      inicial: 7,
      final: 3,
      sessions: 6,
      percentatge: -57,
    })
  })

  it('les sessions sense escala no compten com a inici ni com a final', () => {
    const r = resumEscala([null, 8, null, 4, null].map((valor, i) => ({ numero: i + 1, valor })))
    expect(r).toEqual({ inicial: 8, final: 4, sessions: 3, percentatge: -50 })
  })

  it('si empitjora, el percentatge és positiu; si l\'inicial és 0, no n\'hi ha', () => {
    expect(resumEscala([{ numero: 1, valor: 4 }, { numero: 2, valor: 6 }])?.percentatge).toBe(50)
    expect(resumEscala([{ numero: 1, valor: 0 }, { numero: 2, valor: 2 }])?.percentatge).toBeNull()
  })

  it('amb 0 o 1 sessió amb valor, cap resum', () => {
    expect(resumEscala([])).toBeNull()
    expect(resumEscala([{ numero: 1, valor: 6 }])).toBeNull()
    expect(resumEscala([{ numero: 1, valor: null }, { numero: 2, valor: 5 }, { numero: 3, valor: null }])).toBeNull()
  })
})

describe('sèrie sessió a sessió', () => {
  it('ordena per número i marca els canvis de tractament (sense comptar la palpació)', () => {
    const s = serieEvolucio([
      sessio(3, '2026-09-17', 5, [p('LI4'), p('ST36'), p('PC6')]),
      sessio(1, '2026-09-03', 8, [p('LI4'), p('ST36')]),
      sessio(2, '2026-09-10', 6, [p('LI4'), p('ST36'), p('GB34', 'palpacio')]),
    ])
    expect(s.map((x) => x.numero)).toEqual([1, 2, 3])
    expect(s.map((x) => x.canviTractament)).toEqual([false, false, true])
    expect(s.map((x) => x.punts)).toEqual([2, 2, 3])
    expect(s[0]).toMatchObject({ dia: '2026-09-03', principal: 8, retencio: null, incidencies: false })
  })

  it('la retenció, només si es va fer servir el temporitzador; les incidències', () => {
    const [s] = serieEvolucio([
      sessio(1, '2026-09-03', 8, [], {
        retencio: { iniciAt: '2026-09-03T10:10:00.000Z', minuts: 25 },
        tancar: { recomanacions: '', incidencies: 'Petit hematoma (inventat)', capIncidencia: false },
      }),
    ])
    expect(s).toMatchObject({ retencio: 25, incidencies: true })
  })

  it('cap sessió: sèrie buida; tendències ↑↓ respecte de l\'última amb valor', () => {
    expect(serieEvolucio([])).toEqual([])
    const s = serieEvolucio([8, 6, null, 7, 7].map((v, i) => sessio(i + 1, `2026-09-0${i + 1}`, v)))
    expect(tendencies(s)).toEqual([null, 'baixa', null, 'puja', 'igual'])
  })

  it('el nom dels secundaris és el més recent escrit', () => {
    const a = sessio(1, '2026-09-03', 8)
    const b = sessio(2, '2026-09-10', 6)
    a.comEsta.secundari1 = { nom: 'Insomni', escala: 6 }
    b.comEsta.secundari1 = { nom: 'Insomni (son)', escala: 4 }
    expect(nomsSecundaris([a, b])).toEqual({ secundari1: 'Insomni (son)', secundari2: '' })
  })
})

describe('punts més usats', () => {
  const sessions = [
    sessio(1, '2026-09-03', 8, [p('LI4'), p('ST36'), p('Shenmen', 'llavor', 'orella')]),
    sessio(2, '2026-09-10', 7, [p('LI4'), p('ST36', 'moxa'), p('GB20')]),
    sessio(3, '2026-09-17', 6, [p('LI4'), p('ST36', 'moxa'), p('GB34', 'palpacio')]),
  ]

  it('compta les sessions de cada punt, la primera i l\'última vegada i la tècnica habitual', () => {
    const u = puntsMesUsats(sessions)
    expect(u.map((x) => [x.codi, x.sessions])).toEqual([
      ['LI4', 3],
      ['ST36', 3],
      ['GB20', 1],
      ['Shenmen', 1],
    ])
    expect(u[0]).toMatchObject({ de: 3, primera: { numero: 1, dia: '2026-09-03' }, ultima: { numero: 3, dia: '2026-09-17' }, tecnica: 'agulla' })
    expect(u[1]!.tecnica).toBe('moxa')
    // La palpació no és tractament
    expect(u.some((x) => x.codi === 'GB34')).toBe(false)
  })

  it('filtra pel mapa; sense sessions, cap punt', () => {
    expect(puntsMesUsats(sessions, 'orella').map((x) => x.codi)).toEqual(['Shenmen'])
    expect(puntsMesUsats(sessions, 'cos').map((x) => x.codi)).toEqual(['LI4', 'ST36', 'GB20'])
    expect(puntsMesUsats([])).toEqual([])
  })
})

describe('comparar dues sessions', () => {
  it('punts afegits, trets i mantinguts (amb el canvi de tècnica o de costat), escales i retenció', () => {
    const a = sessio(1, '2026-09-03', 8, [p('LI4'), p('ST36'), p('GB20')], { retencio: { iniciAt: '2026-09-03T10:00:00Z', minuts: 20 } })
    const b = sessio(6, '2026-10-08', 3, [p('LI4'), { ...p('ST36', 'moxa') }, { ...p('PC6'), costat: 'E' }], {
      retencio: { iniciAt: '2026-10-08T10:00:00Z', minuts: 28 },
      tancar: { recomanacions: '', incidencies: 'Mareig lleu (inventat)', capIncidencia: false },
    })
    a.comEsta.secundari1 = { nom: 'Insomni', escala: 7 }
    b.comEsta.secundari1 = { nom: '', escala: 4 }
    const c = compararSessions(a, b)
    expect(c.afegits.map((x) => x.codi)).toEqual(['PC6'])
    expect(c.trets.map((x) => x.codi)).toEqual(['GB20'])
    expect(c.mantinguts.map((x) => [x.despres.codi, x.canviTecnica, x.canviCostat])).toEqual([
      ['LI4', false, false],
      ['ST36', true, false],
    ])
    expect(c.principal).toEqual({ abans: 8, despres: 3, diferencia: -5 })
    expect(c.secundari1).toEqual({ abans: 7, despres: 4, diferencia: -3, nom: 'Insomni' })
    expect(c.secundari2.diferencia).toBeNull()
    expect(c.retencio).toEqual({ abans: 20, despres: 28, diferencia: 8 })
    expect(c.incidencies).toEqual({ abans: '', despres: 'Mareig lleu (inventat)' })
  })

  it('una sessió sense escala: la diferència és null', () => {
    const c = compararSessions(sessio(1, '2026-09-03', null), sessio(2, '2026-09-10', 5))
    expect(c.principal).toEqual({ abans: null, despres: 5, diferencia: null })
  })

  it('exploració: només els camps de la llengua i del pols que han canviat', () => {
    const a = { 'exploracio:llengua': { valors: { cosColor: 'palid' }, altres: 'Igual' }, 'exploracio:pols': { normal: true } }
    const b = { 'exploracio:llengua': { valors: { cosColor: 'vermell' }, altres: 'Igual' }, 'exploracio:pols': { normal: true } }
    const canvis = canvisExploracio(a, b, 'Normal', 'Observacions')
    expect(canvis).toHaveLength(1)
    expect(canvis[0]).toMatchObject({ seccio: expect.stringMatching(/Llengua/i) })
    expect(canvis[0]!.abans).not.toBe(canvis[0]!.despres)
    expect(canvisExploracio(a, a, 'Normal', 'Observacions')).toEqual([])
  })
})

describe('altres escales', () => {
  const sessions = [sessio(1, '2026-09-03', 8), sessio(4, '2026-09-24', 5), sessio(6, '2026-10-08', 3)]
  const versio = (n: number, sessioId: string, thi?: number): Pick<Valoracio, 'versio' | 'sessioId' | 'creadaAt' | 'seccions'> => ({
    versio: n,
    sessioId,
    creadaAt: '2026-09-03T10:00:00Z',
    seccions: thi === undefined ? {} : { 'orl:escales': { valors: { thi: { total: thi } } } },
  })

  it('THI: un punt quan canvia el total, a la sessió de la versió', () => {
    const s = serieEscalaOrl('thi', [versio(2, 's4', 46), versio(1, 's1', 58), versio(3, 's6', 46)], sessions)
    expect(s).toEqual([
      { sessioId: 's1', numero: 1, dia: '2026-09-03', valor: 58 },
      { sessioId: 's4', numero: 4, dia: '2026-09-24', valor: 46 },
    ])
    expect(serieEscalaOrl('dhi', [versio(1, 's1', 58)], sessions)).toEqual([])
    // La 0–10 de símptomes nasals es desa com un número
    const nasal = (n: number, sessioId: string, v: number): Pick<Valoracio, 'versio' | 'sessioId' | 'creadaAt' | 'seccions'> => ({
      versio: n,
      sessioId,
      creadaAt: '2026-09-03T10:00:00Z',
      seccions: { 'orl:escales': { valors: { nasal010: v } } },
    })
    expect(serieEscalaOrl('nasal010', [nasal(1, 's1', 7), nasal(2, 's4', 4)], sessions).map((x) => x.valor)).toEqual([7, 4])
  })

  it('MYMOP: el perfil de les sessions on es va fer', () => {
    const m = { ...mymopBuit(), simptoma1: { nom: 'Dolor', puntuacio: 5 }, benestar: 3 }
    const amb = [{ ...sessions[0]!, mymop: m }, sessions[1]!, { ...sessions[2]!, mymop: { ...m, simptoma1: { nom: 'Dolor', puntuacio: 1 } } }]
    expect(serieMymop(amb).map((x) => [x.numero, x.valor])).toEqual([
      [1, 4],
      [6, 2],
    ])
  })
})

describe('PGIC', () => {
  it('els nivells (1–7) de les sessions on es va fer', async () => {
    const { seriePgic } = await import('./evolucio')
    const s = [sessio(1, '2026-09-03', 8), sessio(2, '2026-09-10', 6), sessio(5, '2026-10-01', 4)]
    s[0]!.pgic = 4
    s[2]!.pgic = 2
    expect(seriePgic(s).map((x) => [x.numero, x.valor])).toEqual([
      [1, 4],
      [5, 2],
    ])
    expect(seriePgic([])).toEqual([])
  })
})

describe('resum en tancar l\'episodi', () => {
  it('sessions, durada, escala inicial i final i els punts més usats', () => {
    const r = resumTancament([
      sessio(1, '2026-09-03', 8, [p('LI4'), p('ST36')]),
      sessio(2, '2026-09-10', 6, [p('LI4'), p('ST36'), p('GB20')]),
      sessio(3, '2026-09-17', 7, [p('LI4')]),
      sessio(4, '2026-10-08', 3, [p('LI4'), p('GB20')]),
    ])
    expect(r).toMatchObject({ sessions: 4, des: '2026-09-03', fins: '2026-10-08', setmanes: 5 })
    expect(r.escala).toEqual({ inicial: 8, final: 3, sessions: 4, percentatge: -63 })
    expect(r.punts.map((x) => [x.codi, x.sessions])).toEqual([
      ['LI4', 4],
      ['GB20', 2],
      ['ST36', 2],
    ])
  })

  it('sense sessions', () => {
    expect(resumTancament([])).toEqual({ sessions: 0, des: null, fins: null, setmanes: 0, escala: null, punts: [] })
  })
})
