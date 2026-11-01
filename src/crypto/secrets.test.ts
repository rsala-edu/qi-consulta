// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { desxifrarJson, xifrarJson } from './aesGcm'
import {
  afegirEmbolcallSecret,
  contrasenyaNovaAmbSecret,
  crearClauMestra,
  desbloquejarAmbSecret,
  desbloquejarClauMestra,
  ErrorContrasenya,
  ErrorSecret,
} from './clauMestra'
import { bytesAleatoris } from './codificacio'
import { hashCorreu } from './hash'
import { generarSecretRecuperacio, llegirClauRecuperacio, textClauRecuperacio } from './recuperacio'

const IT = 1_000
const CONTRASENYA = 'prova-de-contrasenya'

describe('clau de recuperació', () => {
  it('són 52 caràcters en grups de 4, sense lletres que es confonguin', () => {
    const text = textClauRecuperacio(generarSecretRecuperacio())
    expect(text).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){12}[0-9A-HJKMNP-TV-Z]{4}$/)
  })

  it('es llegeix tal com s\'escrigui (minúscules, espais, O per 0, I/L per 1)', () => {
    for (let i = 0; i < 20; i++) {
      const secret = generarSecretRecuperacio()
      const text = textClauRecuperacio(secret)
      expect(llegirClauRecuperacio(text)).toEqual(secret)
      const descuidat = text.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l')
      expect(llegirClauRecuperacio(descuidat)).toEqual(secret)
    }
  })

  it('rebutja una clau incompleta o amb caràcters estranys', () => {
    const text = textClauRecuperacio(generarSecretRecuperacio())
    expect(llegirClauRecuperacio(text.slice(0, -2))).toBeNull()
    expect(llegirClauRecuperacio(`${text.slice(0, -1)}U`)).toBeNull()
  })
})

describe('obrir la clau mestra amb un secret (empremta o clau de recuperació)', () => {
  it('el secret obre la mateixa clau mestra (no extractable)', async () => {
    const { embolcall, clau } = await crearClauMestra(CONTRASENYA, IT)
    const dades = await xifrarJson(clau, { nom: 'Mercè Prova Inventada' }, 'qi:pacients:1')
    const secret = generarSecretRecuperacio()
    const e = await afegirEmbolcallSecret(embolcall, CONTRASENYA, secret, { tipus: 'recuperacio' })
    expect(e).toMatchObject({ versio: 1, tipus: 'recuperacio' })
    const oberta = await desbloquejarAmbSecret(e, secret)
    expect(oberta.extractable).toBe(false)
    expect(await desxifrarJson(oberta, dades, 'qi:pacients:1')).toEqual({ nom: 'Mercè Prova Inventada' })
  })

  it('cal la contrasenya per afegir-lo, i un secret erroni no obre res', async () => {
    const { embolcall } = await crearClauMestra(CONTRASENYA, IT)
    const secret = bytesAleatoris(32)
    await expect(afegirEmbolcallSecret(embolcall, 'una-altra', secret, { tipus: 'passkey' })).rejects.toThrow(ErrorContrasenya)
    const e = await afegirEmbolcallSecret(embolcall, CONTRASENYA, secret, { tipus: 'passkey', credencial: 'Y3JlZA==', salPrf: 'c2Fs' })
    expect(e.credencial).toBe('Y3JlZA==')
    await expect(desbloquejarAmbSecret(e, bytesAleatoris(32))).rejects.toThrow(ErrorSecret)
    // un embolcall de passkey no serveix com a clau de recuperació
    await expect(desbloquejarAmbSecret({ ...e, tipus: 'recuperacio' }, secret)).rejects.toThrow(ErrorSecret)
  })

  it('amb la clau de recuperació es posa una contrasenya nova i les dades es continuen llegint', async () => {
    const { embolcall, clau } = await crearClauMestra(CONTRASENYA, IT)
    const dades = await xifrarJson(clau, { nota: 'acúfens' }, 'ctx')
    const secret = generarSecretRecuperacio()
    const e = await afegirEmbolcallSecret(embolcall, CONTRASENYA, secret, { tipus: 'recuperacio' })
    const nou = await contrasenyaNovaAmbSecret(e, secret, 'contrasenya-nova', IT)
    expect(await desxifrarJson(nou.clau, dades, 'ctx')).toEqual({ nota: 'acúfens' })
    const ambNova = await desbloquejarClauMestra(nou.embolcall, 'contrasenya-nova')
    expect(await desxifrarJson(ambNova, dades, 'ctx')).toEqual({ nota: 'acúfens' })
    await expect(desbloquejarClauMestra(nou.embolcall, CONTRASENYA)).rejects.toThrow(ErrorContrasenya)
  })
})

describe('hash del correu', () => {
  it('és el SHA-256 del correu en minúscules i sense espais', async () => {
    // sha256("doctora@exemple.invalid")
    const h = await hashCorreu('  Doctora@Exemple.INVALID ')
    expect(h).toBe('d1949bb93978ebea0b611a497057f210e94c831269473405e18e797069478384')
    expect(h).toBe(await hashCorreu('doctora@exemple.invalid'))
    expect(h).not.toBe(await hashCorreu('altra@exemple.invalid'))
  })
})
