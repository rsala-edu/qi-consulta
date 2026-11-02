import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { novaCita } from '../domini/cita'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import { QiDB } from './esquema'
import { crearMagatzem, type Magatzem } from './magatzem'
import { migrarTipusVisita, recalcularTipusVisita } from './tipusVisita'

let db: QiDB
let m: Magatzem
beforeEach(async () => {
  db = new QiDB(`prova-${crypto.randomUUID()}`)
  m = crearMagatzem(db, await clauDeProva())
})
afterEach(async () => {
  await db.delete()
})

describe('tipus de visita a les cites desades', () => {
  it('migració: una sola vegada, a les cites programades que ja hi ha; les fetes no canvien', async () => {
    const p = await m.crearPacient(pacientInventat())
    // Dades d'abans de la regla: dos seguiments i cap primera visita
    await m.crearCita({ ...novaCita(p.id, '2026-10-01T10:00', 'seguiment'), estat: 'feta' })
    const a = await m.crearCita(novaCita(p.id, '2026-11-10T10:00', 'primera'))
    expect(await migrarTipusVisita(db, m)).toBe(1)
    expect((await m.obtenirCita(a.id))?.tipus).toBe('seguiment')
    expect((await m.llistarCites('0000', '9999')).find((c) => c.estat === 'feta')?.tipus).toBe('seguiment')
    // La segona vegada no fa res
    await m.actualitzarCita(a.id, { ...a, tipus: 'primera' })
    expect(await migrarTipusVisita(db, m)).toBe(0)
  })

  it('en anul·lar la primera visita, la següent passa a ser la primera', async () => {
    const p = await m.crearPacient(pacientInventat())
    const a = await m.crearCita(novaCita(p.id, '2026-11-03T10:00', 'primera'))
    const b = await m.crearCita(novaCita(p.id, '2026-11-10T10:00', 'seguiment'))
    await m.actualitzarCita(a.id, { ...a, estat: 'anullada' })
    const canvis = await recalcularTipusVisita(m, [p.id])
    expect(canvis).toEqual([{ id: b.id, inici: b.inici, tipus: 'primera' }])
    expect((await m.obtenirCita(b.id))?.tipus).toBe('primera')
  })
})
