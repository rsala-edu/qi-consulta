// Ajuntar fitxes de la mateixa persona (part 2). Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearClauMestra } from '../crypto'
import { compararFitxes, citesRepetides, dadesAjuntades, esPotDesfer, valorsDesfets } from '../domini/ajuntar'
import { novaCita } from '../domini/cita'
import { fitxaClinicaBuida } from '../domini/fitxaClinica'
import { fitxaInventada, pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { copiaPerRecuperar, obrirClauMestra, restaurarCopia } from '../sincronia/recuperacio'
import { sincronitzar } from '../sincronia/sincronitzar'
import { QiDB } from './esquema'
import { crearMagatzem, guardarClauEmbolcallada } from './magatzem'

const obertes: QiDB[] = []
afterEach(async () => {
  vi.useRealTimers()
  for (const db of obertes.splice(0)) await db.delete()
})

const P = 'contrasenya-de-prova'
function novaDb() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  return db
}
async function primer() {
  const db = novaDb()
  const { embolcall, clau } = await crearClauMestra(P, 1_000)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, m: crearMagatzem(db, clau) }
}
async function segon(drive: ReturnType<typeof driveEnMemoria>) {
  const db = novaDb()
  const copia = (await copiaPerRecuperar(drive))!
  const clau = await obrirClauMestra(copia, P)
  await restaurarCopia(db, clau, copia, drive)
  return { db, clau, m: crearMagatzem(db, clau) }
}

const fitxa = (pacient: ReturnType<typeof pacientInventat>, f: ReturnType<typeof fitxaInventada> | null, modificat = '2026-11-01T10:00:00.000Z') => ({
  pacient,
  fitxa: f,
  pacientModificatAt: modificat,
  fitxaModificatAt: f ? modificat : null,
})

describe('comparar dues fitxes', () => {
  it('iguals una vegada, d\'un sol costat es queden, diferents per triar (per defecte, el més recent)', () => {
    const a = fitxa(pacientInventat({ telefon: '600 111 222', professio: '' }), null, '2026-11-01T10:00:00.000Z')
    const b = fitxa(pacientInventat({ telefon: '600 999 888', professio: 'Mestra' }), fitxaInventada(), '2026-11-05T10:00:00.000Z')
    const camps = compararFitxes(a, b)
    const de = (c: string) => camps.find((x) => x.camp === c)!
    expect(de('nom')).toMatchObject({ estat: 'igual', perDefecte: 'queda' })
    expect(de('telefon')).toMatchObject({ estat: 'diferent', perDefecte: 'treu' })
    expect(de('professio')).toMatchObject({ estat: 'nomesTreu', perDefecte: 'treu' })
    expect(de('alergies')).toMatchObject({ grup: 'fitxa', estat: 'nomesTreu', treu: 'Penicil·lina' })
    const r = dadesAjuntades(camps, { 'pacient:telefon': 'queda' })
    expect(r.pacient).toMatchObject({ telefon: '600 111 222', professio: 'Mestra', nom: 'Aina' })
    expect(r.fitxa.alergies).toBe('Penicil·lina')
    // La contraindicació marcada en una fitxa es queda marcada
    expect(r.fitxa.contraindicacions.anticoagulants).toBe(true)
    expect(dadesAjuntades(camps, {}).pacient.telefon).toBe('600 999 888')
  })

  it('cites repetides: mateix dia, hora i durada; es queda la que té visita; si totes dues en tenen, cap', () => {
    const c = (id: string, inici: string, durada = 40, sessioId: string | null = null) => ({ id, inici, durada, sessioId })
    const r = citesRepetides(
      [c('q1', '2026-11-03T10:00'), c('q2', '2026-11-10T10:00'), c('q3', '2026-11-17T10:00', 40, 's'), c('q4', '2026-11-24T10:00')],
      [c('t1', '2026-11-03T10:00'), c('t2', '2026-11-10T10:00', 40, 's2'), c('t3', '2026-11-17T10:00', 40, 's3'), c('t4', '2026-11-24T10:00', 60)],
    )
    expect(r.map((x) => [x.treure.id, x.mantenir.id])).toEqual([
      ['t1', 'q1'],
      ['q2', 't2'],
    ])
  })

  it('desfer: torna el valor d\'abans, menys el que s\'ha editat després', () => {
    expect(valorsDesfets({ a: 'nou', b: 'editat' }, { a: 'vell', b: 'vell' }, { a: 'nou', b: 'nou' })).toEqual({ a: 'vell', b: 'editat' })
    const at = '2026-11-01T10:00:00.000Z'
    expect(esPotDesfer({ at, desfetAt: null }, Date.parse('2026-11-30T09:00:00Z'))).toBe(true)
    expect(esPotDesfer({ at, desfetAt: null }, Date.parse('2026-12-01T11:00:00Z'))).toBe(false)
    expect(esPotDesfer({ at, desfetAt: at }, Date.parse(at))).toBe(false)
  })
})

describe('ajuntar fitxes al magatzem', () => {
  async function dosFitxes() {
    const d = await primer()
    const { m } = d
    const queda = await m.crearPacient(pacientInventat({ telefon: '600 111 222' }))
    const treu = await m.crearPacient(pacientInventat({ telefon: '600 999 888', professio: 'Mestra' }))
    await m.desarFitxaClinica(treu.id, fitxaInventada())
    // Primera visita a la fitxa que es queda; a l'altra, una cita repetida, una visita feta i una de futura
    await m.crearCita({ ...novaCita(queda.id, '2026-11-03T10:00', 'primera'), motiu: 'Lumbàlgia' })
    await m.crearCita({ ...novaCita(treu.id, '2026-11-03T10:00', 'primera'), motiu: 'Lumbàlgia' })
    const feta = await m.crearCita({ ...novaCita(treu.id, '2026-10-20T10:00', 'primera'), motiu: 'Acúfens' })
    const s = await m.comencarVisita(feta.id)
    await m.finalitzarSessio(s.id, { retirades: 0, motiu: '' })
    await m.afegirAddenda(s.id, 'Trucada: ha millorat')
    const futura = await m.crearCita({ ...novaCita(treu.id, '2026-11-20T10:00', 'primera'), motiu: 'Acúfens' })
    return { ...d, queda, treu, feta, futura, sessio: s }
  }

  async function ajuntar(x: Awaited<ReturnType<typeof dosFitxes>>) {
    const { m, queda, treu } = x
    const camps = compararFitxes(await m.dadesPerAjuntar(queda.id), await m.dadesPerAjuntar(treu.id))
    return m.ajuntarPacients(queda.id, treu.id, dadesAjuntades(camps, { 'pacient:telefon': 'queda' }))
  }

  it('mou cites, episodis, sessions i addendes; treu la cita repetida; arxiva l\'altra; recalcula la primera visita', async () => {
    const x = await dosFitxes()
    const { m, queda, treu } = x
    const informe = await ajuntar(x)
    expect(informe).toMatchObject({ cites: 2, sessions: 1, addendes: 1, citesRepetides: 1 })
    expect(informe.episodis).toBeGreaterThanOrEqual(1)

    expect(await m.citesDelPacient(treu.id)).toEqual([])
    const cites = await m.citesDelPacient(queda.id)
    expect(cites.map((c) => c.inici)).toEqual(['2026-10-20T10:00', '2026-11-03T10:00', '2026-11-20T10:00'])
    // La visita feta del 20/10 és ara la primera: la del 3/11 i la del 20/11 passen a seguiment
    expect(cites.map((c) => c.tipus)).toEqual(['primera', 'seguiment', 'seguiment'])
    expect((await m.sessionsDelPacient(queda.id)).map((s) => s.id)).toEqual([x.sessio.id])
    expect((await m.addendesDe(x.sessio.id))[0]).toMatchObject({ pacientId: queda.id, text: 'Trucada: ha millorat' })
    expect((await m.llistarEpisodis(treu.id))).toEqual([])

    const q = (await m.obtenirPacient(queda.id))!
    expect(q).toMatchObject({ telefon: '600 111 222', professio: 'Mestra', arxivat: false })
    expect((await m.obtenirFitxaClinica(queda.id)).alergies).toBe('Penicil·lina')
    const t = (await m.obtenirPacient(treu.id))!
    expect(t.arxivat).toBe(true)
    expect(t.ajuntadaAmb).toMatchObject({ pacientId: queda.id, desfetAt: null })
    // L'altra fitxa no es toca: les seves dades no es perden
    expect(t.telefon).toBe('600 999 888')
    expect((await m.obtenirFitxaClinica(treu.id)).alergies).toBe('Penicil·lina')
  })

  it('desfer: cada cosa torna a la seva fitxa, la cita repetida torna i les dades de la que es queda són les d\'abans', async () => {
    const x = await dosFitxes()
    const { m, queda, treu } = x
    await ajuntar(x)
    await m.desferAjuntament(treu.id)
    expect((await m.citesDelPacient(treu.id)).map((c) => c.inici)).toEqual(['2026-10-20T10:00', '2026-11-03T10:00', '2026-11-20T10:00'])
    expect((await m.citesDelPacient(queda.id)).map((c) => c.inici)).toEqual(['2026-11-03T10:00'])
    expect((await m.sessionsDelPacient(treu.id)).map((s) => s.id)).toEqual([x.sessio.id])
    expect((await m.addendesDe(x.sessio.id))[0]!.pacientId).toBe(treu.id)
    const q = (await m.obtenirPacient(queda.id))!
    expect(q.professio).toBe('')
    expect((await m.obtenirFitxaClinica(queda.id)).alergies).toBe('')
    const t = (await m.obtenirPacient(treu.id))!
    expect(t.arxivat).toBe(false)
    expect(t.ajuntadaAmb?.desfetAt).not.toBeNull()
    await expect(m.desferAjuntament(treu.id)).rejects.toThrow()
  })

  it('passats 30 dies ja no es pot desfer', async () => {
    const x = await dosFitxes()
    await ajuntar(x)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 31 * 24 * 3600 * 1000)
    await expect(x.m.desferAjuntament(x.treu.id)).rejects.toThrow()
  })

  it('una cita creada a la fitxa vella (com si vingués d\'un altre dispositiu) passa a la que es queda', async () => {
    const x = await dosFitxes()
    const { m, queda, treu } = x
    await ajuntar(x)
    // La fitxa arxivada encara existeix: es pot crear una cita (és el que fa la fusió amb un altre dispositiu)
    const tard = await m.crearCita({ ...novaCita(treu.id, '2026-12-01T10:00'), motiu: 'Revisió' })
    expect(await m.redirigirAjuntades()).toBeGreaterThanOrEqual(1)
    expect((await m.obtenirCita(tard.id))!.pacientId).toBe(queda.id)
    expect((await m.obtenirPacient(treu.id))!.ajuntadaAmb!.moguts.cites).toContain(tard.id)
    expect(await m.redirigirAjuntades()).toBe(0)
    // I en desfer, també torna
    await m.desferAjuntament(treu.id)
    expect((await m.obtenirCita(tard.id))!.pacientId).toBe(treu.id)
  })

  it('fitxa buida a totes dues: no es crea cap fitxa clínica', async () => {
    const { m } = await primer()
    const a = await m.crearPacient(pacientInventat())
    const b = await m.crearPacient(pacientInventat())
    const camps = compararFitxes(await m.dadesPerAjuntar(a.id), await m.dadesPerAjuntar(b.id))
    expect(camps.every((c) => c.estat === 'igual')).toBe(true)
    await m.ajuntarPacients(a.id, b.id, dadesAjuntades(camps, {}))
    expect((await m.obtenirFitxaClinica(a.id)).id).toBe('')
    expect(dadesAjuntades(camps, {}).fitxa).toEqual(fitxaClinicaBuida())
  })
})

describe('ajuntar amb dos dispositius', () => {
  it('una cita creada a la fitxa vella en un altre dispositiu, abans de saber-ho, acaba a la que es queda; no es perd res', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const queda = await a.m.crearPacient(pacientInventat({ telefon: '600 111 222' }))
    const treu = await a.m.crearPacient(pacientInventat({ telefon: '600 999 888' }))
    await sincronitzar(a.db, a.clau, drive)
    const b = await segon(drive)

    // A ajunta; B, sense saber-ho, dona una cita a la fitxa vella i hi canvia el telèfon
    const camps = compararFitxes(await a.m.dadesPerAjuntar(queda.id), await a.m.dadesPerAjuntar(treu.id))
    await a.m.ajuntarPacients(queda.id, treu.id, dadesAjuntades(camps, { 'pacient:telefon': 'queda' }))
    const deB = await b.m.crearCita({ ...novaCita(treu.id, '2026-12-01T10:00'), motiu: 'Revisió' })
    await b.m.actualitzarPacient(treu.id, { ...pacientInventat({ telefon: '600 333 444' }) })

    await sincronitzar(a.db, a.clau, drive)
    await sincronitzar(b.db, b.clau, drive)
    // B rep l'ajuntament i redirigeix la seva cita
    await b.m.redirigirAjuntades()
    await sincronitzar(b.db, b.clau, drive)
    await sincronitzar(a.db, a.clau, drive)
    await a.m.redirigirAjuntades()

    for (const x of [a, b]) {
      expect((await x.m.obtenirCita(deB.id))!.pacientId).toBe(queda.id)
      expect(await x.m.citesDelPacient(treu.id)).toEqual([])
      const t = (await x.m.obtenirPacient(treu.id))!
      expect(t.arxivat).toBe(true)
      expect(t.ajuntadaAmb?.pacientId).toBe(queda.id)
      // El canvi de telèfon de B a la fitxa vella no es perd
      expect(t.telefon).toBe('600 333 444')
    }
  })
})
