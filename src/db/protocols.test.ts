import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clauDeProva } from '../test/dadesInventades'
import { duplicar } from '../domini/protocol'
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

describe('protocols (magatzem)', () => {
  it('els exemples es creen una sola vegada, xifrats; si se n\'esborra un no torna', async () => {
    const p = await magatzem.protocols()
    expect(p).toHaveLength(5)
    expect(p.every((x) => x.exemple)).toBe(true)
    expect(JSON.stringify(await db.protocols.toArray())).not.toContain('LR3')
    await magatzem.esborrarProtocol(p[0]!.id)
    expect(await magatzem.protocols()).toHaveLength(4)
  })

  it('crear, duplicar i arxivar', async () => {
    const [base] = await magatzem.protocols()
    const { id: _i, creatAt: _c, modificatAt: _m, ...dades } = base!
    const copia = await magatzem.desarProtocol(null, duplicar(dades, '(còpia)'))
    expect(copia.exemple).toBe(false)
    await magatzem.desarProtocol(copia.id, { ...duplicar(dades, ''), nom: copia.nom, arxivat: true })
    const tots = await magatzem.protocols()
    expect(tots.find((x) => x.id === copia.id)?.arxivat).toBe(true)
    expect(tots).toHaveLength(6)
  })
})
