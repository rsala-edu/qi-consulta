import { describe, expect, it } from 'vitest'
import { midaReduida, nomFitxerImatge, RE_IMATGE, teExif, treureExif, visibles } from './foto'

/** Un JPEG mínim inventat: SOI, APP0 (JFIF), APP1 (Exif amb «GPS»), COM, DQT i SOS amb dades */
function jpegAmbExif(): Uint8Array {
  const seg = (marcador: number, cos: number[]) => [0xff, marcador, (cos.length + 2) >> 8, (cos.length + 2) & 0xff, ...cos]
  const text = (t: string) => [...t].map((c) => c.charCodeAt(0))
  return new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, text('JFIF\0')),
    ...seg(0xe1, [...text('Exif\0\0'), ...text('GPS 41.38N 2.17E (inventat)')]),
    ...seg(0xfe, text('comentari')),
    ...seg(0xdb, [0, 1, 2, 3]),
    0xff, 0xda, 0, 4, 9, 9, 1, 2, 3, 0xff, 0xd9,
  ])
}

describe('EXIF', () => {
  it('treu l\'EXIF (amb la ubicació) i els comentaris, i conserva la resta', () => {
    const abans = jpegAmbExif()
    expect(teExif(abans)).toBe(true)
    const despres = treureExif(abans)
    expect(teExif(despres)).toBe(false)
    const text = String.fromCharCode(...despres)
    expect(text).not.toContain('GPS')
    expect(text).not.toContain('comentari')
    expect(text).toContain('JFIF')
    // Comença i acaba igual (SOI … EOI) i la taula de quantització hi és
    expect([...despres.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect([...despres.subarray(-2)]).toEqual([0xff, 0xd9])
    expect(despres.length).toBe(abans.length - (2 + 2 + 6 + 27) - (2 + 2 + 9))
  })

  it('un fitxer que no és JPEG, tal qual', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    expect(treureExif(png)).toBe(png)
  })
})

describe('mida i fitxers', () => {
  it('1.600 px pel costat llarg, conservant la proporció; mai s\'amplia', () => {
    expect(midaReduida(4032, 3024)).toEqual({ amplada: 1600, alcada: 1200 })
    expect(midaReduida(3024, 4032)).toEqual({ amplada: 1200, alcada: 1600 })
    expect(midaReduida(800, 600)).toEqual({ amplada: 800, alcada: 600 })
  })
  it('un fitxer de Drive per foto; les esborrades no es veuen', () => {
    expect(nomFitxerImatge('abc-1')).toBe('qi-imatge-abc-1.json')
    expect(RE_IMATGE.exec('qi-imatge-abc-1.json')?.[1]).toBe('abc-1')
    expect(RE_IMATGE.test('qi-foto-000001-x.json')).toBe(false)
    const f = (presaAt: string, esborrada = false) => ({ presaAt, esborrada: esborrada ? { at: presaAt, motiu: '' } : null })
    expect(visibles([f('2026-01-01'), f('2026-03-01'), f('2026-02-01', true)]).map((x) => x.presaAt)).toEqual(['2026-03-01', '2026-01-01'])
  })
})
