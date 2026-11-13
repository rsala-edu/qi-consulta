// Regles de la visita (etapa 3A). Només dades inventades.
import { describe, expect, it } from 'vitest'
import { migracioEpisodis, episodisActius, idEpisodiDeCita } from './episodi'
import { nouPuntMarcat } from './puntMarcat'
import {
  agullesDelsPunts,
  agullesPosades,
  agullesQuadren,
  copiarTractament,
  diferenciaPunts,
  editableFins,
  esquemaDadesSessio,
  esEditable,
  accionsRetencio as A,
  estatRetencio,
  formatTemps,
  iniciEquivalent,
  mapaPunts,
  novaSessio,
  tempsRestant,
  tramsRetencio,
} from './sessio'

const sessio = () => novaSessio({ citaId: 'c1', episodiId: 'e1', numero: 1, iniciAt: '2026-11-04T16:00:00.000Z' })

describe('episodis', () => {
  it('migració: un episodi per pacient amb el motiu de la primera visita, i un altre a partir de cada «Nou episodi»', () => {
    const cita = (id: string, pacientId: string, inici: string, motiu = '', nouEpisodi = false) => ({ id, pacientId, inici, motiu, nouEpisodi, episodiId: null })
    const r = migracioEpisodis([
      cita('c2', 'p1', '2026-10-10T10:00'),
      cita('c1', 'p1', '2026-10-01T10:00', 'Lumbàlgia'),
      cita('c3', 'p1', '2026-10-20T10:00', 'Acúfens', true),
      cita('c4', 'p1', '2026-10-27T10:00'),
      cita('c5', 'p2', '2026-10-05T09:00'),
    ])
    expect(r.episodis.map((e) => [e.id, e.pacientId, e.motiu, e.dataInici])).toEqual([
      [idEpisodiDeCita('c1'), 'p1', 'Lumbàlgia', '2026-10-01'],
      [idEpisodiDeCita('c3'), 'p1', 'Acúfens', '2026-10-20'],
      [idEpisodiDeCita('c5'), 'p2', 'Primera visita', '2026-10-05'],
    ])
    expect(r.assignacions).toEqual([
      { citaId: 'c1', episodiId: 'episodi-c1' },
      { citaId: 'c2', episodiId: 'episodi-c1' },
      { citaId: 'c3', episodiId: 'episodi-c3' },
      { citaId: 'c4', episodiId: 'episodi-c3' },
      { citaId: 'c5', episodiId: 'episodi-c5' },
    ])
    // Dues vegades (dos dispositius): els mateixos ids
    expect(migracioEpisodis([cita('c1', 'p1', '2026-10-01T10:00')]).episodis[0]!.id).toBe('episodi-c1')
  })

  it('les cites que ja tenen episodi no es toquen', () => {
    const r = migracioEpisodis([{ id: 'c1', pacientId: 'p1', inici: '2026-10-01T10:00', motiu: '', nouEpisodi: false, episodiId: 'e9' }])
    expect(r).toEqual({ episodis: [], assignacions: [] })
  })

  it('episodis actius, del més recent al més antic', () => {
    const e = (id: string, dataInici: string, estat: 'actiu' | 'alta') => ({ id, dataInici, estat })
    expect(episodisActius([e('a', '2026-01-01', 'actiu'), e('b', '2026-03-01', 'alta'), e('c', '2026-02-01', 'actiu')]).map((x) => x.id)).toEqual(['c', 'a'])
  })
})

describe('tractament', () => {
  const anteriors = mapaPunts([nouPuntMarcat('LI4', 'bilateral', 'agulla'), { ...nouPuntMarcat('TF4', 'E', 'llavor', 'orella'), notes: 'inventat' }])
  const actuals = mapaPunts([nouPuntMarcat('ST36', 'D', 'moxa')])

  it('copiar el de l\'última sessió: tots els punts amb el costat, la tècnica i els paràmetres; substituir o afegir', () => {
    const substituit = copiarTractament(actuals, anteriors, true)
    expect(substituit).toEqual(anteriors)
    expect(substituit['orella:TF4']!.notes).toBe('inventat')
    // És una còpia: canviar-la no canvia l'anterior
    substituit['cos:LI4']!.costat = 'E'
    expect(anteriors['cos:LI4']!.costat).toBe('bilateral')
    expect(Object.keys(copiarTractament(actuals, anteriors, false)).sort()).toEqual(['cos:LI4', 'cos:ST36', 'orella:TF4'])
  })

  it('respecte de l\'última sessió: punts de més i de menys', () => {
    expect(diferenciaPunts({ ...anteriors, ...actuals }, anteriors)).toEqual({ mes: 1, menys: 0 })
    expect(diferenciaPunts(actuals, anteriors)).toEqual({ mes: 1, menys: 2 })
  })
})

describe('control d\'agulles', () => {
  it('compten els punts amb agulla; els bilaterals, com a 2', () => {
    const punts = mapaPunts([
      nouPuntMarcat('LI4', 'bilateral', 'agulla'),
      nouPuntMarcat('ST36', 'D', 'agulla'),
      nouPuntMarcat('SP6', 'bilateral', 'moxa'),
      nouPuntMarcat('TF4', 'E', 'agulla', 'orella'),
    ])
    expect(agullesDelsPunts(punts)).toBe(4)
    const s = { ...sessio(), punts }
    expect(agullesPosades(s)).toBe(4)
    // Corregides a mà
    expect(agullesPosades({ ...s, agulles: { ...s.agulles, posades: 6 } })).toBe(6)
  })

  it('no quadra: cal el motiu per finalitzar', () => {
    const s = { ...sessio(), punts: mapaPunts([nouPuntMarcat('LI4', 'bilateral', 'agulla')]) }
    expect(agullesQuadren(s, 2, '')).toBe(true)
    expect(agullesQuadren(s, 1, '')).toBe(false)
    expect(agullesQuadren(s, 1, 'agulla semipermanent')).toBe(true)
  })
})

describe('temporitzador', () => {
  it('es calcula a partir de l\'hora d\'inici (no amb un comptador)', () => {
    const r = { iniciAt: '2026-11-04T16:00:00.000Z', minuts: 28 }
    const inici = Date.parse(r.iniciAt)
    expect(tempsRestant({ iniciAt: null, minuts: 28 }, inici)).toBeNull()
    expect(tempsRestant(r, inici)).toBe(28 * 60_000)
    // La pantalla s'apaga 10 minuts: en tornar, en queden 18
    expect(tempsRestant(r, inici + 10 * 60_000)).toBe(18 * 60_000)
    expect(tempsRestant(r, inici + 30 * 60_000)).toBeLessThan(0)
    expect(formatTemps(28 * 60_000)).toBe('28:00')
    expect(formatTemps(61_500)).toBe('1:02')
    expect(formatTemps(-5_000)).toBe('0:00')
  })

  it('A7: pausa, continuar, ±1 min, aturar, tornar a començar; el temps surt dels trams', () => {
    const t0 = Date.parse('2026-11-04T16:00:00.000Z')
    const m = (min: number) => t0 + min * 60_000
    const iso = (min: number) => new Date(m(min)).toISOString()
    let r = sessio().retencio
    expect(estatRetencio(r, m(0))).toBe('perComencar')

    r = A.comencar(r, iso(0))
    expect(estatRetencio(r, m(5))).toBe('enMarxa')
    expect(iniciEquivalent(r, m(5))).toBe(iso(0))

    // Pausa als 10 min: no corre; el registre de l'app, null
    r = A.pausar(r, iso(10))
    expect(estatRetencio(r, m(15))).toBe('pausa')
    expect(tempsRestant(r, m(15))).toBe(18 * 60_000)
    expect(iniciEquivalent(r, m(15))).toBeNull()

    // Continua als 15: l'inici equivalent és 5 min més tard
    r = A.continuar(r, iso(15))
    expect(tempsRestant(r, m(20))).toBe(13 * 60_000)
    expect(iniciEquivalent(r, m(20))).toBe(iso(5))

    // +1 i −1 minut, entre 1 i 120
    expect(tempsRestant(A.minuts(r, 1), m(20))).toBe(14 * 60_000)
    expect(A.minuts({ ...r, minuts: 1 }, -1).minuts).toBe(1)
    expect(A.minuts({ ...r, minuts: 120 }, 1).minuts).toBe(120)

    // S'acaba als 33 (28 en marxa)
    expect(estatRetencio(r, m(33))).toBe('acabada')
    expect(iniciEquivalent(r, m(33))).toBe(iso(5))

    // Aturar abans d'hora: aturada, sense registre; continuar ho desfà
    const aturada = A.aturar(r, iso(20))
    expect(estatRetencio(aturada, m(40))).toBe('aturada')
    expect(iniciEquivalent(aturada, m(40))).toBeNull()
    expect(tempsRestant(aturada, m(40))).toBe(13 * 60_000)
    const represa = A.continuar(aturada, iso(40))
    expect(estatRetencio(represa, m(41))).toBe('enMarxa')
    expect(tempsRestant(represa, m(41))).toBe(12 * 60_000)

    // Tornar a començar: els minuts sencers, i les estones d'abans es conserven
    const nova = A.tornarAComencar(r, iso(25))
    expect(tempsRestant(nova, m(25))).toBe(28 * 60_000)
    expect(iniciEquivalent(nova, m(26))).toBe(iso(25))
    expect(tramsRetencio(nova)).toEqual([
      { inici: iso(0), fi: iso(10) },
      { inici: iso(15), fi: iso(25) },
      { inici: iso(25), fi: null, reinici: true },
    ])
    expect(nova.iniciAt).toBe(iso(0))
  })

  it('A7: les sessions d\'abans (sense trams) continuen igual, i l\'esquema les accepta', () => {
    const vella = { iniciAt: '2026-11-04T16:00:00.000Z', minuts: 28 }
    const t0 = Date.parse(vella.iniciAt)
    expect(tramsRetencio(vella)).toEqual([{ inici: vella.iniciAt, fi: null }])
    expect(estatRetencio(vella, t0 + 60_000)).toBe('enMarxa')
    expect(iniciEquivalent(vella, t0 + 60_000)).toBe(vella.iniciAt)
    expect(esquemaDadesSessio.parse({ ...sessio(), retencio: vella }).retencio).toEqual(vella)
  })
})

describe('integritat', () => {
  it('una sessió tancada es pot editar 24 hores; després, només addendes', () => {
    const tancada = { ...sessio(), estat: 'tancada' as const, finalAt: '2026-11-04T16:20:00.000Z' }
    const fi = Date.parse(tancada.finalAt)
    expect(editableFins(tancada)?.toISOString()).toBe('2026-11-05T16:20:00.000Z')
    expect(esEditable(tancada, fi + 23 * 3_600_000)).toBe(true)
    expect(esEditable(tancada, fi + 24 * 3_600_000)).toBe(false)
    expect(esEditable(sessio(), fi + 100 * 3_600_000)).toBe(true)
  })
})
