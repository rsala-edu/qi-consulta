// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ErrorDesxifratge } from '../crypto'
import { clauDeProva, fitxaInventada, pacientInventat } from '../test/dadesInventades'
import { QiDB } from './esquema'
import { crearMagatzem, type Magatzem } from './magatzem'

let db: QiDB
let clau: CryptoKey
let magatzem: Magatzem

beforeEach(async () => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
  clau = await clauDeProva()
  magatzem = crearMagatzem(db, clau)
})

afterEach(async () => {
  await db.delete()
})

describe('pacients', () => {
  it('crea i llegeix un pacient', async () => {
    const creat = await magatzem.crearPacient(pacientInventat())
    expect(creat.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(creat.arxivat).toBe(false)
    expect(await magatzem.obtenirPacient(creat.id)).toEqual(creat)
  })

  it('no guarda res en clar a IndexedDB', async () => {
    const creat = await magatzem.crearPacient(pacientInventat())
    const brut = JSON.stringify(await db.pacients.get(creat.id))
    for (const valor of ['Aina', 'Provencal', '600 111 222', 'aina@exemple', '1980-05-17', 'arxivat']) {
      expect(brut).not.toContain(valor)
    }
  })

  it('edita un pacient conservant creatAt i actualitzant modificatAt', async () => {
    const creat = await magatzem.crearPacient(pacientInventat())
    await new Promise((r) => setTimeout(r, 5))
    const editat = await magatzem.actualitzarPacient(creat.id, pacientInventat({ telefon: '611 000 000' }))
    expect(editat.telefon).toBe('611 000 000')
    expect(editat.creatAt).toBe(creat.creatAt)
    expect(editat.modificatAt > creat.modificatAt).toBe(true)
    expect(await db.pacients.count()).toBe(1)
  })

  it('arxiva i recupera sense esborrar, i editar no el desarxiva', async () => {
    const creat = await magatzem.crearPacient(pacientInventat())
    await magatzem.arxivarPacient(creat.id, true)
    const editat = await magatzem.actualitzarPacient(creat.id, pacientInventat({ nom: 'Aina Maria' }))
    expect(editat.arxivat).toBe(true)
    expect(await magatzem.llistarPacients()).toHaveLength(1)
    expect((await magatzem.arxivarPacient(creat.id, false)).arxivat).toBe(false)
  })

  it('rebutja dades invàlides', async () => {
    await expect(magatzem.crearPacient(pacientInventat({ nom: '  ' }))).rejects.toThrow()
    expect(await db.pacients.count()).toBe(0)
  })

  it('amb una altra clau no es pot llegir', async () => {
    const creat = await magatzem.crearPacient(pacientInventat())
    const altre = crearMagatzem(db, await clauDeProva())
    await expect(altre.obtenirPacient(creat.id)).rejects.toBeInstanceOf(ErrorDesxifratge)
  })

  it('no accepta un registre xifrat copiat d\'un altre pacient', async () => {
    const a = await magatzem.crearPacient(pacientInventat())
    const b = await magatzem.crearPacient(pacientInventat({ nom: 'Bernat' }))
    const registreA = await db.pacients.get(a.id)
    await db.pacients.update(b.id, { xifrat: registreA!.xifrat })
    await expect(magatzem.obtenirPacient(b.id)).rejects.toBeInstanceOf(ErrorDesxifratge)
  })
})

describe('fitxa clínica', () => {
  it('és buida si encara no s\'ha omplert, i no es guarda', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const fitxa = await magatzem.obtenirFitxaClinica(p.id)
    expect(fitxa.alergies).toBe('')
    expect(fitxa.contraindicacions.anticoagulants).toBe(false)
    expect(await db.fitxesCliniques.count()).toBe(0)
  })

  it('es desa xifrada i n\'hi ha només una per pacient', async () => {
    const p = await magatzem.crearPacient(pacientInventat())
    const primera = await magatzem.desarFitxaClinica(p.id, fitxaInventada())
    const segona = await magatzem.desarFitxaClinica(p.id, { ...fitxaInventada(), alergies: 'Cap' })

    expect(segona.id).toBe(primera.id)
    expect(segona.creatAt).toBe(primera.creatAt)
    expect(await db.fitxesCliniques.count()).toBe(1)
    expect((await magatzem.obtenirFitxaClinica(p.id)).alergies).toBe('Cap')

    const brut = JSON.stringify(await db.fitxesCliniques.toArray())
    expect(brut).not.toContain('Penicil')
    expect(brut).not.toContain('hipertensió')
    expect(brut).not.toContain('anticoagulants')
  })

  it('no es pot desar per a un pacient que no existeix', async () => {
    await expect(magatzem.desarFitxaClinica(crypto.randomUUID(), fitxaInventada())).rejects.toThrow()
  })
})
