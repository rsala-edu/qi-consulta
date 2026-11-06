// Fusió camp a camp amb versions (HLC) i rellotge lògic. Només dades inventades.
import { describe, expect, it } from 'vitest'
import { hlcDeData, RellotgeHlc } from './hlc'
import { aplanar, desplegar, fusionarCamps, type RegistreObert } from './registres'

const h = (ms: number, node = 'a') => hlcDeData(new Date(ms).toISOString(), node)
const obert = (camps: Record<string, unknown>, versions: RegistreObert['versions']): RegistreObert => ({ camps, versions })

describe('rellotge lògic (HLC)', () => {
  it('mai va enrere, encara que el rellotge del dispositiu sí', () => {
    let ara = 1_000_000
    const r = new RellotgeHlc('a', null, () => ara)
    const x = r.nou()
    ara -= 600_000
    const y = r.nou()
    expect(y > x).toBe(true)
  })

  it('després de veure un canvi d\'un altre dispositiu, el següent propi és posterior', () => {
    const r = new RellotgeHlc('lent', null, () => 1_000)
    const remot = h(9_000_000, 'rapid')
    r.veure(remot)
    expect(r.nou() > remot).toBe(true)
  })
})

describe('fusió camp a camp', () => {
  it('cada camp, el de versió més nova; un canvi fet sobre l\'altre no és conflicte', () => {
    const base = h(1)
    const a = obert({ telefon: '611', nom: 'Aina' }, { telefon: [h(5), base], nom: [base, null] })
    const b = obert({ telefon: '600', nom: 'Aina M.' }, { telefon: [base, null], nom: [h(6), base] })
    const r = fusionarCamps(a, b)
    expect(r.obert.camps).toEqual({ telefon: '611', nom: 'Aina M.' })
    expect(r.perduts).toEqual([])
    // És commutativa
    expect(fusionarCamps(b, a).obert).toEqual(r.obert)
  })

  it('el mateix camp editat alhora: guanya el més nou i l\'altre queda per revisar', () => {
    const base = h(1)
    const a = obert({ telefon: '611' }, { telefon: [h(5), base] })
    const b = obert({ telefon: '622' }, { telefon: [h(6), base] })
    const r = fusionarCamps(a, b)
    expect(r.obert.camps.telefon).toBe('622')
    expect(r.perduts).toEqual([{ camp: 'telefon', valor: '611', hlc: h(5) }])
  })

  it('una contraindicació marcada en una de les dues versions fetes alhora queda marcada, sense conflicte', () => {
    const base = h(1)
    const a = obert({ 'contraindicacions.anticoagulants': true }, { 'contraindicacions.anticoagulants': [h(5), base] })
    const b = obert({ 'contraindicacions.anticoagulants': false }, { 'contraindicacions.anticoagulants': [h(6), base] })
    const r = fusionarCamps(a, b)
    expect(r.obert.camps['contraindicacions.anticoagulants']).toBe(true)
    expect(r.perduts).toEqual([])
  })

  it('desmarcar-la després d\'haver-la vist marcada es respecta', () => {
    const a = obert({ 'contraindicacions.embaras': true }, { 'contraindicacions.embaras': [h(5), null] })
    const b = obert({ 'contraindicacions.embaras': false }, { 'contraindicacions.embaras': [h(6), h(5)] })
    expect(fusionarCamps(a, b).obert.camps['contraindicacions.embaras']).toBe(false)
  })

  it('un camp esborrat després es queda esborrat', () => {
    const a = obert({ revisarDuplicat: ['p2'] }, { revisarDuplicat: [h(5), null] })
    const b = obert({}, { revisarDuplicat: [h(6), h(5)] })
    expect(fusionarCamps(a, b).obert.camps).toEqual({})
  })

  it('aplanar i desplegar els camps niats', () => {
    const d = { habits: { tabac: 'No', son: '' }, alergies: 'Pols', llista: ['a'], buit: {} }
    expect(aplanar(d)).toEqual({ 'habits.tabac': 'No', 'habits.son': '', alergies: 'Pols', llista: ['a'], buit: {} })
    expect(desplegar(aplanar(d))).toEqual(d)
  })
})
