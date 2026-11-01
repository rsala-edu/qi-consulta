import { describe, expect, it } from 'vitest'
import { ambCalibratge, ambPrecaucions, cataleg, cercarPunts, exportarCataleg, nomMeridia, posicioDe, puntsAmbPrecaucio } from './cataleg'
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

  it('cada punt té posició als dos costats sobre el cos definitiu, calculada amb la regla de l\'OMS', () => {
    for (const p of cataleg.punts) {
      const mh = p.posicions.filter((q) => q.topologia.startsWith('mh-'))
      expect(mh.map((q) => q.costat).sort(), p.codi).toEqual(['D', 'E'])
      expect(mh.every((q) => q.origen === 'oms' || q.origen === 'doctora'), p.codi).toBe(true)
      expect(p.orella).toBeNull()
    }
  })

  it('cada punt té la localització redactada; el nom català i la revisió queden per a la doctora', () => {
    for (const p of cataleg.punts) {
      expect(p.localitzacio.length, p.codi).toBeGreaterThan(30)
      expect(p.localitzacio.endsWith('.'), p.codi).toBe(true)
      expect(p.nomCatala).toBe('')
      expect(p.revisat).toBe(false)
    }
  })

  it('té una llista curta de precaucions pendents de confirmar', () => {
    const amb = cataleg.punts.filter((p) => p.precaucions.nota !== '')
    expect(amb.length).toBeGreaterThan(10)
    expect(amb.length).toBeLessThan(40)
    expect(cataleg.punts.every((p) => !p.precaucions.confirmada)).toBe(true)
    expect(cataleg.punts.find((p) => p.codi === 'LI4')?.precaucions.embaras).toBe(true)
    expect(cataleg.punts.find((p) => p.codi === 'ST9')?.precaucions.nota).toMatch(/caròtida/)
  })

  it('dona el nom del meridià', () => {
    expect(nomMeridia(cataleg, 'ST')).toBe('Estómac')
  })
})

describe('validació del format', () => {
  const base = () => structuredClone(cataleg)
  const posicio: Posicio3D = { topologia: 'prova', costat: 'E', triangle: 12, b: [0.2, 0.3, 0.5], origen: 'manual' }

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
  const pos = (costat: 'E' | 'D', triangle: number): Posicio3D => ({ topologia: 'maniqui', costat, triangle, b: [1, 0, 0], origen: 'manual' })

  it('afegeix, substitueix i esborra posicions sense tocar les altres topologies', () => {
    const c1 = ambCalibratge(cataleg, [
      { codi: 'LI4', topologia: 'maniqui', costat: 'D', posicio: pos('D', 5) },
      { codi: 'LI4', topologia: 'maniqui', costat: 'E', posicio: pos('E', 9) },
    ])
    const li4 = c1.punts.find((p) => p.codi === 'LI4')!
    expect(li4.posicions.filter((q) => q.topologia === 'maniqui').map((q) => q.costat)).toEqual(['E', 'D'])
    expect(posicioDe(li4, 'maniqui', 'E')?.triangle).toBe(9)
    expect(posicioDe(li4, 'una-altra', 'E')).toBeUndefined()

    const c2 = ambCalibratge(c1, [{ codi: 'LI4', topologia: 'maniqui', costat: 'E', posicio: null }])
    const maniqui = (c: typeof c2) => c.punts.find((p) => p.codi === 'LI4')!.posicions.filter((q) => q.topologia === 'maniqui')
    expect(maniqui(c2).map((q) => q.costat)).toEqual(['D'])
    // Les posicions del cos definitiu i el catàleg original no canvien
    expect(c2.punts.find((p) => p.codi === 'LI4')!.posicions.filter((q) => q.topologia !== 'maniqui')).toHaveLength(2)
    expect(maniqui(cataleg)).toEqual([])
  })

  it('exporta un JSON vàlid que es pot tornar a carregar', () => {
    const c = ambCalibratge(cataleg, [{ codi: 'ST36', topologia: 'maniqui', costat: 'E', posicio: pos('E', 1) }])
    const json = exportarCataleg(c)
    expect(esquemaCataleg.parse(JSON.parse(json))).toEqual(c)
    expect(json.endsWith('\n')).toBe(true)
  })
})

describe('precaucions revisades per la doctora', () => {
  it('hi ha 28 punts amb precaució per revisar', () => {
    expect(puntsAmbPrecaucio(cataleg)).toHaveLength(28)
  })

  it('«D\'acord» la deixa igual però confirmada; «Canviar» la reescriu', () => {
    const li4 = cataleg.punts.find((p) => p.codi === 'LI4')!
    const c = ambPrecaucions(cataleg, [
      { codi: 'LI4', embaras: li4.precaucions.embaras, nota: li4.precaucions.nota },
      { codi: 'ST9', embaras: false, nota: 'Palpar la caròtida i apartar-la amb el dit.' },
    ])
    expect(c.punts.find((p) => p.codi === 'LI4')!.precaucions).toEqual({ ...li4.precaucions, confirmada: true })
    expect(c.punts.find((p) => p.codi === 'ST9')!.precaucions).toEqual({
      embaras: false,
      nota: 'Palpar la caròtida i apartar-la amb el dit.',
      confirmada: true,
    })
    expect(c.punts.find((p) => p.codi === 'ST1')!.precaucions.confirmada).toBe(false)
    // el catàleg original no canvia
    expect(cataleg.punts.find((p) => p.codi === 'ST9')!.precaucions.confirmada).toBe(false)
  })
})
