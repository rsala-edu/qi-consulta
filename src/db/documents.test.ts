import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import { compararFitxes, dadesAjuntades } from '../domini/ajuntar'
import { DOCUMENTS_EN_LOCAL, type DadesDocument } from '../domini/document'
import { baixarImatge, pujarImatgesPendents } from '../fotos/driveImatges'
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

const dades = (canvis: Partial<DadesDocument> = {}): DadesDocument => ({
  tipus: 'audiometria',
  titol: 'Audiometria tonal (inventada)',
  data: '2026-11-02',
  nota: '',
  episodiId: null,
  sessioId: null,
  valoracioId: null,
  format: 'pdf',
  pagines: 1,
  mida: 8,
  miniatura: '',
  afegitAt: '2026-11-13T10:00:00.000Z',
  origen: 'fitxer',
  anullat: null,
  ...canvis,
})
const PDF = new TextEncoder().encode('%PDF-1.7 inventat')
const text = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null)

describe('documents adjunts (magatzem)', () => {
  it('es desen xifrats (metadades i fitxer), pendents de pujar fins que van a Drive com a fitxers a part', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const d = await magatzem.afegirDocument(p.id, dades(), PDF)
    expect(JSON.stringify(await db.documents.toArray())).not.toContain('Audiometria')
    expect(JSON.stringify(await db.imatges.toArray())).not.toContain('PDF-1.7')
    expect([...(await magatzem.documentsPendentsDePujar([d.id]))]).toEqual([d.id])
    expect(text(await magatzem.fitxerDocument(d.id))).toBe('%PDF-1.7 inventat')

    const drive = driveDeProva()
    expect(await pujarImatgesPendents(db, drive)).toBe(1)
    expect([...drive.fitxers.values()].map((f) => f.nom)).toEqual([`qi-imatge-${d.id}.json`])
    expect((await magatzem.documentsPendentsDePujar([d.id])).size).toBe(0)

    // Un altre dispositiu (sense el fitxer): el baixa en obrir-lo
    await db.imatges.delete(d.id)
    expect(await magatzem.fitxerDocument(d.id)).toBeNull()
    await magatzem.desarFitxerDocumentBaixat(d.id, (await baixarImatge(drive, d.id))!)
    expect(text(await magatzem.fitxerDocument(d.id))).toBe('%PDF-1.7 inventat')
  })

  it('anul·lar: deixa de mostrar-se però es conserven el registre i el fitxer xifrat', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const d = await magatzem.afegirDocument(p.id, dades(), PDF)
    await expect(magatzem.anullarDocument(d.id, '  ')).rejects.toThrow()
    const a = await magatzem.anullarDocument(d.id, 'Era d\'un altre pacient (inventat)')
    expect(a.anullat).toMatchObject({ motiu: 'Era d\'un altre pacient (inventat)' })
    expect(text(await magatzem.fitxerDocument(d.id))).toBe('%PDF-1.7 inventat')
    expect((await magatzem.documentsDe(p.id)).map((x) => x.id)).toEqual([d.id])
    await expect(magatzem.anullarDocument(d.id, 'Un altre')).rejects.toThrow()
  })

  it('al dispositiu es guarden només els fitxers baixats més recents; els pendents de pujar mai no es treuen', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const pendent = await magatzem.afegirDocument(p.id, dades(), PDF)
    const drive = driveDeProva()
    const ids: string[] = []
    for (let i = 0; i < DOCUMENTS_EN_LOCAL + 3; i++) {
      const id = `doc-${String(i).padStart(2, '0')}`
      await drive.crear(`qi-imatge-${id}.json`, JSON.stringify((await db.imatges.get(pendent.id))!.xifrat))
      ids.push(id)
    }
    for (const id of ids) await magatzem.desarFitxerDocumentBaixat(id, (await baixarImatge(drive, id))!)
    const locals = (await db.imatges.toArray()).filter((r) => r.pujada === 1).map((r) => r.id)
    expect(locals).toHaveLength(DOCUMENTS_EN_LOCAL)
    expect(locals).not.toContain('doc-00')
    expect(await db.imatges.get(pendent.id)).toBeDefined()
  })

  it('en ajuntar dues fitxes, els documents passen a la que queda (i tornen si es desfà)', async () => {
    const queda = await magatzem.crearPacient(pacientInventat({ nom: 'Queda' }))
    const treu = await magatzem.crearPacient(pacientInventat({ nom: 'Treu' }))
    const d = await magatzem.afegirDocument(treu.id, dades(), PDF)
    const camps = compararFitxes(await magatzem.dadesPerAjuntar(queda.id), await magatzem.dadesPerAjuntar(treu.id))
    const informe = await magatzem.ajuntarPacients(queda.id, treu.id, dadesAjuntades(camps, {}))
    expect((await magatzem.documentsDe(queda.id)).map((x) => x.id)).toEqual([d.id])
    expect(await magatzem.documentsDe(treu.id)).toEqual([])
    expect(informe).toBeDefined()
  })
})
