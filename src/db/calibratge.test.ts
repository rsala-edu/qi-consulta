// @vitest-environment node
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { desarCalibracio, descartarCalibratge, esborrarCalibracio, llistarCalibratge } from './calibratge'
import { desarCorreccioOrella, llegirCorreccionsOrella, treureCorreccioOrella } from './calibratgeOrella'
import { QiDB } from './esquema'
import {
  confirmarCategoria,
  desarExcepcio,
  desconfirmarCategoria,
  llegirRevisioPrecaucions,
  treureExcepcio,
} from './precaucions'

let db: QiDB
beforeEach(() => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

const pos = (triangle: number) => ({
  topologia: 't1',
  costat: 'E' as const,
  triangle,
  b: [1, 0, 0] as [number, number, number],
  origen: 'manual' as const,
})

describe('calibratge local', () => {
  it('desa, substitueix i llista per topologia', async () => {
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(1))
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(2))
    await desarCalibracio(db, 't2', 'LI4', 'E', { ...pos(3), topologia: 't2' })
    const t1 = await llistarCalibratge(db, 't1')
    expect(t1).toEqual([{ codi: 'LI4', topologia: 't1', costat: 'E', posicio: pos(2) }])
  })

  it("recorda que una posició s'ha esborrat", async () => {
    await desarCalibracio(db, 't1', 'ST36', 'D', null)
    expect((await llistarCalibratge(db, 't1'))[0]?.posicio).toBeNull()
  })

  it("oblida la correcció d'un sol punt i costat", async () => {
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(1))
    await desarCalibracio(db, 't1', 'LI4', 'D', { ...pos(1), costat: 'D' })
    await esborrarCalibracio(db, 't1', 'LI4', 'E')
    expect((await llistarCalibratge(db, 't1')).map((k) => k.costat)).toEqual(['D'])
  })

  it('desa i oblida cada subpunt per separat (Jiaji)', async () => {
    await desarCalibracio(db, 't1', 'EX-B2', 'E', pos(1))
    await desarCalibracio(db, 't1', 'EX-B2', 'E', { ...pos(2), index: 5 }, 5)
    expect(await llistarCalibratge(db, 't1')).toHaveLength(2)
    await esborrarCalibracio(db, 't1', 'EX-B2', 'E', 5)
    expect(await llistarCalibratge(db, 't1')).toEqual([{ codi: 'EX-B2', topologia: 't1', costat: 'E', posicio: pos(1) }])
  })

  it('descarta només la topologia indicada', async () => {
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(1))
    await desarCalibracio(db, 't2', 'LI4', 'E', { ...pos(1), topologia: 't2' })
    await descartarCalibratge(db, 't1')
    expect(await llistarCalibratge(db, 't1')).toEqual([])
    expect(await llistarCalibratge(db, 't2')).toHaveLength(1)
  })
})

describe('precaucions revisades', () => {
  it('confirma categories i les pot tornar a pendent', async () => {
    await confirmarCategoria(db, 'embaras')
    await confirmarCategoria(db, 'pulmo')
    await desconfirmarCategoria(db, 'pulmo')
    const r = await llegirRevisioPrecaucions(db)
    expect(r.categories).toEqual(['embaras'])
    expect(r.confirmacions[0]!.confirmadaAt).toMatch(/^\d{4}-/)
  })

  it('desa una excepció per punt, la substitueix i la treu', async () => {
    await desarExcepcio(db, 'LI4', {
      categories: ['profunditat', 'embaras'],
      nota: ' Embaràs. ',
    })
    await desarExcepcio(db, 'LI4', {
      categories: ['embaras'],
      nota: 'Embaràs: no punxar.',
    })
    let r = await llegirRevisioPrecaucions(db)
    expect(r.excepcions).toHaveLength(1)
    expect(r.excepcions[0]).toMatchObject({
      codi: 'LI4',
      categories: ['embaras'],
      nota: 'Embaràs: no punxar.',
    })
    await desarExcepcio(db, 'ST9', {
      categories: ['profunditat', 'vasos'],
      nota: 'x',
    })
    r = await llegirRevisioPrecaucions(db)
    expect(r.excepcions.find((e) => e.codi === 'ST9')!.categories).toEqual(['vasos', 'profunditat'])
    await treureExcepcio(db, 'LI4')
    expect((await llegirRevisioPrecaucions(db)).excepcions.map((e) => e.codi)).toEqual(['ST9'])
  })
})

describe('migració de les precaucions confirmades punt per punt', () => {
  it('passen a ser excepcions amb les categories del catàleg', async () => {
    const nom = `prova-v4-${crypto.randomUUID()}`
    // Base de dades amb l'esquema antic (versió 4)
    const antiga = new Dexie(nom)
    antiga.version(4).stores({
      meta: 'clau',
      pacients: 'id, modificatAt',
      fitxesCliniques: 'id, &pacientId',
      esborranys: 'id, modificatAt',
      calibratge: 'id, topologia',
      precaucions: 'codi',
    })
    await antiga.open()
    await antiga.table('precaucions').bulkPut([
      {
        codi: 'GB21',
        embaras: true,
        nota: 'Text de la doctora.',
        confirmadaAt: '2026-10-30T10:00:00.000Z',
      },
      {
        codi: 'LI4',
        embaras: false,
        nota: 'Ja no és contraindicat.',
        confirmadaAt: '2026-10-30T10:00:00.000Z',
      },
      {
        codi: 'ST36',
        embaras: false,
        nota: 'Nota nova.',
        confirmadaAt: '2026-10-30T10:00:00.000Z',
      },
    ])
    antiga.close()

    const nova = new QiDB(nom)
    const r = await llegirRevisioPrecaucions(nova)
    const per = new Map(r.excepcions.map((e) => [e.codi, e]))
    expect(per.get('GB21')).toEqual({
      codi: 'GB21',
      categories: ['embaras', 'pulmo'],
      nota: 'Text de la doctora.',
      confirmadaAt: '2026-10-30T10:00:00.000Z',
    })
    // sense embaràs però amb text: queda com a avís informatiu
    expect(per.get('LI4')!.categories).toEqual(['profunditat'])
    expect(per.get('ST36')!.categories).toEqual(['profunditat'])
    expect(r.categories).toEqual([])
    await nova.delete()
  })
})

describe('correccions de l\'orella', () => {
  it('desa, substitueix i treu la posició corregida d\'un punt', async () => {
    await desarCorreccioOrella(db, 'TF4', 190.04, 97.66)
    await desarCorreccioOrella(db, 'CO15', 150, 250)
    await desarCorreccioOrella(db, 'TF4', 191, 98)
    expect([...(await llegirCorreccionsOrella(db))]).toEqual([
      ['CO15', { x: 150, y: 250 }],
      ['TF4', { x: 191, y: 98 }],
    ])
    await treureCorreccioOrella(db, 'TF4')
    expect([...(await llegirCorreccionsOrella(db)).keys()]).toEqual(['CO15'])
    // l'esborrat viatja a la còpia, perquè no torni des d'un altre dispositiu
    expect(await db.esborrats.get('calibratgeOrella:TF4')).toBeDefined()
  })
})
