import { describe, expect, it } from 'vitest'
import { esquemaDadesSessio, migrarExploracio, novaSessio } from '../domini/sessio'
import { QUALITATS_POLS } from './exploracio'
import { seccio } from './index'
import { ambSeccio, resumSeccio } from './motor'

describe('exploració', () => {
  it('les 28 qualitats clàssiques del pols, amb pinyin i caràcters', () => {
    expect(QUALITATS_POLS).toHaveLength(28)
    expect(new Set(QUALITATS_POLS.map((q) => q.id)).size).toBe(28)
    for (const q of QUALITATS_POLS) expect(q.hanzi).toMatch(/脉$/)
  })

  it('l\'exploració d\'abans (text lliure) passa a les observacions; no es perd res', () => {
    expect(migrarExploracio({ llengua: 'Pàl·lida', pols: '' })).toEqual({ seccions: { 'exploracio:llengua': { altres: 'Pàl·lida' } } })
    const antiga = { ...novaSessio({ citaId: 'c', episodiId: 'e', numero: 1, iniciAt: '2026-11-01T10:00:00Z' }), exploracio: { llengua: 'Vermella', pols: 'De corda' } }
    const s = esquemaDadesSessio.parse(antiga)
    expect(s.exploracio.seccions).toEqual({ 'exploracio:llengua': { altres: 'Vermella' }, 'exploracio:pols': { altres: 'De corda' } })
    // Una sessió nova ja ve amb seccions (i el format nou no es toca)
    expect(esquemaDadesSessio.parse(novaSessio({ citaId: 'c', episodiId: 'e', numero: 1, iniciAt: 'x' })).exploracio).toEqual({ seccions: {} })
    expect(migrarExploracio({ seccions: { 'exploracio:pols': { normal: true } } })).toEqual({ seccions: { 'exploracio:pols': { normal: true } } })
  })

  it('«Igual que l\'última»: la secció és una còpia (canviar-la no toca l\'anterior)', () => {
    const anterior = { 'exploracio:llengua': { valors: { cosColor: 'palid', cosForma: ['inflada'] } } }
    const copiada = ambSeccio({}, 'exploracio:llengua', structuredClone(anterior['exploracio:llengua']))
    expect(copiada).toEqual(anterior)
    ;(copiada['exploracio:llengua']!.valors!.cosForma as string[]).push('esquerdes')
    expect(anterior['exploracio:llengua'].valors.cosForma).toEqual(['inflada'])
  })

  it('resum de la graella del pols, de les zones de la llengua i dels punts dolorosos', () => {
    const pols = seccio('exploracio:pols')!
    expect(resumSeccio(pols, { valors: { ppm: 64, posicions: { E_guan: ['corda'], D_chi: ['profund', 'feble'] } } }, 'Normal')).toBe(
      'Velocitat: 64 polsacions per minut · Esquerra Guan: De corda; Dreta Chi: Profund, Feble',
    )
    const llengua = seccio('exploracio:llengua')!
    expect(resumSeccio(llengua, { valors: { cosColor: 'palid', zones: ['centre'] } }, 'Normal')).toBe('Pàl·lid · Centre (melsa i estómac)')
    const palp = seccio('exploracio:palpacio')!
    expect(resumSeccio(palp, { valors: { punts: { BL23: { costat: 'bilateral' } } } }, 'Normal')).toBe('BL23 bilateral')
  })
})
