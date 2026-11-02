import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { crearClauMestra } from '../crypto'
import { QiDB } from '../db/esquema'
import { crearMagatzem, llegirClauEmbolcallada } from '../db/magatzem'
import { driveEnMemoria } from '../test/driveEnMemoria'
import { ErrorCopiaDanyada, ErrorCopiaVersio, llegirFitxer, migrarContingut, xifrarCopia } from './copia'
import { ErrorAutoritzacio } from './drive'
import { classificar, copiaPerRecuperar, ErrorRecuperacio, obrirClauMestra, restaurarCopia } from './recuperacio'
import { FITXER_PRINCIPAL } from './sincronitzar'

/** Còpia feta amb el codi de la versió 13709c4 (abans de l'orella i de l'agenda nova), amb dades inventades */
const COPIA_ANTIGA = readFileSync('tests/e2e/dades/copia-versio-13709c4.json', 'utf8')
const CONTRASENYA = 'contrasenya-de-prova-e2e'

const dbs: QiDB[] = []
function novaDb() {
  const db = new QiDB(`prova-${crypto.randomUUID()}`)
  dbs.push(db)
  return db
}
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete()
  vi.restoreAllMocks()
})

async function errorDe(p: Promise<unknown>): Promise<ErrorRecuperacio> {
  try {
    await p
  } catch (e) {
    if (e instanceof ErrorRecuperacio) return e
    throw e
  }
  throw new Error('No ha fallat')
}

describe('còpia d\'una versió anterior', () => {
  it('es recupera amb la versió actual: les taules noves queden buides', async () => {
    const fitxer = llegirFitxer(COPIA_ANTIGA)
    // La còpia antiga no té les taules de l'orella, l'horari ni els dies tancats
    const db = novaDb()
    const clau = await obrirClauMestra(fitxer, CONTRASENYA)
    await restaurarCopia(db, clau, fitxer)
    const m = crearMagatzem(db, clau)
    const pacients = await m.llistarPacients()
    expect(pacients.map((p) => p.nom)).toEqual(['Aina'])
    expect(await m.llistarCites('0000', '9999')).toHaveLength(1)
    expect(await db.calibratgeOrella.count()).toBe(0)
    expect(await db.diesTancats.count()).toBe(0)
    expect(await llegirClauEmbolcallada(db)).toEqual(fitxer.embolcalls.contrasenya)
  }, 20_000)

  it('migrar omple les taules que falten i manté les que hi són', () => {
    const c = migrarContingut({ versio: 1, taules: { pacients: [{ id: 'a' }] } })
    expect(c.taules.pacients).toEqual([{ id: 'a' }])
    expect(c.taules.configuracio).toEqual([])
    expect(c.esborrats).toEqual([])
  })
})

describe('cada error amb el seu tipus i el seu pas', () => {
  it('contrasenya incorrecta (pas C), sense res a la consola', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = await errorDe(obrirClauMestra(llegirFitxer(COPIA_ANTIGA), 'no-es-aquesta'))
    expect([e.tipus, e.pas]).toEqual(['contrasenya', 'C'])
    expect(consola).not.toHaveBeenCalled()
  }, 20_000)

  it('còpia d\'una versió més nova o danyada (pas B)', () => {
    expect(() => llegirFitxer(JSON.stringify({ format: 'qi-copia', versio: 2 }))).toThrow(ErrorCopiaVersio)
    expect(() => llegirFitxer('{no és json')).toThrow(ErrorCopiaDanyada)
    expect(() => llegirFitxer(JSON.stringify({ format: 'altra cosa' }))).toThrow(ErrorCopiaDanyada)
    expect(() => migrarContingut({ versio: 3, taules: {} })).toThrow(ErrorCopiaVersio)
    expect(() => migrarContingut({ versio: 1, taules: { pacients: 'x' } })).toThrow(ErrorCopiaDanyada)
  })

  it('contingut que no es pot desxifrar amb la clau bona: danyada (pas D1), amb codi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { clau, embolcall } = await crearClauMestra(CONTRASENYA, 1000)
    const fitxer = await xifrarCopia(clau, migrarContingut({ versio: 1, taules: {} }), {
      contrasenya: embolcall,
      contrasenyaAt: '2026-11-01T00:00:00.000Z',
      secrets: [],
    })
    const malmes = { ...fitxer, xifrat: { ...fitxer.xifrat, dades: fitxer.xifrat.dades.slice(0, -8) + 'AAAAAAAA' } }
    const e = await errorDe(restaurarCopia(novaDb(), clau, malmes))
    expect([e.tipus, e.pas, e.codi]).toEqual(['danyada', 'D1', 'REC-D1'])
  })

  it('Drive sense permís (sessió caducada) en llegir la còpia: pas A, tipus drive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const drive = driveEnMemoria()
    drive.llistar = () => Promise.reject(new ErrorAutoritzacio())
    const e = await errorDe(copiaPerRecuperar(drive))
    expect([e.tipus, e.pas]).toEqual(['drive', 'A'])
  })

  it('la resta: inesperat, amb el codi del pas; a la consola el pas i el nom, mai el missatge', () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = classificar('D2', new TypeError('dada clínica: Aina, 600 111 222'))
    expect([e.tipus, e.codi]).toEqual(['inesperat', 'REC-D2'])
    const escrit = consola.mock.calls.flat().join(' ')
    expect(escrit).toContain('D2')
    expect(escrit).toContain('TypeError')
    expect(escrit).not.toContain('Aina')
    expect(e.message).not.toContain('Aina')
  })

  it('llegir la còpia de Drive no hi escriu res', async () => {
    const drive = driveEnMemoria()
    await drive.crear(FITXER_PRINCIPAL, COPIA_ANTIGA)
    const abans = JSON.stringify([...drive.fitxers.values()])
    expect(await copiaPerRecuperar(drive)).not.toBeNull()
    expect(JSON.stringify([...drive.fitxers.values()])).toBe(abans)
  })
})
