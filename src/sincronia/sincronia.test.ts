// @vitest-environment node
// Dos dispositius (dues bases de dades) i un Google Drive en memòria.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { canviarContrasenya, crearClauMestra, desbloquejarClauMestra } from '../crypto'
import { desarCalibracio } from '../db/calibratge'
import { QiDB } from '../db/esquema'
import { crearMagatzem, guardarClauEmbolcallada, llegirClauEmbolcallada } from '../db/magatzem'
import { confirmarCategoria } from '../db/precaucions'
import { novaCita } from '../domini/cita'
import { pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { fusionar, llegirContingut, llegirFitxer } from './copia'
import { driveGoogle, ErrorAutoritzacio } from './drive'
import { copiaDeDrive, FITXER_PRINCIPAL, restaurarCopia, sincronitzar } from './sincronitzar'

const IT = 1_000
const CONTRASENYA = 'contrasenya-de-prova'
const obertes: QiDB[] = []
afterEach(async () => {
  for (const db of obertes.splice(0)) await db.delete()
})

function novaDb() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  return db
}

/** Primer dispositiu: crea la contrasenya i té dades */
async function dispositiuA() {
  const db = novaDb()
  const { embolcall, clau } = await crearClauMestra(CONTRASENYA, IT)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, magatzem: crearMagatzem(db, clau) }
}

/** Dispositiu nou: baixa la còpia de Drive i l'obre amb la contrasenya */
async function dispositiuNou(drive: ReturnType<typeof driveEnMemoria>, contrasenya = CONTRASENYA) {
  const db = novaDb()
  const fitxer = (await copiaDeDrive(drive))!
  const clau = await desbloquejarClauMestra(fitxer.embolcalls.contrasenya as never, contrasenya)
  await restaurarCopia(db, clau, fitxer)
  return { db, clau, magatzem: crearMagatzem(db, clau) }
}

const DIA = new Date('2026-11-02T10:00:00Z')

describe('sincronia amb Google Drive', () => {
  it('puja una còpia xifrada: a Drive no hi ha cap dada en clar', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.magatzem.crearPacient(pacientInventat())
    await a.magatzem.crearCita({ ...novaCita(p.id, '2026-11-03T10:15'), motiu: 'Acúfens' })

    const r = await sincronitzar(a.db, a.clau, drive, DIA)
    expect(r.pujat).toBe(true)
    const noms = [...drive.fitxers.values()].map((f) => f.name).sort()
    expect(noms).toEqual(['qi-copia-2026-11-02.json', FITXER_PRINCIPAL, 'qi-mensual-2026-11.json'])

    const text = [...drive.fitxers.values()].find((f) => f.name === FITXER_PRINCIPAL)!.contingut
    for (const clar of ['Aina', 'Provencal', '600 111 222', 'Acúfens', '2026-11-03', p.id, 'pacients', 'cites'])
      expect(text, clar).not.toContain(clar)
    const fitxer = llegirFitxer(text)
    expect(Object.keys(fitxer)).toEqual(['format', 'versio', 'embolcalls', 'xifrat'])
  })

  it('un dispositiu nou recupera les dades amb la contrasenya', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.magatzem.crearPacient(pacientInventat())
    await a.magatzem.desarFitxaClinica(p.id, { ...(await a.magatzem.obtenirFitxaClinica(p.id)), alergies: 'Penicil·lina' })
    await sincronitzar(a.db, a.clau, drive, DIA)

    await expect(dispositiuNou(drive, 'una-altra-contrasenya')).rejects.toThrow()
    const b = await dispositiuNou(drive)
    expect((await b.magatzem.llistarPacients()).map((x) => x.nom)).toEqual(['Aina'])
    expect((await b.magatzem.obtenirFitxaClinica(p.id)).alergies).toBe('Penicil·lina')
    expect(await llegirClauEmbolcallada(b.db)).toEqual(await llegirClauEmbolcallada(a.db))
  })

  it('els canvis de tots dos dispositius s\'ajunten, i els esborrats també arriben', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const aina = await a.magatzem.crearPacient(pacientInventat())
    const cita = await a.magatzem.crearCita(novaCita(aina.id, '2026-11-03T10:00'))
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive)

    // A esborra la cita i confirma una categoria de precaucions; B dona d'alta un pacient i calibra un punt
    await a.magatzem.esborrarCita(cita.id)
    await confirmarCategoria(a.db, 'pulmo')
    const biel = await b.magatzem.crearPacient(pacientInventat({ nom: 'Biel' }))
    await desarCalibracio(b.db, 'mh-prova', 'ST36', 'E', null)

    await sincronitzar(a.db, a.clau, drive, DIA)
    const rb = await sincronitzar(b.db, b.clau, drive, DIA)
    expect(rb).toMatchObject({ baixat: true, pujat: true })
    const ra = await sincronitzar(a.db, a.clau, drive, DIA)
    expect(ra).toMatchObject({ baixat: true, pujat: false })

    for (const d of [a, b]) {
      expect((await d.magatzem.llistarPacients()).map((x) => x.id).sort()).toEqual([aina.id, biel.id].sort())
      expect(await d.magatzem.obtenirCita(cita.id)).toBeUndefined()
      expect(await d.db.categoriesPrecaucio.count()).toBe(1)
      expect(await d.db.calibratge.count()).toBe(1)
    }
    expect(await llegirContingut(a.db)).toEqual(await llegirContingut(b.db))
    // Sense canvis, no es torna a pujar res
    expect(await sincronitzar(b.db, b.clau, drive, DIA)).toMatchObject({ baixat: false, pujat: false })
  })

  it('si tots dos editen el mateix pacient, guanya el canvi més nou', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    const p = await a.magatzem.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive)

    await a.magatzem.actualitzarPacient(p.id, pacientInventat({ telefon: '611 000 001' }))
    await new Promise((r) => setTimeout(r, 5))
    await b.magatzem.actualitzarPacient(p.id, pacientInventat({ telefon: '611 000 002' }))
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    expect((await a.magatzem.obtenirPacient(p.id))!.telefon).toBe('611 000 002')
    expect((await b.magatzem.obtenirPacient(p.id))!.telefon).toBe('611 000 002')
  })

  it('la contrasenya nova d\'un dispositiu arriba a l\'altre', async () => {
    const drive = driveEnMemoria()
    const a = await dispositiuA()
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await dispositiuNou(drive)

    const nou = await canviarContrasenya((await llegirClauEmbolcallada(a.db))!, CONTRASENYA, 'contrasenya-nova', IT)
    await guardarClauEmbolcallada(a.db, nou)
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await expect(desbloquejarClauMestra((await llegirClauEmbolcallada(b.db))!, 'contrasenya-nova')).resolves.toBeDefined()
  })

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

describe('fusió de còpies', () => {
  it('és simètrica', async () => {
    const a = await dispositiuA()
    const b = await dispositiuA()
    await a.magatzem.crearPacient(pacientInventat())
    await b.magatzem.crearPacient(pacientInventat({ nom: 'Biel' }))
    const ca = await llegirContingut(a.db)
    const cb = await llegirContingut(b.db)
    expect(fusionar(ca, cb)).toEqual(fusionar(cb, ca))
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
