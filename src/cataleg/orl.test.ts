import { describe, expect, it } from 'vitest'
import { clauLlindar, pta } from '../domini/audiometria'
import { seccio } from './index'
import { orlActiu } from './orl'

describe('mòdul ORL', () => {
  it('s\'activa sol si el motiu o el diagnòstic són ORL (o el codi CIM-11 és de l\'orella o del nas); triat a mà, mana', () => {
    expect(orlActiu(null, ['Acúfens'])).toBe(true)
    expect(orlActiu(null, ['Vertigen posicional'])).toBe(true)
    expect(orlActiu(null, ['Obstrucció nasal'])).toBe(true)
    expect(orlActiu(null, ['Lumbàlgia'])).toBe(false)
    expect(orlActiu(null, ['Va néixer a Mallorca'])).toBe(false)
    expect(orlActiu(null, ['Dolor'], 'AB31')).toBe(true)
    expect(orlActiu(null, ['Dolor'], 'CA0A')).toBe(true)
    expect(orlActiu(false, ['Acúfens'])).toBe(false)
    expect(orlActiu(true, ['Lumbàlgia'])).toBe(true)
  })

  it('totes les exploracions i les tres escales', () => {
    for (const id of ['otoscopia', 'rinoscopia', 'orofaringe', 'laringe', 'acumetria', 'audiometria', 'timpanometria', 'vestibular', 'escales']) {
      expect(seccio(`orl:${id}`), id).toBeDefined()
    }
    const timp = seccio('orl:timpanometria')!.camps[0]!
    expect('opcions' in timp && timp.opcions!.map((x) => x.id)).toEqual(['A', 'As', 'Ad', 'B', 'C'])
  })

  it('audiograma: claus sense punts i PTA de 500, 1.000, 2.000 i 4.000 Hz', () => {
    expect(clauLlindar('D_aeria', 1000)).toBe('D_aeria_1000')
    const l = { D_aeria_500: 20, D_aeria_1000: 25, D_aeria_2000: 40, D_aeria_4000: 55 }
    expect(pta(l, 'D_aeria')).toBe(35)
    expect(pta(l, 'E_aeria')).toBeNull()
    expect(pta({ ...l, D_aeria_4000: 60 }, 'D_aeria')).toBe(36.3)
  })
})
