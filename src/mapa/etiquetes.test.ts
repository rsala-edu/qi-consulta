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

describe('etiquetes de dues columnes properes (sacre)', () => {
  // Com BL27–BL30 i BL31–BL34 als dos costats del sacre: quatre columnes
  // separades uns 25 px, amb un punt cada 25 px
  const columnes = [-60, -35, 35, 60]
  const entrades = columnes.flatMap((dx, c) =>
    [0, 1, 2, 3].map((i) => ({ id: `C${c}-${i}`, x: 400 + dx, y: 300 + 25 * i, text: `BL${27 + i + 4 * (c % 2)}` })),
  )
  const col = colocarEtiquetes(entrades, 800, 600)

  it('cap etiqueta tapa cap punt ni cap altra etiqueta', () => {
    for (const e of col) {
      const a = rect(e)
      for (const p of entrades) {
        if (p.id === e.id) continue
        const tapa = a.x1 < p.x + 5 && p.x - 5 < a.x2 && a.y1 < p.y + 5 && p.y - 5 < a.y2
        expect(tapa, `${e.id} tapa ${p.id}`).toBe(false)
      }
      for (const f of col) {
        if (f === e) continue
        const b = rect(f)
        expect(a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2, `${e.id}/${f.id}`).toBe(false)
      }
    }
  })

  it('les columnes de fora posen l\'etiqueta a fora', () => {
    for (const e of col.filter((x) => x.id.startsWith('C0'))) expect(rect(e).x2).toBeLessThanOrEqual(340)
    for (const e of col.filter((x) => x.id.startsWith('C3'))) expect(e.esquerra).toBeGreaterThanOrEqual(460)
    expect(col.filter((x) => x.id.startsWith('C0') || x.id.startsWith('C3'))).toHaveLength(8)
  })
})

describe('etiqueta curta de reserva', () => {
  it('si el nom llarg no hi cap, es mostra només el codi', () => {
    const col = colocarEtiquetes(
      [
        { id: 'a', x: 100, y: 100, text: 'BL31 · Shangliao', curt: 'BL31' },
        // punts a 60 px a la dreta i a l'esquerra, i just a sobre i a sota:
        // el nom llarg no hi cap enlloc
        { id: 'b', x: 160, y: 100, text: 'x' },
        { id: 'c', x: 40, y: 100, text: 'y' },
        { id: 'd', x: 100, y: 75, text: 'z' },
        { id: 'e', x: 100, y: 125, text: 'w' },
      ],
      800,
      600,
    )
    expect(col.find((e) => e.id === 'a')!.text).toBe('BL31')
  })
})
