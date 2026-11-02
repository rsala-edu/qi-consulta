import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { HORARI_PER_DEFECTE } from '../domini/agenda'
import { canviarDiaTancat, desarHorari, llegirDiesTancats, llegirHorari } from './agenda'
import { QiDB } from './esquema'

let db: QiDB
beforeEach(() => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('horari i dies tancats', () => {
  it('l\'horari per defecte i el desat', async () => {
    expect(await llegirHorari(db)).toEqual(HORARI_PER_DEFECTE)
    await desarHorari(db, { inici: 8 * 60, fi: 14 * 60, dies: [5, 1, 3, 3] })
    expect(await llegirHorari(db)).toEqual({ inici: 480, fi: 840, dies: [1, 3, 5] })
    await expect(desarHorari(db, { inici: 600, fi: 540, dies: [1] })).rejects.toThrow()
  })

  it('marcar i desmarcar un dia tancat (i que l\'esborrat arribi als altres dispositius)', async () => {
    await canviarDiaTancat(db, '2026-12-08', true)
    expect([...(await llegirDiesTancats(db))]).toEqual(['2026-12-08'])
    await canviarDiaTancat(db, '2026-12-08', false)
    expect((await llegirDiesTancats(db)).size).toBe(0)
    expect(await db.esborrats.get('diesTancats:2026-12-08')).toBeDefined()
  })
})
