// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { esCorreuPermes, llegirHashos } from './google'

const DOCTORA = 'd1949bb93978ebea0b611a497057f210e94c831269473405e18e797069478384' // doctora@exemple.invalid
const PROVES = '5c9fa083cf8e097e6968ca8f63acdfe0433a7c456b09b516a12f43702d2cf7ef' // proves@exemple.invalid

describe('correus permesos', () => {
  it('la variable és una llista de hashos separats per comes (amb espais o majúscules)', () => {
    expect(llegirHashos(`${DOCTORA}, ${PROVES.toUpperCase()} ,`)).toEqual([DOCTORA, PROVES])
    expect(llegirHashos(undefined)).toEqual([])
    // un correu en clar o un hash mal copiat no compta
    expect(llegirHashos('doctora@exemple.invalid,abc123')).toEqual([])
  })

  it('entren els dos comptes de la llista i cap altre', async () => {
    const hashos = [DOCTORA, PROVES]
    expect(await esCorreuPermes('doctora@exemple.invalid', hashos)).toBe(true)
    expect(await esCorreuPermes('Proves@Exemple.invalid', hashos)).toBe(true)
    expect(await esCorreuPermes('una-altra@exemple.invalid', hashos)).toBe(false)
    expect(await esCorreuPermes('', hashos)).toBe(false)
    // sense cap hash configurat no entra ningú
    expect(await esCorreuPermes('doctora@exemple.invalid', [])).toBe(false)
  })
})
