import { describe, expect, it } from 'vitest'
import { ambCalibratge, cataleg, cercarPunts, exportarCataleg, nomMeridia, posicioDe } from './cataleg'
import { esquemaCataleg, type Posicio3D } from './esquema'

describe('catàleg del projecte', () => {
  it('té els meridians LI (20 punts) i ST (45 punts), bilaterals', () => {
    expect(cataleg.meridians.map((m) => [m.codi, m.punts, m.bilateral])).toEqual([
      ['LI', 20, true],
      ['ST', 45, true],
    ])
    for (const m of cataleg.meridians) {
      const punts = cataleg.punts.filter((p) => p.meridia === m.codi)
      expect(punts.map((p) => p.numero)).toEqual(Array.from({ length: m.punts }, (_, i) => i + 1))
    }
  })

  it('té codi, pinyin i hanzi a tots els punts', () => {
    for (const p of cataleg.punts) {
      expect(p.pinyin).toMatch(/^[A-Z][a-z]+$/)
      expect(p.hanzi).toMatch(/^\p{Script=Han}{2,3}$/u)
    }
    expect(cataleg.punts.find((p) => p.codi === 'LI4')).toMatchObject({ pinyin: 'Hegu', hanzi: '合谷' })
    expect(cataleg.punts.find((p) => p.codi === 'ST36')).toMatchObject({ pinyin: 'Zusanli', hanzi: '足三里' })
  })

  it('encara no té cap posició: s\'han de calibrar sobre el model definitiu', () => {
    expect(cataleg.punts.every((p) => p.posicions.length === 0 && p.orella === null)).toBe(true)
  })

  it('les localitzacions i els noms en català queden pendents de la doctora', () => {
    expect(cataleg.punts.every((p) => !p.revisat && p.localitzacio === '' && p.nomCatala === '')).toBe(true)
  })

  it('marca LI4 com a precaució en l\'embaràs', () => {
    expect(cataleg.punts.find((p) => p.codi === 'LI4')?.precaucions.embaras).toBe(true)
  })

  it('dona el nom del meridià', () => {
    expect(nomMeridia(cataleg, 'ST')).toBe('Estómac')
  })
})

describe('validació del format', () => {
  const base = () => structuredClone(cataleg)
  const posicio: Posicio3D = { topologia: 'prova', costat: 'E', triangle: 12, b: [0.2, 0.3, 0.5] }

  it('accepta una posició baricèntrica vàlida', () => {
    const c = base()
    c.punts[0]!.posicions = [posicio]
    expect(esquemaCataleg.safeParse(c).success).toBe(true)
  })

  it('rebutja baricèntriques que no sumen 1 o fora de rang', () => {
    const c = base()
    c.punts[0]!.posicions = [{ ...posicio, b: [0.5, 0.5, 0.5] }]
    expect(esquemaCataleg.safeParse(c).success).toBe(false)
    c.punts[0]!.posicions = [{ ...posicio, b: [1.5, -0.5, 0] }]
    expect(esquemaCataleg.safeParse(c).success).toBe(false)
  })

  it('rebutja codis repetits, codis que no quadren i posicions duplicades', () => {
    const repetit = base()
    repetit.punts[1]!.codi = 'LI1'
    expect(esquemaCataleg.safeParse(repetit).success).toBe(false)

    const malCodi = base()
    malCodi.punts[0]!.numero = 7
    expect(esquemaCataleg.safeParse(malCodi).success).toBe(false)

    const duplicada = base()
    duplicada.punts[0]!.posicions = [posicio, { ...posicio, triangle: 3 }]
    expect(esquemaCataleg.safeParse(duplicada).success).toBe(false)
  })
})

describe('cercador', () => {
  const codis = (q: string) => cercarPunts(cataleg, q).map((p) => p.codi)

  it('troba per codi en qualsevol format', () => {
    expect(codis('ST36')[0]).toBe('ST36')
    expect(codis('st 36')[0]).toBe('ST36')
    expect(codis('li4')[0]).toBe('LI4')
  })

  it('troba per pinyin sense accents, majúscules ni espais', () => {
    expect(codis('zusanli')).toEqual(['ST36'])
    expect(codis('Zu San Li')).toEqual(['ST36'])
    expect(codis('hegu')).toEqual(['LI4'])
  })

  it('Futu és a LI18 i a ST32', () => {
    expect(codis('futu')).toEqual(['LI18', 'ST32'])
  })

  it('una consulta buida no dona res', () => {
    expect(codis('  ')).toEqual([])
  })
})

describe('calibratge sobre el catàleg', () => {
  const pos = (costat: 'E' | 'D', triangle: number): Posicio3D => ({ topologia: 'maniqui', costat, triangle, b: [1, 0, 0] })

  it('afegeix, substitueix i esborra posicions sense tocar les altres topologies', () => {
    const c1 = ambCalibratge(cataleg, [
      { codi: 'LI4', topologia: 'maniqui', costat: 'D', posicio: pos('D', 5) },
      { codi: 'LI4', topologia: 'maniqui', costat: 'E', posicio: pos('E', 9) },
    ])
    const li4 = c1.punts.find((p) => p.codi === 'LI4')!
    expect(li4.posicions.map((q) => q.costat)).toEqual(['E', 'D'])
    expect(posicioDe(li4, 'maniqui', 'E')?.triangle).toBe(9)
    expect(posicioDe(li4, 'una-altra', 'E')).toBeUndefined()

    const c2 = ambCalibratge(c1, [{ codi: 'LI4', topologia: 'maniqui', costat: 'E', posicio: null }])
    expect(c2.punts.find((p) => p.codi === 'LI4')!.posicions.map((q) => q.costat)).toEqual(['D'])
    // El catàleg original no canvia
    expect(cataleg.punts.find((p) => p.codi === 'LI4')!.posicions).toEqual([])
  })

  it('exporta un JSON vàlid que es pot tornar a carregar', () => {
    const c = ambCalibratge(cataleg, [{ codi: 'ST36', topologia: 'maniqui', costat: 'E', posicio: pos('E', 1) }])
    const json = exportarCataleg(c)
    expect(esquemaCataleg.parse(JSON.parse(json))).toEqual(c)
    expect(json.endsWith('\n')).toBe(true)
  })
})
