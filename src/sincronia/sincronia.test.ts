// @vitest-environment node
// Còpies diàries i mensuals i client de Google Drive. El motor de sincronia
// (dos dispositius, fusió, migració…) es prova a motor.test.ts.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { crearClauMestra } from '../crypto'
import { QiDB } from '../db/esquema'
import { crearMagatzem, guardarClauEmbolcallada } from '../db/magatzem'
import { pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { driveGoogle, ErrorAutoritzacio } from './drive'
import { sincronitzar } from './sincronitzar'

const obertes: QiDB[] = []
afterEach(async () => {
  for (const db of obertes.splice(0)) await db.delete()
})

async function dispositiuA() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  const { embolcall, clau } = await crearClauMestra('contrasenya-de-prova', 1_000)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, magatzem: crearMagatzem(db, clau) }
}

describe('còpies a Google Drive', () => {
  it('guarda una còpia diària 30 dies i una de mensual 12 mesos', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    await a.magatzem.crearPacient(pacientInventat())
    for (let d = 0; d < 400; d += 3) await sincronitzar(a.db, a.clau, drive, new Date(Date.UTC(2026, 0, 1 + d, 9)))
    const noms = [...drive.fitxers.values()].map((f) => f.name)
    const diaries = noms.filter((n) => n.startsWith('qi-copia-'))
    const mensuals = noms.filter((n) => n.startsWith('qi-mensual-'))
    expect(diaries.length).toBeGreaterThanOrEqual(10)
    expect(diaries.length).toBeLessThanOrEqual(11)
    expect(mensuals.length).toBeLessThanOrEqual(13)
    expect(mensuals.length).toBeGreaterThanOrEqual(12)
  })
})

describe('client de Google Drive', () => {
  it('fa servir la carpeta de l\'app i el permís de la doctora', async () => {
    const crides: { url: string; init: RequestInit }[] = []
    const fetchFals = (async (url: string, init: RequestInit = {}) => {
      crides.push({ url, init })
      if (url.includes('/upload/')) return new Response(JSON.stringify({ id: 'f1', name: 'qi-dades.json', modifiedTime: 'x' }))
      return new Response(JSON.stringify({ files: [] }))
    }) as typeof fetch
    const drive = driveGoogle(() => 'token-de-prova', fetchFals)
    await drive.llistar()
    await drive.crear('qi-dades.json', '{"format":"qi-copia"}')
    expect(crides[0]!.url).toContain('spaces=appDataFolder')
    expect((crides[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer token-de-prova')
    expect(crides[1]!.url).toContain('uploadType=multipart')
    expect(String(crides[1]!.init.body)).toContain('"parents":["appDataFolder"]')
  })

  it('sense permís o amb el permís caducat demana tornar a connectar', async () => {
    await expect(driveGoogle(() => null).llistar()).rejects.toThrow(ErrorAutoritzacio)
    const caducat = driveGoogle(() => 't', (async () => new Response('', { status: 401 })) as typeof fetch)
    await expect(caducat.llistar()).rejects.toThrow(ErrorAutoritzacio)
  })
})
