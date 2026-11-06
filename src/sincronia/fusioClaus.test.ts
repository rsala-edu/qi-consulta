// @vitest-environment node
// Dos dispositius que van començar cadascun de zero (claus mestres diferents)
// i un Google Drive en memòria. Només dades inventades.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { crearClauMestra, desbloquejarClauMestra, ErrorContrasenya, generarSecretRecuperacio, textClauRecuperacio } from '../crypto'
import { afegirEmbolcallSecret, idClau } from '../crypto'
import { QiDB } from '../db/esquema'
import { crearMagatzem, guardarClauEmbolcallada, guardarSecrets, llegirClauEmbolcallada } from '../db/magatzem'
import { novaCita } from '../domini/cita'
import { pacientInventat } from '../test/dadesInventades'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { ErrorClauRecuperacio } from '../sessio/claus'
import {
  exportarQi,
  fusionarAmbDrive,
  importarQi,
  llegirCopiaAbansCanviClau,
  desarCopiaAbansCanviClau,
  llegirQi,
  obrirClauCopia,
  recuperarDeDrive,
} from './canviClau'
import { desxifrarCopia, ErrorClauDiferent, ErrorCopiaDanyada, llegirContingut, llegirFitxer, xifrarCopia, type FitxerCopia } from './copia'
import { llegirFitxer2, obrirFoto } from './format2'
import { clauPersona } from './fusioClaus'
import { classificarErrorSincronia } from './motiuSincronia'
import { diesSenseCopia, textSenseCopia } from './senseCopia'
import { copiaDeDrive, sincronitzar, type InfoDrive } from './sincronitzar'
import type { Drive } from './drive'

const IT = 1_000
const CONTRASENYA_A = 'contrasenya-del-firefox'
const CONTRASENYA_B = 'contrasenya-del-chrome'
const DIA = new Date('2026-11-02T10:00:00Z')

const obertes: QiDB[] = []
afterEach(async () => {
  for (const db of obertes.splice(0)) await db.delete()
})

async function dispositiu(contrasenya: string) {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  obertes.push(db)
  const { embolcall, clau } = await crearClauMestra(contrasenya, IT)
  await guardarClauEmbolcallada(db, embolcall)
  return { db, clau, magatzem: crearMagatzem(db, clau) }
}

/** El Firefox: les seves dades a Drive. El Chrome: dades pròpies, amb una altra clau. */
async function escenari() {
  const drive = driveEnMemoria()
  const a = await dispositiu(CONTRASENYA_A)
  const aina = await a.magatzem.crearPacient(pacientInventat())
  await a.magatzem.crearCita(novaCita(aina.id, '2026-11-04T17:00'))
  await sincronitzar(a.db, a.clau, drive, DIA)

  const b = await dispositiu(CONTRASENYA_B)
  const bernat = await b.magatzem.crearPacient(pacientInventat({ nom: 'Bernat', llinatges: 'Prova Inventat', dataNaixement: '1975-01-02' }))
  // La mateixa persona creada també al Chrome (accents i majúscules diferents)
  const aina2 = await b.magatzem.crearPacient(pacientInventat({ llinatges: 'PROVENÇAL inventada', telefon: '600 999 000' }))
  for (const inici of ['2026-11-02T09:15', '2026-11-02T20:00', '2026-11-07T13:15'])
    await b.magatzem.crearCita(novaCita(bernat.id, inici))
  await b.magatzem.crearCita(novaCita(aina2.id, '2026-11-05T10:00'))
  await b.magatzem.desarEsborrany('pacient:nou', { ruta: '/pacients/nou', descripcio: 'Nou pacient', valors: { nom: 'Carme' } })
  return { drive, a, b, aina, bernat, aina2 }
}

/** La foto més nova de Drive (format 2) */
const fotoDe = (drive: ReturnType<typeof driveEnMemoria>) =>
  llegirFitxer2(
    [...drive.fitxers.values()].filter((f) => f.name.startsWith('qi-foto-')).sort((x, y) => y.name.localeCompare(x.name))[0]!.contingut,
  )

/** Una còpia del format 1 (com un .qi) amb les dades del Firefox */
async function fitxerV1(a: { db: QiDB; clau: CryptoKey }): Promise<FitxerCopia> {
  const embolcalls = { contrasenya: (await llegirClauEmbolcallada(a.db))!, contrasenyaAt: '2026-11-01T00:00:00.000Z', secrets: [] }
  return xifrarCopia(a.clau, await llegirContingut(a.db), embolcalls)
}

const totesLesCites = (m: ReturnType<typeof crearMagatzem>) => m.llistarCites('2026-01-01', '2027-01-01')

describe('DRV-C era la clau diferent: ara es diu DRV-K i no s\'escriu res', () => {
  it('la còpia de Drive d\'una altra clau dona ErrorClauDiferent, amb clauId i sense (versions anteriors)', async () => {
    const { a, b } = await escenari()
    const fitxer = await fitxerV1(a)
    await expect(desxifrarCopia(b.clau, fitxer)).rejects.toBeInstanceOf(ErrorClauDiferent)
    const { clauId: _, ...antic } = fitxer
    await expect(desxifrarCopia(b.clau, antic as FitxerCopia)).rejects.toBeInstanceOf(ErrorClauDiferent)
  })

  it('la mateixa clau amb el contingut malmès, o un fitxer a mig escriure, és ErrorCopiaDanyada', async () => {
    const { drive, a } = await escenari()
    const fitxer = await fitxerV1(a)
    const malmes = { ...fitxer, xifrat: { ...fitxer.xifrat, dades: fitxer.xifrat.dades.slice(0, -8) + 'AAAAAAAA' } }
    await expect(desxifrarCopia(a.clau, malmes)).rejects.toBeInstanceOf(ErrorCopiaDanyada)
    const text = JSON.stringify(fitxer)
    expect(() => llegirFitxer(text.slice(0, text.length / 2))).toThrow(ErrorCopiaDanyada)
    const foto = [...drive.fitxers.values()].find((f) => f.name.startsWith('qi-foto-'))!.contingut
    expect(() => llegirFitxer2(foto.slice(0, foto.length / 2))).toThrow(ErrorCopiaDanyada)
  })

  it('el Chrome sincronitza: DRV-K, Drive queda intacte i se sap la clau de cada banda', async () => {
    const { drive, b } = await escenari()
    const abans = JSON.stringify([...drive.fitxers.values()])
    let info: InfoDrive | null = null
    const e = await sincronitzar(b.db, b.clau, drive, { ara: DIA, informar: (i) => (info = i) }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ErrorClauDiferent)
    expect(classificarErrorSincronia(e, true)).toEqual({ motiu: 'clau', codi: 'DRV-K' })
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
    expect(info).toEqual({ versio: 2, clauId: fotoDe(drive).clauId })
  })

  it('abans d\'escriure per primer cop es torna a mirar Drive: si un altre dispositiu hi ha posat dades, no s\'hi escriu', async () => {
    const { drive, b } = await escenari()
    const abans = JSON.stringify([...drive.fitxers.values()])
    // La primera llista arriba buida (l'altre dispositiu encara pujava)
    let primera = true
    const tardana: Drive = {
      ...drive,
      llistar: async () => (primera ? ((primera = false), []) : drive.llistar()),
    }
    await expect(sincronitzar(b.db, b.clau, tardana, DIA)).rejects.toBeInstanceOf(ErrorClauDiferent)
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
  })
})

describe('fusionar les dades del dispositiu amb les de Drive (claus diferents)', () => {
  it('els dos dispositius acaben amb les mateixes dades, res perdut, i els duplicats marcats per revisar', async () => {
    const { drive, a, b, aina, aina2, bernat } = await escenari()
    const fitxer = (await copiaDeDrive(drive))!
    const clauDrive = await obrirClauCopia(fitxer, { tipus: 'contrasenya', valor: CONTRASENYA_A })
    const r = await fusionarAmbDrive(b.db, b.clau, fitxer, clauDrive, drive)
    expect(r.possiblesDuplicats).toBe(1)

    // El Chrome adopta la clau de Drive: s'obre amb la contrasenya del Firefox
    await desbloquejarClauMestra((await llegirClauEmbolcallada(b.db))!, CONTRASENYA_A)
    await expect(desbloquejarClauMestra((await llegirClauEmbolcallada(b.db))!, CONTRASENYA_B)).rejects.toBeInstanceOf(ErrorContrasenya)
    const mb = crearMagatzem(b.db, clauDrive)
    await sincronitzar(b.db, clauDrive, drive, DIA)
    await sincronitzar(a.db, a.clau, drive, DIA)

    for (const m of [a.magatzem, mb]) {
      const pacients = await m.llistarPacients()
      expect(pacients.map((p) => p.id).sort()).toEqual([aina.id, aina2.id, bernat.id].sort())
      // Mateix nom i data: no s'han ajuntat, totes dues marcades per revisar
      expect(pacients.find((p) => p.id === aina.id)!.revisarDuplicat).toEqual([aina2.id])
      expect(pacients.find((p) => p.id === aina2.id)!.revisarDuplicat).toEqual([aina.id])
      expect(pacients.find((p) => p.id === aina2.id)!.telefon).toBe('600 999 000')
      expect(pacients.find((p) => p.id === bernat.id)!.revisarDuplicat).toBeUndefined()
      expect((await totesLesCites(m)).map((c) => c.inici)).toEqual([
        '2026-11-02T09:15',
        '2026-11-02T20:00',
        '2026-11-04T17:00',
        '2026-11-05T10:00',
        '2026-11-07T13:15',
      ])
    }
    // L'esborrany del Chrome es conserva, tornat a xifrar
    expect((await mb.llistarEsborranys()).map((e) => e.valors)).toEqual([{ nom: 'Carme' }])
    // Drive ja és d'una sola clau
    for (const f of drive.fitxers.values()) if (/^qi-(foto|dispositiu)-/.test(f.name)) expect(llegirFitxer2(f.contingut).clauId).toBe(fitxer.clauId)
  })

  it('«No és la mateixa persona» treu l\'avís de totes dues fitxes', async () => {
    const { drive, b, aina, aina2 } = await escenari()
    const fitxer = (await copiaDeDrive(drive))!
    const clauDrive = await obrirClauCopia(fitxer, { tipus: 'contrasenya', valor: CONTRASENYA_A })
    await fusionarAmbDrive(b.db, b.clau, fitxer, clauDrive, drive)
    const m = crearMagatzem(b.db, clauDrive)
    await m.descartarDuplicat(aina.id, aina2.id)
    expect((await m.obtenirPacient(aina.id))!.revisarDuplicat).toBeUndefined()
    expect((await m.obtenirPacient(aina2.id))!.revisarDuplicat).toBeUndefined()
  })

  it('l\'avís es manté quan s\'editen les dades del pacient', async () => {
    const { drive, b, aina2 } = await escenari()
    const fitxer = (await copiaDeDrive(drive))!
    const clauDrive = await obrirClauCopia(fitxer, { tipus: 'contrasenya', valor: CONTRASENYA_A })
    await fusionarAmbDrive(b.db, b.clau, fitxer, clauDrive, drive)
    const m = crearMagatzem(b.db, clauDrive)
    const { revisarDuplicat: _r, arxivat: _a, id: _i, creatAt: _c, modificatAt: _m, ...dades } = (await m.obtenirPacient(aina2.id))!
    expect((await m.actualitzarPacient(aina2.id, { ...dades, professio: 'Mestra' })).revisarDuplicat).toHaveLength(1)
  })

  it('amb la clau de recuperació de la còpia de Drive també es pot obrir; una clau errònia no toca res', async () => {
    const { drive, a } = await escenari()
    const secret = generarSecretRecuperacio()
    const embolcall = (await llegirClauEmbolcallada(a.db))!
    await guardarSecrets(a.db, [await afegirEmbolcallSecret(embolcall, CONTRASENYA_A, secret, { tipus: 'recuperacio' })])
    await sincronitzar(a.db, a.clau, drive, DIA)
    const fitxer = (await copiaDeDrive(drive))!
    const clau = await obrirClauCopia(fitxer, { tipus: 'recuperacio', valor: textClauRecuperacio(secret) })
    expect(await idClau(clau)).toBe(fitxer.clauId)
    await expect(
      obrirClauCopia(fitxer, { tipus: 'recuperacio', valor: textClauRecuperacio(generarSecretRecuperacio()) }),
    ).rejects.toBeInstanceOf(ErrorClauRecuperacio)
  })

  it('pacients iguals: mateix nom i data, sense comptar accents, majúscules ni espais', () => {
    expect(clauPersona({ nom: 'Aina ', llinatges: 'Provençal  Inventada', dataNaixement: '1980-05-17' })).toBe(
      clauPersona({ nom: 'aina', llinatges: 'PROVENCAL inventada', dataNaixement: '1980-05-17' }),
    )
    expect(clauPersona({ nom: 'Aina', llinatges: 'Provencal', dataNaixement: '1980-05-17' })).not.toBe(
      clauPersona({ nom: 'Aina', llinatges: 'Provencal', dataNaixement: '1980-05-18' }),
    )
  })
})

describe('recuperar les dades de Drive en aquest dispositiu', () => {
  it('el dispositiu té les dades de Drive i les d\'abans queden en un .qi que s\'obre amb la seva contrasenya', async () => {
    const { drive, b, aina, bernat } = await escenari()
    const fitxer = (await copiaDeDrive(drive))!
    const clauDrive = await obrirClauCopia(fitxer, { tipus: 'contrasenya', valor: CONTRASENYA_A })
    await desarCopiaAbansCanviClau(b.db, b.clau)
    await recuperarDeDrive(b.db, b.clau, fitxer, clauDrive, drive)

    const mb = crearMagatzem(b.db, clauDrive)
    expect((await mb.llistarPacients()).map((p) => p.id)).toEqual([aina.id])
    expect((await mb.llistarEsborranys()).map((e) => e.valors)).toEqual([{ nom: 'Carme' }])

    const abans = llegirQi((await llegirCopiaAbansCanviClau(b.db))!.text)
    const clauAbans = await obrirClauCopia(abans, { tipus: 'contrasenya', valor: CONTRASENYA_B })
    const contingut = await desxifrarCopia(clauAbans, abans)
    expect(contingut.taules.pacients.map((p) => (p as { id: string }).id)).toContain(bernat.id)
    expect(contingut.taules.cites).toHaveLength(4)
  })
})

describe('fitxer .qi', () => {
  it('d\'un altre dispositiu (una altra clau): les seves dades s\'afegeixen sense perdre les pròpies', async () => {
    const { a, b, bernat } = await escenari()
    const qi = llegirQi(await exportarQi(b.db, b.clau))
    // Al fitxer no hi ha res en clar
    expect(JSON.stringify(qi)).not.toContain('Bernat')
    const clauQi = await obrirClauCopia(qi, { tipus: 'contrasenya', valor: CONTRASENYA_B })
    const r = await importarQi(a.db, a.clau, qi, clauQi)
    expect(r.possiblesDuplicats).toBe(1)
    const pacients = await a.magatzem.llistarPacients()
    expect(pacients).toHaveLength(3)
    expect(pacients.map((p) => p.id)).toContain(bernat.id)
    expect(await totesLesCites(a.magatzem)).toHaveLength(5)
  })

  it('del mateix dispositiu: el que s\'ha canviat després guanya (s\'ha fet sobre el fitxer) i no és cap conflicte', async () => {
    const { a, aina } = await escenari()
    const qi = llegirQi(await exportarQi(a.db, a.clau))
    const { revisarDuplicat: _r, arxivat: _a, id: _i, creatAt: _c, modificatAt: _m, ...dades } = aina
    await new Promise((r) => setTimeout(r, 5))
    await a.magatzem.actualitzarPacient(aina.id, { ...dades, telefon: '600 333 444' })
    const clauQi = await obrirClauCopia(qi, { tipus: 'contrasenya', valor: CONTRASENYA_A })
    const r = await importarQi(a.db, a.clau, qi, clauQi)
    expect(r.conflictes).toBe(0)
    expect((await a.magatzem.obtenirPacient(aina.id))!.telefon).toBe('600 333 444')
    expect(await a.magatzem.conflictesDe(aina.id)).toEqual([])
  })

  it('amb la contrasenya equivocada no s\'importa res', async () => {
    const { b } = await escenari()
    const qi = llegirQi(await exportarQi(b.db, b.clau))
    await expect(obrirClauCopia(qi, { tipus: 'contrasenya', valor: 'no-es-aquesta' })).rejects.toBeInstanceOf(ErrorContrasenya)
  })
})

describe('d) fitxer de Drive danyat: les còpies diària i mensual', () => {
  it('es fa servir l\'última còpia que es pot obrir i la danyada es guarda a part', async () => {
    const { drive, a } = await escenari()
    // Un dispositiu que encara no ha llegit la foto
    const c = await dispositiu(CONTRASENYA_A)
    await guardarClauEmbolcallada(c.db, (await llegirClauEmbolcallada(a.db))!)
    const foto = [...drive.fitxers.values()].find((f) => f.name.startsWith('qi-foto-'))!
    const danyat = foto.contingut.slice(0, 200)
    foto.contingut = danyat
    foto.version = '99'
    await expect(sincronitzar(c.db, a.clau, drive, DIA)).rejects.toBeInstanceOf(ErrorCopiaDanyada)

    await sincronitzar(c.db, a.clau, drive, { ara: DIA, copiaAnterior: true })
    expect((await crearMagatzem(c.db, a.clau).llistarPacients()).map((p) => p.nom)).toEqual(['Aina'])
    const guardada = [...drive.fitxers.values()].find((f) => f.name.startsWith('qi-danyada-'))
    expect(guardada?.contingut).toBe(danyat)
    // I a partir d'ara, normal (amb una foto nova)
    await sincronitzar(a.db, a.clau, drive, DIA)
    await obrirFoto(a.clau, fotoDe(drive) as never)
  })
})

describe('sense còpia més de 24 hores', () => {
  const ara = new Date('2026-11-04T12:00:00Z').getTime()
  it('fins a 24 hores no s\'avisa; després, els dies que fa', () => {
    expect(diesSenseCopia(null, ara)).toBeNull()
    expect(diesSenseCopia('2026-11-03T13:00:00Z', ara)).toBeNull()
    expect(diesSenseCopia('2026-11-03T11:00:00Z', ara)).toBe(1)
    expect(diesSenseCopia('2026-11-02T11:00:00Z', ara)).toBe(2)
    expect(textSenseCopia(1)).toBe('Fa 1 dia que no es fa cap còpia')
    expect(textSenseCopia(2)).toBe('Fa 2 dies que no es fa cap còpia')
  })
})
