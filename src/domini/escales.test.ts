import { describe, expect, it } from 'vitest'
import { cercarPatrons, PATRONS } from '../cataleg/components/Sindromes'
import { esquemaDadesEpisodi, nouEpisodi } from './episodi'
import { ESCALES, grauEscala, mymopBuit, perfilMymop, respostesQueFalten, tocaMymop, totalEscala } from './escales'

describe('escales', () => {
  it('THI: suma de les 25 respostes (0, 2 o 4) i grau de McCombe', () => {
    const thi = ESCALES.thi
    const totes = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [String(i + 1), i < 10 ? 4 : i < 15 ? 2 : 0]))
    expect(totalEscala(thi, totes)).toBe(50)
    expect(respostesQueFalten(thi, totes)).toBe(0)
    expect(grauEscala(thi, 50)).toBe('Grau 3 · moderat')
    expect(grauEscala(thi, 16)).toBe('Grau 1 · molt lleu')
    expect(grauEscala(thi, 18)).toBe('Grau 2 · lleu')
    expect(grauEscala(thi, 78)).toBe('Grau 5 · catastròfic')
    expect(grauEscala(thi, 101)).toBeNull()
    // Respostes fora de rang o d'ítems que no existeixen no compten
    expect(totalEscala(thi, { '1': 4, '2': 3, '26': 4 })).toBe(4)
    expect(totalEscala(thi, {})).toBeNull()
    expect(respostesQueFalten(thi, { '1': 4 })).toBe(24)
  })

  it('DHI i SNOT-22: graus', () => {
    expect(grauEscala(ESCALES.dhi, 30)).toBe('Lleu')
    expect(grauEscala(ESCALES.dhi, 31)).toBe('Moderat')
    expect(grauEscala(ESCALES.dhi, 62)).toBe('Greu')
    expect(grauEscala(ESCALES.snot22, 7)).toBe('Sense símptomes rellevants')
    expect(grauEscala(ESCALES.snot22, 20)).toBe('Lleu')
    expect(grauEscala(ESCALES.snot22, 21)).toBe('Moderat')
    expect(grauEscala(ESCALES.snot22, 51)).toBe('Greu')
    expect(totalEscala(ESCALES.snot22, { '1': 5, '22': 5, '23': 5 })).toBe(10)
  })

  it('MYMOP: perfil = mitjana de les puntuacions que hi ha; es demana a les sessions 1, 5, 9…', () => {
    const m = { simptoma1: { nom: 'Acúfens', puntuacio: 5 }, simptoma2: { nom: 'Insomni', puntuacio: 3 }, activitat: { nom: 'Llegir', puntuacio: 4 }, benestar: 2 }
    expect(perfilMymop(m)).toBe(3.5)
    expect(perfilMymop({ ...m, simptoma2: { nom: '', puntuacio: null } })).toBe(3.67)
    expect(perfilMymop(mymopBuit())).toBeNull()
    expect(mymopBuit(m).simptoma1).toEqual({ nom: 'Acúfens', puntuacio: null })
    expect([1, 2, 4, 5, 6, 9, 13].map(tocaMymop)).toEqual([true, false, false, true, false, true, true])
  })
})

describe('síndromes (CIM-11, capítol 26)', () => {
  it('només patrons de MTC (TM1), sense els residuals', () => {
    expect(PATRONS.length).toBeGreaterThan(150)
    expect(PATRONS.every((p) => /^S[E-J]/.test(p.codi) && !/unspecified|Other specified/.test(p.titol))).toBe(true)
  })

  it('es pot cercar en català (glossari), en anglès o pel codi', () => {
    const melsa = cercarPatrons('melsa qi deficiència')
    expect(melsa[0]?.titol).toBe('Spleen qi deficiency pattern (TM1)')
    expect(cercarPatrons('liver yang').some((p) => /Liver yang/.test(p.titol))).toBe(true)
    const codi = melsa[0]!.codi
    expect(cercarPatrons(codi)[0]?.codi).toBe(codi)
    expect(cercarPatrons('x')).toEqual([])
  })
})

describe('pla de tractament', () => {
  it('els episodis d\'abans de la 3B no en tenen (null); un de nou tampoc fins que s\'omple', () => {
    const { pla: _p, ...antic } = nouEpisodi('Lumbàlgia', '2026-11-01')
    expect(esquemaDadesEpisodi.parse(antic).pla).toBeNull()
    const ple = esquemaDadesEpisodi.parse({ ...antic, pla: { sessions: 10, frequencia: 'setmanal', objectius: '', tecniques: ['acupuntura'], revisio: null } })
    expect(ple.pla?.sessions).toBe(10)
  })
})
