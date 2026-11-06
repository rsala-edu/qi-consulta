import { describe, expect, it } from 'vitest'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { ambValor, valorDe } from './fusioCamps'

describe('camps pel seu camí', () => {
  it('llegir i canviar un camp pel seu camí', () => {
    const d = fitxaClinicaBuida()
    expect(valorDe(ambValor(d, 'habits.tabac', 'Sí'), 'habits.tabac')).toBe('Sí')
    expect(valorDe(ambValor(d, 'alergies', 'Pols'), 'alergies')).toBe('Pols')
    expect(d.habits.tabac).toBe('')
  })
})
