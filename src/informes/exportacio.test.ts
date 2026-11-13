import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import { QiDB } from '../db/esquema'
import { crearMagatzem, type Magatzem } from '../db/magatzem'
import { exportarDadesPacient, FORMAT_EXPORTACIO } from './exportacio'

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

describe('exportació per al dret d\'accés i de portabilitat (preparada)', () => {
  it('totes les dades del pacient, desxifrades, en JSON', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const altre = await magatzem.crearPacient({ ...pacientInventat(), nom: 'Altre' })
    await magatzem.afegirFoto(p.id, { episodiId: null, sessioId: null, zona: null, nota: 'Nota (inventat)', presaAt: '2026-11-13T10:00:00Z', amplada: 1, alcada: 1, mida: 2, miniatura: '', esborrada: null }, new Uint8Array([0xff, 0xd8]))
    const e = await exportarDadesPacient(magatzem, p.id, new Date('2026-11-13T12:00:00Z'))
    expect(e).toMatchObject({ format: FORMAT_EXPORTACIO, versio: 1, generatAt: '2026-11-13T12:00:00.000Z' })
    expect(e.pacient.id).toBe(p.id)
    expect(e.fotos).toHaveLength(1)
    expect(e.imatges[0]!.jpegBase64).toBe('/9g=')
    // Només les seves dades, i serialitzable
    expect(JSON.stringify(e)).not.toContain(altre.id)
    await expect(exportarDadesPacient(magatzem, 'no-existeix')).rejects.toThrow()
  })
})
