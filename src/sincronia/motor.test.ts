// @vitest-environment node
// Motor de sincronia, format 2 (docs/sincronia.md, 8): diversos dispositius
// (bases de dades) i un Google Drive en memòria. Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canviarContrasenya, crearClauMestra, desbloquejarClauMestra } from '../crypto'
import { QiDB } from '../db/esquema'
import { crearMagatzem, guardarClauEmbolcallada, llegirClauEmbolcallada, llegirClauMestraAt, llegirSecrets } from '../db/magatzem'
import { novaCita } from '../domini/cita'
import { fitxaInventada, pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { ErrorClauDiferent, ErrorCopiaDanyada, ErrorCopiaVersio, llegirContingut, llegirFitxer, xifrarCopia } from './copia'
import { desarPerCamp, pendentsDePujar } from './escriptura'
import { llegirFitxer2, nomFoto, obrirFoto, xifrarFoto, type FitxerFoto } from './format2'
import { copiaPerRecuperar, obrirClauMestra, restaurarCopia } from './recuperacio'
import { FITXER_PRINCIPAL, sincronitzar } from './sincronitzar'

const IT = 1_000
const P = 'contrasenya-de-prova'
const DIA = new Date('2026-11-02T10:00:00Z')
const obertes: QiDB[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  for (const db of obertes.splice(0)) await db.delete()
})

type DriveProva = ReturnType<typeof driveEnMemoria>

function novaDb() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  return db
}

async function primer() {
  const db = novaDb()
  const { embolcall, clau } = await crearClauMestra(P, IT)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, m: crearMagatzem(db, clau) }
}

/** Un dispositiu nou: recupera de Drive amb la contrasenya, com a la pantalla de recuperar */
async function nou(drive: DriveProva) {
  const db = novaDb()
  const copia = (await copiaPerRecuperar(drive))!
  const clau = await obrirClauMestra(copia, P)
  await restaurarCopia(db, clau, copia, drive)
  return { db, clau, m: crearMagatzem(db, clau) }
}

const noms = async (x: { m: ReturnType<typeof crearMagatzem> }) => (await x.m.llistarPacients()).map((p) => p.nom).sort()
const fitxer = (drive: DriveProva, re: RegExp) => [...drive.fitxers.values()].filter((f) => re.test(f.name))

describe('format 2 a Google Drive', () => {
  it('cada dispositiu escriu només el seu diari; hi ha una foto i les còpies diària i mensual; res en clar', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await a.m.crearCita({ ...novaCita(p.id, '2026-11-03T10:15'), motiu: 'Acúfens' })
    await sincronitzar(a.db, a.clau, drive, DIA)

    const noms = [...drive.fitxers.values()].map((f) => f.name).sort()
    expect(noms).toEqual([
      'qi-copia-2026-11-02.json',
      expect.stringMatching(/^qi-dispositiu-[0-9a-z]{12}\.json$/),
      expect.stringMatching(/^qi-foto-000001-[0-9a-z]{12}\.json$/),
      'qi-mensual-2026-11.json',
    ])
    for (const f of drive.fitxers.values()) {
      for (const clar of ['Aina', 'Provencal', '600 111 222', 'Acúfens', '2026-11-03', p.id, 'pacients', 'cites']) expect(f.contingut).not.toContain(clar)
      expect(llegirFitxer2(f.contingut)).toMatchObject({ format: 'qi-sinc', versio: 2, minimaPerEscriure: 2 })
    }
    expect(await pendentsDePujar(a.db)).toBe(0)
  })

  it('un dispositiu nou ho recupera tot amb la contrasenya, sense escriure res a Drive', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await a.m.desarFitxaClinica(p.id, fitxaInventada())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const abans = JSON.stringify([...drive.fitxers.values()])
    const b = await nou(drive)
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
    expect(await noms(b)).toEqual(['Aina'])
    expect((await b.m.obtenirFitxaClinica(p.id)).alergies).toBe('Penicil·lina')
    expect(await pendentsDePujar(b.db)).toBe(0)
  })

  it('si no ha canviat res a Drive, no es baixa res', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    const baixar = vi.spyOn(drive, 'baixar')
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(baixar).not.toHaveBeenCalled()
  })
})

describe('dos dispositius', () => {
  it('els canvis de tots dos s\'ajunten, i els esborrats també arriben', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    const c = await a.m.crearCita(novaCita(p.id, '2026-11-03T10:15'))
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await b.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
    await a.m.esborrarCita(c.id)
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    for (const x of [a, b]) {
      expect(await noms(x)).toEqual(['Aina', 'Bernat'])
      expect(await x.m.obtenirCita(c.id)).toBeUndefined()
    }
  })

  it('camps diferents del mateix pacient: es conserven tots dos, sense conflicte', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.actualitzarPacient(p.id, pacientInventat({ telefon: '611 111 111' }))
    await b.m.actualitzarPacient(p.id, pacientInventat({ professio: 'Mestra' }))
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    for (const x of [a, b]) {
      expect(await x.m.obtenirPacient(p.id)).toMatchObject({ telefon: '611 111 111', professio: 'Mestra' })
      expect(await x.m.conflictesDe(p.id)).toEqual([])
    }
  })

  it('el mateix camp: guanya el més nou i l\'altre queda per revisar, un sol conflicte igual als dos', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.actualitzarPacient(p.id, pacientInventat({ telefon: '611 111 111' }))
    await b.m.actualitzarPacient(p.id, pacientInventat({ telefon: '622 222 222' }))
    for (const x of [a, b, a, b]) await sincronitzar(x.db, x.clau, drive, DIA)
    for (const x of [a, b]) {
      expect((await x.m.obtenirPacient(p.id))?.telefon).toBe('622 222 222')
      expect(await x.m.conflictesDe(p.id)).toEqual([expect.objectContaining({ camp: 'telefon', valor: '611 111 111' })])
    }
    // Resolt en un dispositiu, desapareix dels dos i no torna
    const [c] = await a.m.conflictesDe(p.id)
    await a.m.resoldreConflicte(c!.conflicteId, 'telefon')
    for (const x of [a, b, a, b]) await sincronitzar(x.db, x.clau, drive, DIA)
    for (const x of [a, b]) expect(await x.m.conflictesDe(p.id)).toEqual([])
  })

  it('un canvi posterior (fet després de rebre l\'altre) no és cap conflicte', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.actualitzarPacient(p.id, pacientInventat({ telefon: '611 111 111' }))
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await b.m.actualitzarPacient(p.id, pacientInventat({ telefon: '622 222 222' }))
    for (const x of [b, a]) await sincronitzar(x.db, x.clau, drive, DIA)
    for (const x of [a, b]) {
      expect((await x.m.obtenirPacient(p.id))?.telefon).toBe('622 222 222')
      expect(await x.m.conflictesDe(p.id)).toEqual([])
    }
  })

  it('n) el que es desa mentre la sincronia aplica canvis de Drive no es perd i es puja', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.crearPacient(pacientInventat({ nom: 'Carla' }))
    await sincronitzar(a.db, a.clau, drive, DIA)
    // Mentre B baixa el diari de A, la doctora hi dona d'alta un pacient
    const baixar = drive.baixar.bind(drive)
    let fet = false
    vi.spyOn(drive, 'baixar').mockImplementation(async (id) => {
      const text = await baixar(id)
      if (!fet) {
        fet = true
        await b.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
      }
      return text
    })
    await sincronitzar(b.db, b.clau, drive, DIA)
    expect(await noms(b)).toEqual(['Aina', 'Bernat', 'Carla'])
    vi.restoreAllMocks()
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(await noms(a)).toEqual(['Aina', 'Bernat', 'Carla'])
  })

  it('h) dos dispositius que sincronitzen exactament alhora no es trepitgen', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.crearPacient(pacientInventat({ nom: 'Carla' }))
    await b.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
    // Totes les lectures abans de cap escriptura
    let esperant = 0
    let deixar: () => void = () => {}
    const tots = new Promise<void>((r) => (deixar = r))
    const actualitzar = drive.actualitzar.bind(drive)
    vi.spyOn(drive, 'actualitzar').mockImplementation(async (id, text) => {
      if (++esperant === 2) deixar()
      await tots
      return actualitzar(id, text)
    })
    const crear = drive.crear.bind(drive)
    vi.spyOn(drive, 'crear').mockImplementation(async (nom, text) => {
      if (nom.startsWith('qi-dispositiu-') && ++esperant === 2) deixar()
      if (nom.startsWith('qi-dispositiu-')) await tots
      return crear(nom, text)
    })
    await Promise.all([sincronitzar(a.db, a.clau, drive, DIA), sincronitzar(b.db, b.clau, drive, DIA)])
    vi.restoreAllMocks()
    // Un tercer dispositiu, tot just després, ho té tot
    const c = await nou(drive)
    expect(await noms(c)).toEqual(['Aina', 'Bernat', 'Carla'])
  })

  it('g) amb el rellotge 10 minuts endarrerit, l\'esborrat i el canvi posterior guanyen igualment', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    const c = await a.m.crearCita(novaCita(p.id, '2026-11-04T17:00'))
    await sincronitzar(a.db, a.clau, drive, DIA)
    const real = Date.now.bind(Date)
    const endarrerit = () => vi.spyOn(Date, 'now').mockImplementation(() => real() - 10 * 60_000)
    endarrerit()
    const b = await nou(drive)
    await b.m.esborrarCita(c.id)
    await b.m.actualitzarPacient(p.id, pacientInventat({ telefon: '622 222 222' }))
    await sincronitzar(b.db, b.clau, drive, DIA)
    vi.restoreAllMocks()
    await sincronitzar(a.db, a.clau, drive, DIA)
    endarrerit()
    await sincronitzar(b.db, b.clau, drive, DIA)
    vi.restoreAllMocks()
    for (const x of [a, b]) {
      expect(await x.m.obtenirCita(c.id)).toBeUndefined()
      expect((await x.m.obtenirPacient(p.id))?.telefon).toBe('622 222 222')
    }
  })

  it('la contrasenya nova d\'un dispositiu arriba a l\'altre', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    const nova = await canviarContrasenya((await llegirClauEmbolcallada(a.db))!, P, 'contrasenya-nova-de-prova', IT)
    await guardarClauEmbolcallada(a.db, nova)
    await sincronitzar(a.db, a.clau, drive, DIA)
    await sincronitzar(b.db, b.clau, drive, DIA)
    await expect(desbloquejarClauMestra((await llegirClauEmbolcallada(b.db))!, 'contrasenya-nova-de-prova')).resolves.toBeDefined()
  })

  it('dues fitxes clíniques del mateix pacient amb ids diferents (versions antigues) es fusionen en una', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    await a.m.desarFitxaClinica(p.id, { ...fitxaInventada(), alergies: 'Iode' })
    // Una versió antiga feia servir ids aleatoris: la de B en té un altre
    await desarPerCamp(
      b.db,
      b.clau,
      'fitxesCliniques',
      { id: 'fitxa-antiga-b', pacientId: p.id, creatAt: '2099-01-01T00:00:00.000Z', modificatAt: '2099-01-01T00:00:00.000Z' },
      { ...fitxaInventada(), medicacioActual: 'Cap (B)' },
    )
    for (const x of [a, b, a, b]) await sincronitzar(x.db, x.clau, drive, DIA)
    for (const x of [a, b]) {
      expect((await x.db.fitxesCliniques.toArray()).map((f) => f.id)).toEqual([`fitxa-${p.id}`])
      // Res no es perd: cada valor és a la fitxa o queda per revisar
      const f = await x.m.obtenirFitxaClinica(p.id)
      const altres = (await x.m.conflictesDe(`fitxa-${p.id}`)).map((c) => c.valor)
      expect([f.alergies, ...altres]).toContain('Iode')
      expect([f.medicacioActual, ...altres]).toContain('Cap (B)')
    }
  })
})

describe('compactació', () => {
  it('fa una foto nova cada dia, escurça el diari i esborra les fotos velles; un dispositiu nou ho té tot', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    for (let dia = 1; dia <= 3; dia++) {
      await a.m.crearPacient(pacientInventat({ nom: `Pacient ${dia}` }))
      await sincronitzar(a.db, a.clau, drive, new Date(DIA.getTime() + dia * 86_400_000 + 3_600_000))
    }
    await sincronitzar(a.db, a.clau, drive, new Date(DIA.getTime() + 4 * 86_400_000))
    const fotos = fitxer(drive, /^qi-foto-/).map((f) => f.name)
    expect(fotos.length).toBeLessThanOrEqual(2)
    expect(fotos.some((n) => n.startsWith('qi-foto-000004-'))).toBe(true)
    // El diari propi ja només porta el que no és a la foto
    expect(await a.db.canvisPropis.count()).toBe(0)
    const b = await nou(drive)
    expect(await noms(b)).toEqual(['Aina', 'Pacient 1', 'Pacient 2', 'Pacient 3'])
  })
})

describe('versions de l\'app', () => {
  it('i) una taula que aquesta versió no coneix es conserva i torna a sortir a les seves fotos', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    // «La versió nova» (un altre dispositiu) fa una foto amb una taula nova
    const embolcalls = { contrasenya: (await llegirClauEmbolcallada(a.db))!, contrasenyaAt: await llegirClauMestraAt(a.db), secrets: await llegirSecrets(a.db) }
    const contingut = { taules: { valoracions: [{ id: 'v1', hlc: '9999999999999-0000-nova', dada: 'inventada' }] }, esborrats: [] }
    await drive.crear(nomFoto(2, 'versionova'), JSON.stringify(await xifrarFoto(a.clau, { dispositiu: 'versionova', embolcalls, generacio: 2, cobertura: {} }, contingut)))
    await sincronitzar(a.db, a.clau, drive, DIA)
    // Quan aquesta en fa una de nova, la taula hi és
    await a.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
    await sincronitzar(a.db, a.clau, drive, new Date(DIA.getTime() + 2 * 86_400_000))
    const novaFoto = fitxer(drive, /^qi-foto-000003-/)[0]!
    const c = await obrirFoto(a.clau, llegirFitxer2(novaFoto.contingut) as FitxerFoto)
    expect(c.taules.valoracions).toEqual([expect.objectContaining({ id: 'v1', dada: 'inventada' })])
  })

  it('i) un camp que aquesta versió no coneix es conserva quan es desa el registre', async () => {
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    // «La versió nova» hi havia afegit un camp
    await desarPerCamp(a.db, a.clau, 'pacients', { id: p.id, creatAt: p.creatAt, modificatAt: p.modificatAt }, { ...pacientInventat(), arxivat: false, campNou: 'valor inventat' })
    await a.m.actualitzarPacient(p.id, pacientInventat({ telefon: '611 111 111' }))
    const { obrirRegistre } = await import('./registres')
    const obert = await obrirRegistre(a.clau, 'pacients', (await a.db.pacients.get(p.id)) as never)
    expect(obert.camps).toMatchObject({ campNou: 'valor inventat', telefon: '611 111 111' })
  })

  it('una versió mínima per escriure més alta: només llegeix, no puja res i el que es desa queda pendent', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = await nou(drive)
    for (const f of drive.fitxers.values())
      if (f.name.startsWith('qi-foto-')) {
        f.contingut = JSON.stringify({ ...JSON.parse(f.contingut), minimaPerEscriure: 3 })
        f.version = String(Number(f.version) + 1)
      }
    await b.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
    const abans = JSON.stringify([...drive.fitxers.values()])
    const r = await sincronitzar(b.db, b.clau, drive, DIA)
    expect(r.nomesLectura).toBe(true)
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
    expect(await pendentsDePujar(b.db)).toBe(1)
  })

  it('un format més nou (DRV-V) o d\'una altra clau (DRV-K): no s\'escriu res', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await sincronitzar(a.db, a.clau, drive, DIA)
    const altre = await primer()
    const foto = fitxer(drive, /^qi-foto-/)[0]!
    const original = foto.contingut
    foto.contingut = JSON.stringify({ ...JSON.parse(original), versio: 3 })
    const b = await primer()
    await expect(sincronitzar(b.db, b.clau, drive, DIA)).rejects.toBeInstanceOf(ErrorCopiaVersio)
    foto.contingut = original
    await expect(sincronitzar(altre.db, altre.clau, drive, DIA)).rejects.toBeInstanceOf(ErrorClauDiferent)
    expect(fitxer(drive, /^qi-dispositiu-/)).toHaveLength(1)
  })

  it('DRV-C: la foto és danyada; amb les còpies anteriors es continua i la danyada es guarda a part', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    const b = novaDb()
    await guardarClauEmbolcallada(b, (await llegirClauEmbolcallada(a.db))!)
    const foto = fitxer(drive, /^qi-foto-/)[0]!
    foto.contingut = foto.contingut.slice(0, 300)
    await expect(sincronitzar(b, a.clau, drive, DIA)).rejects.toBeInstanceOf(ErrorCopiaDanyada)
    await sincronitzar(b, a.clau, drive, { ara: DIA, copiaAnterior: true })
    expect(await noms({ m: crearMagatzem(b, a.clau) })).toEqual(['Aina'])
    expect(fitxer(drive, /^qi-danyada-/)[0]?.contingut).toHaveLength(300)
  })
})

describe('migració des del format 1', () => {
  it('el primer dispositiu migra: còpies abans (.qi i qi-v1), primera foto, i qi-dades.json avisa les versions antigues', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    const p = await a.m.crearPacient(pacientInventat())
    // Format 1 a Drive, fet per una versió anterior, amb un pacient que aquí no hi és
    const b = await primer()
    await guardarClauEmbolcallada(b.db, (await llegirClauEmbolcallada(a.db))!)
    const mb = crearMagatzem(b.db, a.clau)
    await mb.crearPacient(pacientInventat({ nom: 'Bernat' }))
    const embolcalls = { contrasenya: (await llegirClauEmbolcallada(a.db))!, contrasenyaAt: await llegirClauMestraAt(a.db), secrets: [] }
    const v1 = JSON.stringify(await xifrarCopia(a.clau, await llegirContingut(b.db), embolcalls))
    await drive.crear(FITXER_PRINCIPAL, v1)

    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(await noms(a)).toEqual(['Aina', 'Bernat'])
    expect(fitxer(drive, /^qi-v1-2026-11-02\.json$/)[0]?.contingut).toBe(v1)
    expect(fitxer(drive, /^qi-foto-000001-/)).toHaveLength(1)
    expect((await a.db.meta.get('copiaAbansMigracio'))?.valor).toBeDefined()
    // Una versió antiga ja no hi pot escriure: hi veu «Actualitzar l'app»
    expect(() => llegirFitxer(fitxer(drive, /^qi-dades\.json$/)[0]!.contingut)).toThrow(ErrorCopiaVersio)
    // Un dispositiu nou recupera tot del format 2
    const c = await nou(drive)
    expect(await noms(c)).toEqual(['Aina', 'Bernat'])
    expect((await c.m.obtenirPacient(p.id))?.nom).toBe('Aina')
  })

  it('un dispositiu del format 1 amb canvis sense pujar els puja en actualitzar-se', async () => {
    const drive = driveEnMemoria()
    const a = await primer()
    await a.m.crearPacient(pacientInventat())
    await sincronitzar(a.db, a.clau, drive, DIA)
    // B era al dia, però té canvis desats per la versió d'abans (sense cua)
    const b = await nou(drive)
    await b.db.meta.delete('versionsLocals')
    await b.db.meta.put({ clau: 'darreraSincronia', valor: '2026-11-01T00:00:00.000Z' })
    await b.m.crearPacient(pacientInventat({ nom: 'Bernat' }))
    await b.db.canvisPropis.clear()
    await sincronitzar(b.db, b.clau, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)
    expect(await noms(a)).toEqual(['Aina', 'Bernat'])
  })
})
