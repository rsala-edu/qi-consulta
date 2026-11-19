import { describe, expect, it } from 'vitest'
import { anullar, classeFitxer, midaLlegible, moure, titolDeFitxer, vigents, type DadesDocument } from './document'

const doc = (data: string, afegitAt: string, anullat: DadesDocument['anullat'] = null) => ({ data, afegitAt, anullat })

describe('documents adjunts (domini)', () => {
  it('es mostren els no anul·lats, per la data del document', () => {
    const a = doc('2026-10-01', '2026-11-10T10:00:00Z')
    const b = doc('2026-11-02', '2026-11-03T10:00:00Z')
    const c = doc('2026-11-05', '2026-11-05T10:00:00Z', { at: '2026-11-06T10:00:00Z', motiu: 'Duplicat' })
    expect(vigents([a, b, c])).toEqual([b, a])
  })

  it('anul·lar demana el motiu i només es fa una vegada', () => {
    const d = { anullat: null } as unknown as DadesDocument
    const r = anullar(d, ' Duplicat (inventat) ', '2026-11-19T10:00:00Z')
    expect(r.anullat).toEqual({ at: '2026-11-19T10:00:00Z', motiu: 'Duplicat (inventat)' })
    expect(() => anullar(r, 'Un altre', '2026-11-19T10:00:00Z')).toThrow()
    expect(() => anullar(d, '  ', '2026-11-19T10:00:00Z')).toThrow()
  })

  it('reconeix PDF, imatges i HEIC pel tipus, l\'extensió o els primers bytes', () => {
    expect(classeFitxer('informe.pdf', '')).toBe('pdf')
    expect(classeFitxer('sense-extensio', '', new TextEncoder().encode('%PDF-1.4'))).toBe('pdf')
    expect(classeFitxer('IMG_0001.HEIC', '')).toBe('heic')
    expect(classeFitxer('foto', 'image/heif')).toBe('heic')
    const heic = new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic')])
    expect(classeFitxer('foto.bin', '', heic)).toBe('heic')
    expect(classeFitxer('analitica.jpg', 'image/jpeg')).toBe('imatge')
    expect(classeFitxer('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('desconegut')
  })

  it('títol a partir del nom del fitxer, mida llegible i reordenar pàgines', () => {
    expect(titolDeFitxer('analitica_novembre-2026.pdf')).toBe('Analitica novembre 2026')
    expect(titolDeFitxer('.pdf')).toBe('')
    expect(midaLlegible(380 * 1024)).toBe('380 kB')
    expect(midaLlegible(2.4 * 1024 * 1024)).toBe('2,4 MB')
    expect(moure(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moure(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c'])
  })
})
