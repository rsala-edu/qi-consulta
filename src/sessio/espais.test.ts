// Espais per compte: la base de dades antiga («qi») es migra a l'espai del
// compte que la va crear. Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { QiDB } from '../db/esquema'
import { BASE_ANTIGA, espaiInicial, espaisConeguts, marcarEspaiActual, nomEspai } from './espais'

afterEach(async () => {
  for (const d of await indexedDB.databases()) if (d.name) await QiDB.delete(d.name)
  localStorage.clear()
})

async function baseAntiga(sub?: string) {
  const db = new QiDB(BASE_ANTIGA)
  await db.meta.put({ clau: 'clauMestra', valor: { sal: 'x', iteracions: 1, iv: 'y', clau: 'z' } as never })
  if (sub) await db.meta.put({ clau: 'google', valor: { connectatAt: '2026-11-01T10:00:00.000Z', ultimaCopia: null, sub } })
  await db.pacients.put({ id: 'p1', creatAt: 'a', modificatAt: 'b', xifrat: { iv: 'i', dades: 'd' } })
  db.close()
}

describe('espais per compte', () => {
  it('el nom depèn del compte (sub), no porta ni el correu ni el sub en clar', async () => {
    const a = await nomEspai('sub-doctora')
    expect(a).toMatch(/^qi-[0-9a-f]{16}$/)
    expect(a).not.toContain('doctora')
    expect(await nomEspai('sub-doctora')).toBe(a)
    expect(await nomEspai('sub-proves')).not.toBe(a)
  })

  it('migra la base de dades antiga a l\'espai del seu compte i l\'esborra', async () => {
    await baseAntiga('sub-doctora')
    const db = (await espaiInicial())!
    expect(db.name).toBe(await nomEspai('sub-doctora'))
    expect(await db.pacients.get('p1')).toMatchObject({ id: 'p1', xifrat: { iv: 'i', dades: 'd' } })
    expect(await db.meta.get('clauMestra')).toBeDefined()
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(BASE_ANTIGA)
    expect(espaisConeguts()).toEqual([db.name])
    db.close()
  })

  it('si la base antiga no sap de quin compte és, s\'obre tal qual (es migrarà en connectar amb Google)', async () => {
    await baseAntiga()
    const db = (await espaiInicial())!
    expect(db.name).toBe(BASE_ANTIGA)
    db.close()
  })

  it('obre l\'últim espai fet servir; sense cap espai, null', async () => {
    expect(await espaiInicial()).toBeNull()
    const a = new QiDB(await nomEspai('sub-a'))
    const b = new QiDB(await nomEspai('sub-b'))
    await a.open()
    await b.open()
    marcarEspaiActual(a.name)
    marcarEspaiActual(b.name)
    a.close()
    b.close()
    const db = (await espaiInicial())!
    expect(db.name).toBe(b.name)
    db.close()
  })
})
