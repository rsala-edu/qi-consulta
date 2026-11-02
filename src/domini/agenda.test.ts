import { describe, expect, it } from 'vitest'
import {
  avisHorari,
  diesMinicalendari,
  esquemaHorari,
  HORARI_PER_DEFECTE as H,
  minutInicial,
  rangGraella,
  sumarMesos,
  trancaDeQuart,
  vistaPerDefecte,
} from './agenda'

// Dimarts 3 de novembre de 2026 (dates inventades)
const DIMARTS = '2026-11-03'

describe('horari de consulta', () => {
  it('per defecte, de 9 a 20, de dilluns a divendres', () => {
    expect(H).toEqual({ inici: 540, fi: 1200, dies: [1, 2, 3, 4, 5] })
    expect(esquemaHorari.safeParse({ inici: 600, fi: 540, dies: [] }).success).toBe(false)
  })

  it('la graella mostra l\'horari amb 30 minuts de marge i s\'amplia per a les cites de fora', () => {
    expect(rangGraella(H, [])).toEqual({ inici: 510, fi: 1230 })
    const cites = [
      { inici: `${DIMARTS}T07:40`, durada: 40 },
      { inici: `${DIMARTS}T21:00`, durada: 60 },
    ]
    expect(rangGraella(H, cites)).toEqual({ inici: 7 * 60 + 30, fi: 22 * 60 })
  })

  it('avisa (sense impedir-ho) d\'una cita en dia tancat, no laborable o fora d\'horari', () => {
    const tancats = new Set(['2026-11-04'])
    expect(avisHorari({ inici: `${DIMARTS}T10:00`, durada: 40 }, H, tancats)).toBeNull()
    expect(avisHorari({ inici: '2026-11-04T10:00', durada: 40 }, H, tancats)).toBe('tancat')
    expect(avisHorari({ inici: '2026-11-07T10:00', durada: 40 }, H, tancats)).toBe('noLaborable') // dissabte
    expect(avisHorari({ inici: `${DIMARTS}T08:30`, durada: 40 }, H, tancats)).toBe('foraHorari')
    expect(avisHorari({ inici: `${DIMARTS}T19:40`, durada: 40 }, H, tancats)).toBe('foraHorari')
    expect(avisHorari({ inici: `${DIMARTS}T19:20`, durada: 40 }, H, tancats)).toBeNull()
  })
})

describe('on s\'obre la graella', () => {
  const cites = [{ inici: `${DIMARTS}T16:30` }, { inici: `${DIMARTS}T11:15` }, { inici: '2026-11-20T09:00' }]

  it('a l\'hora actual, si avui es veu i és dins l\'horari', () => {
    expect(minutInicial([DIMARTS], new Date(2026, 10, 3, 12, 7), H, cites)).toBe(12 * 60 + 7)
  })

  it('si no, a la primera cita dels dies que es veuen', () => {
    expect(minutInicial([DIMARTS], new Date(2026, 10, 3, 22, 0), H, cites)).toBe(11 * 60 + 15)
    expect(minutInicial([DIMARTS], new Date(2026, 10, 10, 12, 0), H, cites)).toBe(11 * 60 + 15)
  })

  it('i, sense cites, a l\'inici de l\'horari (mai a dalt de tot)', () => {
    expect(minutInicial(['2026-11-05'], new Date(2026, 10, 3, 7, 0), H, cites)).toBe(9 * 60)
  })

  it('tocar la graella dona el tram de 15 minuts', () => {
    const rang = { inici: 510, fi: 1230 }
    expect(trancaDeQuart(10 * 60 + 14, rang)).toBe(600)
    expect(trancaDeQuart(10 * 60 + 15, rang)).toBe(615)
    expect(trancaDeQuart(2000, rang)).toBe(1215)
  })
})

describe('vista i minicalendari', () => {
  it('setmana a l\'ordinador i a la tauleta horitzontal; dia a la vertical', () => {
    expect(vistaPerDefecte(1440, 900)).toBe('setmana')
    expect(vistaPerDefecte(1024, 640)).toBe('setmana')
    expect(vistaPerDefecte(640, 1024)).toBe('dia')
  })

  it('el minicalendari comença en dilluns i té sis setmanes', () => {
    const dies = diesMinicalendari(DIMARTS)
    expect(dies).toHaveLength(42)
    expect(dies[0]).toBe('2026-10-26')
    expect(dies).toContain('2026-11-30')
  })

  it('canviar de mes conserva el dia (o l\'últim del mes)', () => {
    expect(sumarMesos('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMesos(DIMARTS, -1)).toBe('2026-10-03')
    expect(sumarMesos('2026-12-15', 1)).toBe('2027-01-15')
  })
})
