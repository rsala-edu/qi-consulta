import { describe, expect, it } from 'vitest'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { ambValor, fusionarCamps, valorDe } from './fusioCamps'

const fitxa = (canvis: Record<string, unknown> = {}) => ({ ...fitxaClinicaBuida(), ...canvis })

describe('fusió camp a camp', () => {
  it('un camp omplert només en una versió es queda, sigui la nova o l\'anterior', () => {
    const nova = fitxa({ alergies: 'Penicil·lina' })
    const anterior = fitxa({ medicacioActual: 'Omeprazol' })
    const r = fusionarCamps(nova, anterior)
    expect(r.dades).toMatchObject({ alergies: 'Penicil·lina', medicacioActual: 'Omeprazol' })
    expect(r.conflictes).toEqual([])
  })

  it('el mateix valor a totes dues: cap conflicte', () => {
    expect(fusionarCamps(fitxa({ alergies: 'Pols' }), fitxa({ alergies: 'Pols' })).conflictes).toEqual([])
  })

  it('valors diferents: guanya el més nou i l\'altre queda com a versió anterior', () => {
    const r = fusionarCamps(fitxa({ medicacioActual: 'Ibuprofèn' }), fitxa({ medicacioActual: 'Paracetamol' }))
    expect(r.dades.medicacioActual).toBe('Ibuprofèn')
    expect(r.conflictes).toEqual([{ camp: 'medicacioActual', valor: 'Paracetamol' }])
  })

  it('camps niats un per un; una contraindicació marcada en qualsevol versió queda marcada', () => {
    const nova = fitxa({
      contraindicacions: { anticoagulants: false, embaras: false, marcapassos: false, altres: 'Epilèpsia' },
      habits: { son: 'Bo', tabac: '', alcohol: '', exercici: '' },
    })
    const anterior = fitxa({
      contraindicacions: { anticoagulants: true, embaras: false, marcapassos: false, altres: 'Hemofília' },
      habits: { son: 'Dolent', tabac: 'No', alcohol: '', exercici: '' },
    })
    const r = fusionarCamps(nova, anterior)
    expect(r.dades.contraindicacions).toEqual({ anticoagulants: true, embaras: false, marcapassos: false, altres: 'Epilèpsia' })
    expect(r.dades.habits).toEqual({ son: 'Bo', tabac: 'No', alcohol: '', exercici: '' })
    expect(r.conflictes).toEqual([
      { camp: 'contraindicacions.altres', valor: 'Hemofília' },
      { camp: 'habits.son', valor: 'Dolent' },
    ])
  })

  it('llegir i canviar un camp pel seu camí', () => {
    const d = fitxa()
    expect(valorDe(ambValor(d, 'habits.tabac', 'Sí'), 'habits.tabac')).toBe('Sí')
    expect(valorDe(ambValor(d, 'alergies', 'Pols'), 'alergies')).toBe('Pols')
    expect(d.habits.tabac).toBe('')
  })
})

describe('fusió amb la versió de l\'última sincronia', () => {
  it('un camp canviat només en una versió es pren d\'aquella; canviat a totes dues, conflicte', () => {
    const base = fitxa({ alergies: 'Penicil·lina', medicacioActual: 'Cap' })
    // La tauleta canvia les al·lèrgies; l'ordinador (més nou), la medicació
    const anterior = fitxa({ alergies: 'Pols', medicacioActual: 'Cap' })
    const nova = fitxa({ alergies: 'Penicil·lina', medicacioActual: 'Ibuprofèn' })
    const r = fusionarCamps(nova, anterior, '', base)
    expect(r.dades).toMatchObject({ alergies: 'Pols', medicacioActual: 'Ibuprofèn' })
    expect(r.conflictes).toEqual([])
    // Totes dues canvien la medicació: guanya la nova i l'altra queda per revisar
    const r2 = fusionarCamps(nova, fitxa({ alergies: 'Penicil·lina', medicacioActual: 'Paracetamol' }), '', base)
    expect(r2.conflictes).toEqual([{ camp: 'medicacioActual', valor: 'Paracetamol' }])
  })

  it('esborrar un camp en un dispositiu (i no tocar-lo a l\'altre) l\'esborra', () => {
    const base = fitxa({ alergies: 'Pols' })
    const r = fusionarCamps(fitxa({ alergies: 'Pols' }), fitxa({ alergies: '' }), '', base)
    expect(r.dades.alergies).toBe('')
    expect(r.conflictes).toEqual([])
  })
})
