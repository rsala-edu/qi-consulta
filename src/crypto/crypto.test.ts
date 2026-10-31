// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { desxifrarJson, ErrorDesxifratge, xifrarJson } from './aesGcm'
import {
  canviarContrasenya,
  crearClauMestra,
  desbloquejarClauMestra,
  ErrorContrasenya,
} from './clauMestra'
import { base64ABytes, bytesABase64, bytesAText, textABytes } from './codificacio'
import { ITERACIONS_PBKDF2 } from './derivacio'

// A les proves fem servir poques iteracions perquè vagin de pressa.
const IT = 1_000
const CONTRASENYA = 'prova-de-contrasenya'
const pacientInventat = { nom: 'Mercè', llinatges: 'Prova Inventada', telefon: '600000000' }

describe('codificació', () => {
  it('fa anada i tornada de base64 i text, amb accents', () => {
    const bytes = textABytes('Llengua pàl·lida, saburra blanca 舌')
    expect(bytesAText(base64ABytes(bytesABase64(bytes)))).toBe('Llengua pàl·lida, saburra blanca 舌')
  })
})

describe('derivació', () => {
  it('fa servir 600.000 iteracions per defecte', () => {
    expect(ITERACIONS_PBKDF2).toBe(600_000)
  })
})

describe('clau mestra', () => {
  it('es crea com a no extractable i no es pot exportar', async () => {
    const { clau } = await crearClauMestra(CONTRASENYA, IT)
    expect(clau.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', clau)).rejects.toThrow()
  })

  it('l\'embolcall guarda els paràmetres i no conté la contrasenya', async () => {
    const { embolcall } = await crearClauMestra(CONTRASENYA, IT)
    expect(embolcall).toMatchObject({ versio: 1, kdf: 'PBKDF2-SHA256', iteracions: IT })
    expect(base64ABytes(embolcall.sal)).toHaveLength(16)
    expect(base64ABytes(embolcall.iv)).toHaveLength(12)
    expect(JSON.stringify(embolcall)).not.toContain(CONTRASENYA)
  })

  it('es desbloqueja amb la contrasenya correcta com a no extractable', async () => {
    const { embolcall, clau } = await crearClauMestra(CONTRASENYA, IT)
    const xifrat = await xifrarJson(clau, pacientInventat, 'pacients:1')

    const desbloquejada = await desbloquejarClauMestra(embolcall, CONTRASENYA)
    expect(desbloquejada.extractable).toBe(false)
    expect(await desxifrarJson(desbloquejada, xifrat, 'pacients:1')).toEqual(pacientInventat)
  })

  it('rebutja una contrasenya incorrecta', async () => {
    const { embolcall } = await crearClauMestra(CONTRASENYA, IT)
    await expect(desbloquejarClauMestra(embolcall, 'una-altra')).rejects.toBeInstanceOf(ErrorContrasenya)
  })

  it('normalitza la contrasenya (à composta = à descomposta)', async () => {
    const { embolcall } = await crearClauMestra('contrasenyà', IT)
    await expect(desbloquejarClauMestra(embolcall, 'contrasenyà')).resolves.toBeDefined()
  })

  it('dues claus creades amb la mateixa contrasenya són diferents (sal i clau aleatòries)', async () => {
    const a = await crearClauMestra(CONTRASENYA, IT)
    const b = await crearClauMestra(CONTRASENYA, IT)
    expect(a.embolcall.sal).not.toBe(b.embolcall.sal)
    expect(a.embolcall.clau).not.toBe(b.embolcall.clau)
    const xifrat = await xifrarJson(a.clau, pacientInventat, 'c')
    await expect(desxifrarJson(b.clau, xifrat, 'c')).rejects.toBeInstanceOf(ErrorDesxifratge)
  })
})

describe('canvi de contrasenya', () => {
  it('manté la mateixa clau mestra: les dades antigues es llegeixen amb la contrasenya nova', async () => {
    const { embolcall, clau } = await crearClauMestra(CONTRASENYA, IT)
    const xifrat = await xifrarJson(clau, pacientInventat, 'pacients:1')

    const nou = await canviarContrasenya(embolcall, CONTRASENYA, 'contrasenya-nova', IT)
    expect(nou.sal).not.toBe(embolcall.sal)

    const ambNova = await desbloquejarClauMestra(nou, 'contrasenya-nova')
    expect(ambNova.extractable).toBe(false)
    expect(await desxifrarJson(ambNova, xifrat, 'pacients:1')).toEqual(pacientInventat)
    await expect(desbloquejarClauMestra(nou, CONTRASENYA)).rejects.toBeInstanceOf(ErrorContrasenya)
  })

  it('exigeix la contrasenya actual', async () => {
    const { embolcall } = await crearClauMestra(CONTRASENYA, IT)
    await expect(canviarContrasenya(embolcall, 'no-es-aquesta', 'nova', IT)).rejects.toBeInstanceOf(
      ErrorContrasenya,
    )
  })
})

describe('AES-GCM', () => {
  it('fa servir un IV diferent a cada xifratge', async () => {
    const { clau } = await crearClauMestra(CONTRASENYA, IT)
    const a = await xifrarJson(clau, pacientInventat, 'c')
    const b = await xifrarJson(clau, pacientInventat, 'c')
    expect(a.iv).not.toBe(b.iv)
    expect(a.dades).not.toBe(b.dades)
  })

  it('el text xifrat no conté les dades en clar', async () => {
    const { clau } = await crearClauMestra(CONTRASENYA, IT)
    const xifrat = await xifrarJson(clau, pacientInventat, 'c')
    const brut = bytesAText(base64ABytes(xifrat.dades))
    expect(brut).not.toContain('Mercè')
    expect(xifrat.dades).not.toContain(btoa('600000000'))
  })

  it('detecta qualsevol modificació del text xifrat', async () => {
    const { clau } = await crearClauMestra(CONTRASENYA, IT)
    const xifrat = await xifrarJson(clau, pacientInventat, 'c')
    const bytes = base64ABytes(xifrat.dades)
    bytes[0] = (bytes[0] ?? 0) ^ 1
    await expect(desxifrarJson(clau, { ...xifrat, dades: bytesABase64(bytes) }, 'c')).rejects.toBeInstanceOf(
      ErrorDesxifratge,
    )
  })

  it('no desxifra un registre copiat a un altre lloc (context diferent)', async () => {
    const { clau } = await crearClauMestra(CONTRASENYA, IT)
    const xifrat = await xifrarJson(clau, pacientInventat, 'pacients:1')
    await expect(desxifrarJson(clau, xifrat, 'pacients:2')).rejects.toBeInstanceOf(ErrorDesxifratge)
  })
})
