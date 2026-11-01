import { describe, expect, it } from 'vitest'
import { notaSenseCategoria } from './precaucio'

describe('nota de la precaució sense repetir la categoria', () => {
  it('treu el prefix si és la mateixa categoria', () => {
    expect(notaSenseCategoria('Embaràs: tradicionalment contraindicat.', ['Embaràs'])).toBe('Tradicionalment contraindicat.')
    expect(notaSenseCategoria('Bulb raquidi: no punxar en profunditat ni cap amunt.', ['Bulb raquidi'])).toBe(
      'No punxar en profunditat ni cap amunt.',
    )
    expect(notaSenseCategoria('Ull: punció superficial.', ['Ull'])).toBe('Punció superficial.')
  })

  it('el deixa si el prefix diu una altra cosa', () => {
    expect(notaSenseCategoria('Tòrax: risc de pneumotòrax.', ['Pulmó'])).toBe('Tòrax: risc de pneumotòrax.')
    expect(notaSenseCategoria('Artèria radial: evitar-la.', ['Grans vasos'])).toBe('Artèria radial: evitar-la.')
    expect(notaSenseCategoria('Punxar amb la boca oberta.', ['Profunditat (només informativa)'])).toBe(
      'Punxar amb la boca oberta.',
    )
  })
})
