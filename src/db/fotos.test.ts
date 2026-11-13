import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import type { DadesFoto } from '../domini/foto'
import { pujarImatgesPendents, baixarImatge } from '../fotos/driveImatges'
import type { Drive, FitxerDrive } from '../sincronia/drive'
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

/** Drive en memòria (inventat) */
function driveDeProva(): Drive & { fitxers: Map<string, { nom: string; text: string }> } {
  const fitxers = new Map<string, { nom: string; text: string }>()
  const f = (id: string): FitxerDrive => ({ id, name: fitxers.get(id)!.nom, modifiedTime: new Date().toISOString() })
  return {
    fitxers,
    async llistar() {
      return [...fitxers.keys()].map(f)
    },
    async baixar(id) {
      return fitxers.get(id)!.text
    },
    async crear(nom, text) {
      const id = crypto.randomUUID()
      fitxers.set(id, { nom, text })
      return f(id)
    },
    async actualitzar(id, text) {
      fitxers.set(id, { ...fitxers.get(id)!, text })
      return f(id)
    },
    async esborrar(id) {
      fitxers.delete(id)
    },
  }
}

const dades = (): DadesFoto => ({
  episodiId: null,
  sessioId: null,
  zona: 'llengua',
  nota: 'Saburra blanca (inventat)',
  presaAt: '2026-11-13T10:00:00.000Z',
  amplada: 1600,
  alcada: 1200,
  mida: 4,
  miniatura: 'data:image/jpeg;base64,AAAA',
  esborrada: null,
})

describe('fotos (magatzem i Drive)', () => {
  it('metadades i imatge xifrades; la imatge es puja a part i es pot tornar a baixar', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const foto = await magatzem.afegirFoto(p.id, dades(), jpeg)
    expect(await magatzem.imatgeDe(foto.id)).toEqual(jpeg)
    expect(JSON.stringify(await db.fotos.toArray())).not.toContain('Saburra')
    // A Drive, un fitxer per foto, xifrat
    const drive = driveDeProva()
    expect(await pujarImatgesPendents(db, drive)).toBe(1)
    expect([...drive.fitxers.values()].map((x) => x.nom)).toEqual([`qi-imatge-${foto.id}.json`])
    expect(await pujarImatgesPendents(db, drive)).toBe(0)
    // En un altre dispositiu (sense la imatge local): es baixa en obrir-la
    await db.imatges.clear()
    expect(await magatzem.imatgeDe(foto.id)).toBeNull()
    await magatzem.desarImatgeBaixada(foto.id, (await baixarImatge(drive, foto.id))!)
    expect(await magatzem.imatgeDe(foto.id)).toEqual(jpeg)
  })

  it('esborrar: queda el registre (quan i per què) sense la imatge ni la miniatura', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const foto = await magatzem.afegirFoto(p.id, dades(), new Uint8Array([1, 2, 3]))
    const e = await magatzem.esborrarFoto(foto.id, 'Repetida (inventat)')
    expect(e.esborrada?.motiu).toBe('Repetida (inventat)')
    expect(e.miniatura).toBe('')
    expect(await magatzem.imatgeDe(foto.id)).toBeNull()
    expect(await magatzem.fotosDe(p.id)).toHaveLength(1)
  })
})
