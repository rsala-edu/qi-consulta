import { describe, expect, it } from 'vitest'
import { MOTIU_PER_DEFECTE, nomEpisodi, nouEpisodi, senseMotiu } from './episodi'

describe('nom de l\'episodi', () => {
  it('«Primera visita» no és un motiu: és el tipus de la cita', () => {
    expect(nouEpisodi('', '2026-11-04').motiu).toBe(MOTIU_PER_DEFECTE)
    expect(senseMotiu(MOTIU_PER_DEFECTE)).toBe(true)
    expect(senseMotiu('  ')).toBe(true)
    expect(senseMotiu('Lumbàlgia')).toBe(false)
  })

  it('sense motiu, el de la primera cita de l\'episodi que en tingui', () => {
    expect(nomEpisodi({ motiu: 'Lumbàlgia' }, ['Cervicàlgia'])).toBe('Lumbàlgia')
    expect(nomEpisodi({ motiu: MOTIU_PER_DEFECTE }, ['', 'Primera visita', 'Lumbàlgia', 'Altres'])).toBe('Lumbàlgia')
    expect(nomEpisodi({ motiu: MOTIU_PER_DEFECTE }, [])).toBe('')
  })
})
