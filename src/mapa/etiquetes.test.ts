import { describe, expect, it } from 'vitest'
import { colocarEtiquetes, MIDA_PER_DEFECTE as M } from './etiquetes'

const rect = (e: { esquerra: number; dalt: number; text: string }) => ({
  x1: e.esquerra,
  y1: e.dalt,
  x2: e.esquerra + e.text.length * M.caracter + M.marge,
  y2: e.dalt + M.alt,
})

describe('etiquetes sense superposar', () => {
  it('una etiqueta sola va a la dreta del punt', () => {
    const [e] = colocarEtiquetes([{ id: 'a', x: 100, y: 100, text: 'ST36' }], 800, 600)
    expect(e!.esquerra).toBe(100 + M.separacio)
  })

  it('tres punts gairebé al mateix lloc (com ST10–ST12 al coll) no se superposen', () => {
    const col = colocarEtiquetes(
      [
        { id: 'ST10', x: 300, y: 200, text: 'ST10 · Shuitu' },
        { id: 'ST11', x: 306, y: 204, text: 'ST11 · Qishe' },
        { id: 'ST12', x: 296, y: 208, text: 'ST12 · Quepen' },
      ],
      800,
      600,
    )
    expect(col).toHaveLength(3)
    for (let i = 0; i < col.length; i++)
      for (let j = i + 1; j < col.length; j++) {
        const a = rect(col[i]!)
        const b = rect(col[j]!)
        expect(a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2, `${col[i]!.id}/${col[j]!.id}`).toBe(false)
      }
  })

  it('si no hi ha lloc, l\'etiqueta menys important no surt', () => {
    const entrades = Array.from({ length: 8 }, (_, i) => ({ id: `P${i}`, x: 100, y: 100, text: `P${i}` }))
    const col = colocarEtiquetes(entrades, 800, 600)
    expect(col.length).toBeLessThan(8)
    expect(col[0]!.id).toBe('P0')
  })

  it('a la vora dreta de la pantalla, l\'etiqueta va a l\'esquerra del punt', () => {
    const [e] = colocarEtiquetes([{ id: 'a', x: 795, y: 100, text: 'LI4 · Hegu' }], 800, 600)
    expect(rect(e!).x2).toBeLessThanOrEqual(795)
  })
})
