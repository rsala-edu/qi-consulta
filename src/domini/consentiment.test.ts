import { describe, expect, it } from 'vitest'
import { aprovadaDe, aprovar, comprovarCanvi, editableDe, esEditable, estatDelTipus, nouEsborrany, revocar, type DadesConsentiment } from './consentiment'
import { NOTA_ORIENTATIVA, plantillaInicial } from './plantillesInicials'

const ARA = '2026-11-13T10:00:00.000Z'

describe('plantilles: versions', () => {
  it('les inicials són «Pendent de revisió», versió 1, amb la nota orientativa i camps per completar', () => {
    for (const tipus of ['acupuntura', 'dades', 'imatges'] as const) {
      const p = plantillaInicial(tipus, ARA)
      expect(p).toMatchObject({ tipus, versio: 1, estat: 'pendent', nota: NOTA_ORIENTATIVA })
      expect(p.text).toContain('[NÚMERO DE COL·LEGIADA]')
      expect(esEditable(p)).toBe(true)
    }
    expect(plantillaInicial('dades', ARA).text).toContain('Llei 41/2002')
  })

  it('aprovar crea una versió nova no editable i retira l\'aprovada anterior', () => {
    const v1 = plantillaInicial('acupuntura', ARA)
    const { nova: v2, retirades } = aprovar(v1, [v1], ARA)
    expect(v2).toMatchObject({ versio: 2, estat: 'aprovada', text: v1.text, nota: '' })
    expect(esEditable(v2)).toBe(false)
    expect(retirades).toEqual([])
    // Editar l'aprovada: un esborrany nou (v3); en aprovar-lo (v4), la v2 es retira
    const v3 = { ...nouEsborrany(v2, [v1, v2], ARA), text: 'Text revisat' }
    expect(v3).toMatchObject({ versio: 3, estat: 'esborrany' })
    const r = aprovar(v3, [v1, v2, v3], ARA)
    expect(r.nova).toMatchObject({ versio: 4, estat: 'aprovada', text: 'Text revisat' })
    expect(r.retirades).toEqual([{ ...v2, estat: 'retirada' }])
    // Una aprovada no es pot tornar a aprovar
    expect(() => aprovar(v2, [v1, v2], ARA)).toThrow()
  })

  it('quina es fa signar i quina s\'edita', () => {
    const v1 = plantillaInicial('dades', ARA)
    expect(aprovadaDe([v1], 'dades')).toBeNull()
    expect(editableDe([v1], 'dades')).toBe(v1)
    const v2 = aprovar(v1, [v1], ARA).nova
    expect(aprovadaDe([v1, v2], 'dades')).toBe(v2)
    expect(aprovadaDe([v1, v2], 'acupuntura')).toBeNull()
  })
})

describe('consentiments signats: només es revoquen', () => {
  const signat: DadesConsentiment = {
    tipus: 'acupuntura',
    plantillaId: 'plantilla-acupuntura-v2',
    versio: 2,
    titol: 'Acupuntura',
    text: 'Text (inventat)',
    signatAt: ARA,
    signaturaPacient: 'data:image/png;base64,AAA',
    representant: null,
    signaturaDoctora: 'data:image/png;base64,BBB',
    estat: 'vigent',
    revocacio: null,
    pdf: 'JVBER',
  }

  it('estat de cada tipus: pendent, vigent o revocat', () => {
    expect(estatDelTipus([], 'acupuntura')).toBe('pendent')
    expect(estatDelTipus([signat], 'acupuntura')).toBe('vigent')
    expect(estatDelTipus([signat], 'dades')).toBe('pendent')
    const revocat = revocar(signat, 'Ho demana la pacient (inventat)', ARA)
    expect(estatDelTipus([revocat], 'acupuntura')).toBe('revocat')
    // Si en torna a signar un, torna a estar vigent
    expect(estatDelTipus([revocat, { ...signat, signatAt: '2026-11-20T10:00:00Z' }], 'acupuntura')).toBe('vigent')
  })

  it('revocar: amb motiu i data; no es pot revocar dues vegades', () => {
    const r = revocar(signat, ' Canvi de parer (inventat) ', ARA)
    expect(r).toMatchObject({ estat: 'revocat', revocacio: { at: ARA, motiu: 'Canvi de parer (inventat)' } })
    expect(() => revocar(r, 'Un altre', ARA)).toThrow()
    expect(() => revocar(signat, '  ', ARA)).toThrow()
  })

  it('cap altre canvi: ni el text, ni les signatures, ni desfer la revocació', () => {
    expect(() => comprovarCanvi(signat, revocar(signat, 'Motiu', ARA))).not.toThrow()
    expect(() => comprovarCanvi(signat, { ...signat, text: 'Un altre text' })).toThrow()
    expect(() => comprovarCanvi(signat, { ...signat, signaturaPacient: 'x' })).toThrow()
    const r = revocar(signat, 'Motiu', ARA)
    expect(() => comprovarCanvi(r, signat)).toThrow()
  })
})
