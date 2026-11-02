import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorCopiaDanyada, ErrorCopiaVersio } from './copia'
import { ErrorAutoritzacio, ErrorDrive } from './drive'
import { classificarErrorSincronia as classificar } from './motiuSincronia'

afterEach(() => vi.restoreAllMocks())

describe('motiu de l\'error de la sincronia', () => {
  it('cada error amb el seu motiu i codi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(classificar(new ErrorAutoritzacio(), true)).toEqual({ motiu: 'permis', codi: 'DRV-P' })
    expect(classificar(new TypeError('Failed to fetch'), true)).toEqual({ motiu: 'xarxa', codi: 'DRV-N' })
    expect(classificar(new ErrorDrive(503), false).motiu).toBe('xarxa')
    expect(classificar(new ErrorDrive(503), true)).toEqual({ motiu: 'drive', codi: 'DRV-503' })
    expect(classificar(new ErrorCopiaVersio(), true).motiu).toBe('versio')
    expect(classificar(new ErrorCopiaDanyada(), true).motiu).toBe('danyada')
    const bulk = Object.assign(new Error('fitxesCliniques.bulkPut(): 1 of 2 operations failed'), { name: 'BulkError' })
    expect(classificar(bulk, true)).toEqual({ motiu: 'local', codi: 'DRV-L' })
    expect(classificar(new RangeError('x'), true)).toEqual({ motiu: 'desconegut', codi: 'DRV-X' })
  })

  it('a la consola, el motiu i el nom de l\'error; mai el missatge', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    classificar(Object.assign(new Error('Aina Provencal, acúfens'), { name: 'ConstraintError' }), true)
    const escrit = consola.mock.calls.flat().join(' ')
    expect(escrit).toContain('local')
    expect(escrit).toContain('ConstraintError')
    expect(escrit).not.toContain('Aina')
  })
})
