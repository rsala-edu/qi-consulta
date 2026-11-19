import { describe, expect, it } from 'vitest'
import { ambMajuscula, canviarPla, esquemaDadesEpisodi, nomEpisodi, nouEpisodi, PLA_BUIT, revisioCalculada } from './episodi'

describe('data de revisió del pla', () => {
  it('es calcula a partir de la freqüència i les sessions, des del dia d\'inici', () => {
    expect(revisioCalculada({ sessions: 8, frequencia: 'setmanal' }, '2026-11-02')).toBe('2026-12-28')
    expect(revisioCalculada({ sessions: 8, frequencia: 'dosSetmana' }, '2026-11-02')).toBe('2026-11-30')
    expect(revisioCalculada({ sessions: 3, frequencia: 'dosSetmana' }, '2026-11-02')).toBe('2026-11-16')
    expect(revisioCalculada({ sessions: 4, frequencia: 'quinzenal' }, '2026-11-02')).toBe('2026-12-28')
    expect(revisioCalculada({ sessions: 3, frequencia: 'mensual' }, '2026-11-02')).toBe('2027-02-02')
    expect(revisioCalculada({ sessions: 1, frequencia: 'mensual' }, '2027-01-31')).toBe('2027-02-28')
    expect(revisioCalculada({ sessions: null, frequencia: 'setmanal' }, '2026-11-02')).toBeNull()
    expect(revisioCalculada({ sessions: 8, frequencia: null }, '2026-11-02')).toBeNull()
  })

  it('es recalcula sola fins que la doctora la canvia a mà; si l\'esborra, torna a ser automàtica', () => {
    const inici = '2026-11-02'
    let pla = canviarPla(PLA_BUIT, { sessions: 8 }, inici)
    expect(pla.revisio).toBeNull()
    pla = canviarPla(pla, { frequencia: 'setmanal' }, inici)
    expect(pla).toMatchObject({ revisio: '2026-12-28', revisioManual: false })
    pla = canviarPla(pla, { sessions: 10 }, inici)
    expect(pla.revisio).toBe('2027-01-11')
    // A mà: ja no es toca
    pla = canviarPla(pla, { revisio: '2027-01-20' }, inici)
    expect(pla.revisioManual).toBe(true)
    pla = canviarPla(pla, { sessions: 4, frequencia: 'mensual' }, inici)
    expect(pla.revisio).toBe('2027-01-20')
    // Esborrada: torna a calcular-se
    pla = canviarPla(pla, { revisio: null }, inici)
    expect(pla).toMatchObject({ revisio: '2027-03-02', revisioManual: false })
  })

  it('els plans d\'abans: si ja tenien data, la va posar la doctora (no es recalcula); si no, automàtica', () => {
    const vell = (revisio: string | null) =>
      esquemaDadesEpisodi.parse({ ...nouEpisodi('lumbàlgia', '2026-11-02'), pla: { sessions: 8, frequencia: 'setmanal', objectius: '', tecniques: [], revisio } }).pla
    expect(vell('2026-12-01')?.revisioManual).toBe(true)
    expect(vell(null)?.revisioManual).toBe(false)
  })
})

describe('motiu de l\'episodi', () => {
  it('la primera lletra sempre en majúscula, en desar-lo i en mostrar-lo', () => {
    expect(ambMajuscula('  lumbàlgia crònica ')).toBe('Lumbàlgia crònica')
    expect(ambMajuscula('àcufens')).toBe('Àcufens')
    expect(ambMajuscula('')).toBe('')
    expect(nouEpisodi('cefalea', '2026-11-02').motiu).toBe('Cefalea')
    expect(esquemaDadesEpisodi.parse({ ...nouEpisodi('x', '2026-11-02'), motiu: 'insomni' }).motiu).toBe('Insomni')
    expect(nomEpisodi({ motiu: 'dolor d\'espatlla' })).toBe('Dolor d\'espatlla')
    expect(nomEpisodi({ motiu: '' }, ['', 'vertigen'])).toBe('Vertigen')
  })
})
