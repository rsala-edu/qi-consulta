import { describe, expect, it } from 'vitest'
import {
  alcadaHora,
  avisHorari,
  contingutTargeta,
  HORA_MINIMA,
  iniciVista,
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

describe('jornada sencera a la vista', () => {
  it('l\'hora es fa prou alta perquè hi càpiga tot l\'horari, amb un mínim', () => {
    // De 8:30 a 20:30 són 12 hores
    expect(alcadaHora(660, 12 * 60, HORA_MINIMA.ratoli)).toBe(55)
    expect(alcadaHora(400, 12 * 60, HORA_MINIMA.ratoli)).toBe(48) // no hi cap: es desplaça
    expect(alcadaHora(400, 12 * 60, HORA_MINIMA.dits)).toBe(56)
    expect(alcadaHora(5000, 12 * 60, 48)).toBe(120)
  })

  it('quan cal desplaçar-se, una hora abans, en punt', () => {
    expect(iniciVista(11 * 60 + 40, { inici: 510 })).toBe(10 * 60)
    expect(iniciVista(9 * 60, { inici: 510 })).toBe(510)
  })

  it('targetes de la setmana: nom, hora i motiu segons l\'alçada; les curtes, hora i nom', () => {
    expect(contingutTargeta(36, 40, 15, 6)).toEqual({ tipus: 'curta', linies: 2 })
    expect(contingutTargeta(20, 15, 15, 6)).toEqual({ tipus: 'curta', linies: 1 })
    expect(contingutTargeta(46, 60, 15, 6)).toEqual({ tipus: 'completa', liniesNom: 1, motiu: false })
    expect(contingutTargeta(53, 60, 15, 6)).toEqual({ tipus: 'completa', liniesNom: 2, motiu: false })
    expect(contingutTargeta(70, 60, 15, 6)).toEqual({ tipus: 'completa', liniesNom: 2, motiu: true })
  })
})
