// «Desvincular aquest dispositiu». Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { crearClauMestra, ErrorContrasenya } from '../crypto'
import { QiDB } from '../db/esquema'
import { crearMagatzem, guardarClauEmbolcallada } from '../db/magatzem'
import { pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { sincronitzar } from '../sincronia/sincronitzar'
import { desvincular, ErrorPendents } from './desvincular'
import { espaisConeguts, marcarEspaiActual, nomEspai } from './espais'

const P = 'contrasenya-de-prova'
afterEach(async () => {
  for (const d of await indexedDB.databases()) if (d.name) await QiDB.delete(d.name)
  localStorage.clear()
})

async function espai() {
  const db = new QiDB(await nomEspai('sub-doctora'))
  const { embolcall, clau } = await crearClauMestra(P, 1_000)
  await guardarClauEmbolcallada(db, embolcall)
  marcarEspaiActual(db.name)
  return { db, clau, m: crearMagatzem(db, clau) }
}

describe('desvincular aquest dispositiu', () => {
  it('amb una contrasenya equivocada no es toca res', async () => {
    const a = await espai()
    await a.m.crearPacient(pacientInventat())
    await expect(desvincular(a.db, 'no-es-aquesta', async () => true)).rejects.toBeInstanceOf(ErrorContrasenya)
    expect(await a.db.pacients.count()).toBe(1)
  })

  it('si queda res per pujar a Drive, no s\'esborra res', async () => {
    const a = await espai()
    await a.m.crearPacient(pacientInventat())
    // La sincronia no ha pogut pujar (sense connexió)
    await expect(desvincular(a.db, P, async () => true)).rejects.toBeInstanceOf(ErrorPendents)
    expect(await a.db.pacients.count()).toBe(1)
  })

  it('quan tot és a Drive: esborra la base de dades i l\'espai d\'aquest navegador; Drive queda igual i es pot recuperar', async () => {
    const drive = driveEnMemoria()
    const a = await espai()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive)
    const abans = JSON.stringify([...drive.fitxers.values()])
    const nom = a.db.name
    await desvincular(a.db, P, async () => {
      await sincronitzar(a.db, a.clau, drive)
      return true
    })
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(nom)
    expect(espaisConeguts()).toEqual([])
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
  })
})
