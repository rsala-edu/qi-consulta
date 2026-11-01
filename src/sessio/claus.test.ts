// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { crearClauMestra, desbloquejarClauMestra, desxifrarJson, ErrorContrasenya, xifrarJson } from '../crypto'
import { QiDB } from '../db/esquema'
import { guardarClauEmbolcallada, llegirClauEmbolcallada, llegirSecrets } from '../db/magatzem'
import {
  activarEmpremta,
  desactivarEmpremta,
  desbloquejarAmbEmpremta,
  ErrorClauRecuperacio,
  novaClauRecuperacio,
  recuperarAmbClau,
  teClauRecuperacio,
  teEmpremta,
} from './claus'

// Autenticador simulat: sempre el mateix secret PRF per a la mateixa credencial
const autenticador = vi.hoisted(() => ({ secret: new Uint8Array(32).fill(7), credencial: new Uint8Array([1, 2, 3, 4]) }))
vi.mock('../crypto/passkey', async (original) => ({
  ...(await original<typeof import('../crypto/passkey')>()),
  crearPasskey: vi.fn(async () => ({
    credencial: autenticador.credencial,
    salPrf: new Uint8Array(32).fill(1),
    secret: autenticador.secret,
  })),
  secretPasskey: vi.fn(async () => ({ credencial: autenticador.credencial, secret: autenticador.secret })),
}))

const CONTRASENYA = 'contrasenya-de-prova'
let db: QiDB
let dades: Awaited<ReturnType<typeof xifrarJson>>
beforeEach(async () => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
  const { embolcall, clau } = await crearClauMestra(CONTRASENYA, 1_000)
  await guardarClauEmbolcallada(db, embolcall)
  dades = await xifrarJson(clau, { nom: 'Pacient Inventat' }, 'ctx')
})
afterEach(async () => {
  await db.delete()
})

describe('empremta', () => {
  it('s\'activa amb la contrasenya i obre la mateixa clau mestra', async () => {
    expect(await teEmpremta(db)).toBe(false)
    await expect(activarEmpremta(db, 'incorrecta')).rejects.toThrow(ErrorContrasenya)
    await activarEmpremta(db, CONTRASENYA)
    expect(await teEmpremta(db)).toBe(true)
    const clau = await desbloquejarAmbEmpremta(db)
    expect(await desxifrarJson(clau, dades, 'ctx')).toEqual({ nom: 'Pacient Inventat' })
    await desactivarEmpremta(db)
    expect(await teEmpremta(db)).toBe(false)
  })
})

describe('clau de recuperació', () => {
  it('amb la clau impresa es posa una contrasenya nova sense perdre dades', async () => {
    const text = await novaClauRecuperacio(db, CONTRASENYA)
    expect(await teClauRecuperacio(db)).toBe(true)
    const clau = await recuperarAmbClau(db, text.toLowerCase(), 'contrasenya-nova-llarga')
    expect(await desxifrarJson(clau, dades, 'ctx')).toEqual({ nom: 'Pacient Inventat' })
    const embolcall = (await llegirClauEmbolcallada(db))!
    await expect(desbloquejarClauMestra(embolcall, 'contrasenya-nova-llarga')).resolves.toBeDefined()
    await expect(desbloquejarClauMestra(embolcall, CONTRASENYA)).rejects.toThrow(ErrorContrasenya)
  }, 20_000)

  it('una clau nova substitueix l\'anterior; una clau errònia no obre res', async () => {
    const vella = await novaClauRecuperacio(db, CONTRASENYA)
    const nova = await novaClauRecuperacio(db, CONTRASENYA)
    expect((await llegirSecrets(db)).filter((s) => s.tipus === 'recuperacio')).toHaveLength(1)
    await expect(recuperarAmbClau(db, vella, 'x-contrasenya-nova')).rejects.toThrow(ErrorClauRecuperacio)
    await expect(recuperarAmbClau(db, 'ABCD-EFGH', 'x-contrasenya-nova')).rejects.toThrow(ErrorClauRecuperacio)
    await expect(recuperarAmbClau(db, nova, 'x-contrasenya-nova')).resolves.toBeDefined()
  }, 20_000)
})
