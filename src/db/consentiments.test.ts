import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import type { DadesConsentiment } from '../domini/consentiment'
import { QiDB } from './esquema'
import { crearMagatzem, type Magatzem } from './magatzem'

let db: QiDB
let magatzem: Magatzem

beforeEach(async () => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
  magatzem = crearMagatzem(db, await clauDeProva())
})
afterEach(async () => {
  db.close()
  await db.delete()
})

describe('consentiment informat (magatzem)', () => {
  it('les plantilles inicials es creen una sola vegada, pendents de revisió i xifrades', async () => {
    const p = await magatzem.plantillesConsentiment()
    expect(p.map((x) => [x.tipus, x.versio, x.estat])).toEqual([
      ['acupuntura', 1, 'pendent'],
      ['dades', 1, 'pendent'],
      ['imatges', 1, 'pendent'],
    ])
    expect(await magatzem.plantillesConsentiment()).toHaveLength(3)
    const cru = JSON.stringify(await db.plantillesConsentiment.toArray())
    expect(cru).not.toContain('pneumotòrax')
    expect(cru).not.toContain('Llei 41/2002')
  })

  it('només es poden fer signar les aprovades, amb el text exacte; després només es poden revocar', async () => {
    const pacient = await magatzem.crearPacient(pacientInventat())
    const [acup] = await magatzem.plantillesConsentiment()
    const signatura = 'data:image/png;base64,iVBORw0KGgo='
    const dades = (p: typeof acup): DadesConsentiment => ({
      tipus: 'acupuntura',
      plantillaId: p!.id,
      versio: p!.versio,
      titol: p!.titol,
      text: p!.text,
      signatAt: '2026-11-13T10:00:00.000Z',
      signaturaPacient: signatura,
      representant: null,
      signaturaDoctora: signatura,
      estat: 'vigent',
      revocacio: null,
      pdf: 'JVBERi0=',
    })
    await expect(magatzem.signarConsentiment(pacient.id, dades(acup))).rejects.toThrow(/aprovades/)
    await magatzem.desarPlantilla(acup!.id, { ...acup!, text: `${acup!.text}\n(revisat)` })
    const aprovada = await magatzem.aprovarPlantilla(acup!.id)
    expect(aprovada).toMatchObject({ versio: 2, estat: 'aprovada' })
    await expect(magatzem.desarPlantilla(aprovada.id, { ...aprovada, text: 'canvi' })).rejects.toThrow()
    await expect(magatzem.signarConsentiment(pacient.id, { ...dades(aprovada), text: 'un altre text' })).rejects.toThrow()

    const signat = await magatzem.signarConsentiment(pacient.id, dades(aprovada))
    expect(signat.estat).toBe('vigent')
    expect(JSON.stringify(await db.consentiments.toArray())).not.toContain('revisat')
    const revocat = await magatzem.revocarConsentiment(signat.id, 'Ho demana (inventat)')
    expect(revocat).toMatchObject({ estat: 'revocat', revocacio: { motiu: 'Ho demana (inventat)' }, text: signat.text })
    await expect(magatzem.revocarConsentiment(signat.id, 'Un altre')).rejects.toThrow()
    expect((await magatzem.consentimentsDe(pacient.id)).map((c) => c.estat)).toEqual(['revocat'])
  })
})
