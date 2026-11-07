// Episodis, sessions i addendes al magatzem (etapa 3A). Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { novaCita } from '../domini/cita'
import { nouPuntMarcat } from '../domini/puntMarcat'
import { mapaPunts } from '../domini/sessio'
import { clauDeProva, pacientInventat } from '../test/dadesInventades'
import { desarPerCamp } from '../sincronia/escriptura'
import { migrarEpisodis } from './episodis'
import { QiDB } from './esquema'
import { crearMagatzem, ErrorSessioBloquejada } from './magatzem'

const obertes: QiDB[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const db of obertes.splice(0)) await db.delete()
})

async function nou() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  const clau = await clauDeProva()
  return { db, clau, m: crearMagatzem(db, clau) }
}

describe('episodis de les cites', () => {
  it('la primera cita obre un episodi; les de seguiment s\'hi enganxen; «Nou episodi» n\'obre un altre', async () => {
    const { m } = await nou()
    const p = await m.crearPacient(pacientInventat())
    const c1 = await m.crearCita({ ...novaCita(p.id, '2026-11-02T10:00', 'primera'), motiu: 'Lumbàlgia' })
    const c2 = await m.crearCita(novaCita(p.id, '2026-11-09T10:00'))
    const c3 = await m.crearCita({ ...novaCita(p.id, '2026-11-16T10:00', 'primera'), motiu: 'Acúfens', nouEpisodi: true })
    const c4 = await m.crearCita(novaCita(p.id, '2026-11-23T10:00'))
    const episodis = await m.llistarEpisodis(p.id)
    expect(episodis.map((e) => e.motiu)).toEqual(['Lumbàlgia', 'Acúfens'])
    expect([c1.episodiId, c2.episodiId]).toEqual([episodis[0]!.id, episodis[0]!.id])
    // El seguiment va a l'actiu més recent
    expect([c3.episodiId, c4.episodiId]).toEqual([episodis[1]!.id, episodis[1]!.id])
  })

  it('migració: les cites d\'abans reben episodi una sola vegada', async () => {
    const { db, m, clau } = await nou()
    const p = await m.crearPacient(pacientInventat())
    const c = await m.crearCita({ ...novaCita(p.id, '2026-10-02T10:00', 'primera'), motiu: 'Lumbàlgia' })
    // Com si fos d'abans de l'etapa 3A: la cita sense episodi i cap episodi
    const { pacientId, inici, id: _i, creatAt, modificatAt, ...resta } = (await m.obtenirCita(c.id))!
    await desarPerCamp(db, clau, 'cites', { id: c.id, creatAt, modificatAt, pacientId, inici }, { ...resta, episodiId: null })
    await db.episodis.clear()
    expect((await m.obtenirCita(c.id))!.episodiId).toBeNull()
    expect(await migrarEpisodis(db, m)).toBe(1)
    const episodis = await m.llistarEpisodis(p.id)
    expect(episodis.map((e) => e.motiu)).toEqual(['Lumbàlgia'])
    expect((await m.obtenirCita(c.id))!.episodiId).toBe(episodis[0]!.id)
    expect(await migrarEpisodis(db, m)).toBe(0)
  })
})

describe('sessions', () => {
  it('començar visita: crea la sessió (número dins l\'episodi) i posa la cita en curs; tornar-hi obre la mateixa', async () => {
    const { m } = await nou()
    const p = await m.crearPacient(pacientInventat())
    const c1 = await m.crearCita({ ...novaCita(p.id, '2026-11-02T10:00', 'primera'), motiu: 'Lumbàlgia' })
    const s1 = await m.comencarVisita(c1.id)
    expect(s1).toMatchObject({ numero: 1, estat: 'enCurs', episodiId: c1.episodiId, citaId: c1.id })
    expect((await m.obtenirCita(c1.id))!).toMatchObject({ estat: 'enCurs', sessioId: s1.id })
    expect((await m.comencarVisita(c1.id)).id).toBe(s1.id)
    await m.finalitzarSessio(s1.id, { retirades: 0, motiu: '' })
    expect((await m.obtenirCita(c1.id))!.estat).toBe('feta')
    const c2 = await m.crearCita(novaCita(p.id, '2026-11-09T10:00'))
    expect((await m.comencarVisita(c2.id)).numero).toBe(2)
  })

  it('es desen els punts i les seccions; només es desa el que ha canviat', async () => {
    const { m } = await nou()
    const p = await m.crearPacient(pacientInventat())
    const c = await m.crearCita(novaCita(p.id, '2026-11-02T10:00', 'primera'))
    const s = await m.comencarVisita(c.id)
    const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...dades } = s
    const amb = { ...dades, punts: mapaPunts([nouPuntMarcat('LI4', 'bilateral', 'agulla')]), comEsta: { ...dades.comEsta, escala: 6 } }
    const desada = await m.actualitzarSessio(s.id, amb, dades)
    expect(desada.punts['cos:LI4']).toMatchObject({ costat: 'bilateral', tecnica: 'agulla' })
    expect(desada.comEsta.escala).toBe(6)
  })

  it('24 hores després de tancar-la, només s\'hi poden afegir addendes; mai no es perd', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-04T16:00:00Z'))
    const { m } = await nou()
    const p = await m.crearPacient(pacientInventat())
    const c = await m.crearCita(novaCita(p.id, '2026-11-04T17:00', 'primera'))
    const s = await m.comencarVisita(c.id)
    const tancada = await m.finalitzarSessio(s.id, { retirades: 0, motiu: '' })
    const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...dades } = tancada
    // Dins les 24 hores, es pot editar
    vi.setSystemTime(new Date('2026-11-05T15:00:00Z'))
    await m.actualitzarSessio(s.id, { ...dades, tancar: { ...dades.tancar, recomanacions: 'Caminar (inventat)' } }, dades)
    // Després, no
    vi.setSystemTime(new Date('2026-11-05T17:00:00Z'))
    await expect(m.actualitzarSessio(s.id, dades, dades)).rejects.toBeInstanceOf(ErrorSessioBloquejada)
    const a = await m.afegirAddenda(s.id, 'Ha trucat: va millor (inventat)')
    expect((await m.addendesDe(s.id)).map((x) => [x.text, x.at])).toEqual([[a.text, '2026-11-05T17:00:00.000Z']])
    expect((await m.obtenirSessio(s.id))!.tancar.recomanacions).toBe('Caminar (inventat)')
  })
})
