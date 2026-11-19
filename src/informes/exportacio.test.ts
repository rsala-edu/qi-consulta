import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import { QiDB } from '../db/esquema'
import { crearMagatzem, type Magatzem } from '../db/magatzem'
import { completarFitxers, exportarDadesPacient, FORMAT_EXPORTACIO, nomFitxerExportacio } from './exportacio'
import { pujarImatgesPendents } from '../fotos/driveImatges'
import type { Drive } from '../sincronia/drive'

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

describe('exportació per al dret d\'accés i de portabilitat', () => {
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

describe('exportació: fitxers i nom', () => {
  it('els documents (també els anul·lats) hi són amb el fitxer; els que no són al dispositiu es baixen de Drive abans', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const dades = {
      tipus: 'analitica' as const, titol: 'Analítica (inventada)', data: '2026-11-02', nota: '', episodiId: null, sessioId: null, valoracioId: null,
      format: 'pdf' as const, pagines: 1, mida: 5, miniatura: '', afegitAt: '2026-11-13T10:00:00Z', origen: 'fitxer' as const, anullat: null,
    }
    const d = await magatzem.afegirDocument(p.id, dades, new TextEncoder().encode('%PDF-'))
    const fitxers = new Map<string, { nom: string; text: string }>()
    const drive = {
      llistar: async () => [...fitxers].map(([id, f]) => ({ id, name: f.nom, modifiedTime: '' })),
      baixar: async (id: string) => fitxers.get(id)!.text,
      crear: async (nom: string, text: string) => (fitxers.set(nom, { nom, text }), { id: nom, name: nom, modifiedTime: '' }),
      actualitzar: async () => ({ id: '', name: '', modifiedTime: '' }),
      esborrar: async () => {},
    } as unknown as Drive
    await pujarImatgesPendents(db, drive)
    await db.imatges.delete(d.id)
    expect(await completarFitxers(magatzem, null, p.id)).toBe(1)
    expect(await completarFitxers(magatzem, drive, p.id)).toBe(0)
    const e = await exportarDadesPacient(magatzem, p.id)
    expect(e.documents).toHaveLength(1)
    expect(e.fitxersDocuments[0]).toEqual({ documentId: d.id, format: 'pdf', base64: btoa('%PDF-') })
  })

  it('el nom del fitxer, sense accents ni espais', () => {
    expect(nomFitxerExportacio('Àngela Núñez i Puig', new Date('2026-11-19T10:00:00Z'))).toBe('qi-dades-angela-nunez-i-puig-2026-11-19.json')
  })
})
