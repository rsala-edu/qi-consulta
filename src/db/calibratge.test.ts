// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { desarCalibracio, descartarCalibratge, esborrarCalibracio, llistarCalibratge } from './calibratge'
import { QiDB } from './esquema'
import { confirmarPrecaucio, llistarPrecaucions } from './precaucions'

let db: QiDB
beforeEach(() => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

const pos = (triangle: number) => ({ topologia: 't1', costat: 'E' as const, triangle, b: [1, 0, 0] as [number, number, number], origen: 'manual' as const })

describe('calibratge local', () => {
  it('desa, substitueix i llista per topologia', async () => {
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(1))
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(2))
    await desarCalibracio(db, 't2', 'LI4', 'E', { ...pos(3), topologia: 't2' })
    const t1 = await llistarCalibratge(db, 't1')
    expect(t1).toEqual([{ codi: 'LI4', topologia: 't1', costat: 'E', posicio: pos(2) }])
  })

  it('recorda que una posició s\'ha esborrat', async () => {
    await desarCalibracio(db, 't1', 'ST36', 'D', null)
    expect((await llistarCalibratge(db, 't1'))[0]?.posicio).toBeNull()
  })

  it('oblida la correcció d\'un sol punt i costat', async () => {
    await desarCalibracio(db, 't1', 'LI4', 'E', pos(1))
    await desarCalibracio(db, 't1', 'LI4', 'D', { ...pos(1), costat: 'D' })
    await esborrarCalibracio(db, 't1', 'LI4', 'E')
    expect((await llistarCalibratge(db, 't1')).map((k) => k.costat)).toEqual(['D'])
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
  it('desa la confirmació i la substitueix si es torna a revisar', async () => {
    await confirmarPrecaucio(db, 'LI4', { embaras: true, nota: ' Embaràs. ' })
    await confirmarPrecaucio(db, 'LI4', { embaras: true, nota: 'Embaràs: no punxar.' })
    const l = await llistarPrecaucions(db)
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ codi: 'LI4', embaras: true, nota: 'Embaràs: no punxar.' })
    expect(l[0]!.confirmadaAt).toMatch(/^\d{4}-/)
  })
})
