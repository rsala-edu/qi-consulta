import { describe, expect, it } from 'vitest'
import {
  ambCalibratge,
  ambPrecaucions,
  cataleg,
  cercarPunts,
  exportarCataleg,
  nomMeridia,
  ordenarCategories,
  posicioDe,
  puntsAmbPrecaucio,
  puntsDeCategoria,
  REVISIO_BUIDA,
} from './cataleg'
import { esquemaCataleg, type Posicio3D } from './esquema'

describe('catàleg del projecte', () => {
  it('té els 14 meridians amb els 361 punts clàssics i els 48 extraordinaris', () => {
    expect(cataleg.meridians.map((m) => [m.codi, m.punts, m.bilateral])).toEqual([
      ['LU', 11, true],
      ['LI', 20, true],
      ['ST', 45, true],
      ['SP', 21, true],
      ['HT', 9, true],
      ['SI', 19, true],
      ['BL', 67, true],
      ['KI', 27, true],
      ['PC', 9, true],
      ['TE', 23, true],
      ['GB', 44, true],
      ['LR', 14, true],
      ['CV', 24, false],
      ['GV', 28, false],
      ['EX', 48, true],
    ])
    expect(cataleg.punts).toHaveLength(361 + 48)
    for (const m of cataleg.meridians.filter((x) => x.codi !== 'EX')) {
      const punts = cataleg.punts.filter((p) => p.meridia === m.codi)
      expect(punts.map((p) => p.numero)).toEqual(Array.from({ length: m.punts }, (_, i) => i + 1))
    }
    // Extraordinaris: cada regió numerada des d'1 (HN 15, CA 1, B 9, UE 11, LE 12)
    for (const [regio, n] of [['HN', 15], ['CA', 1], ['B', 9], ['UE', 11], ['LE', 12]] as const) {
      const codis = cataleg.punts.filter((p) => p.codi.startsWith(`EX-${regio}`)).map((p) => p.codi)
      expect(codis).toEqual(Array.from({ length: n }, (_, i) => `EX-${regio}${i + 1}`))
    }
    // Sense línia de meridià
    expect(cataleg.meridians.find((m) => m.codi === 'EX')!.recorregut).toEqual([])
  })

  it('té codi, pinyin i hanzi a tots els punts', () => {
    for (const p of cataleg.punts) {
      expect(p.pinyin).toMatch(/^[A-Z][a-z]+$/)
      expect(p.hanzi).toMatch(/^\p{Script=Han}{2,4}$/u)
    }
    expect(cataleg.punts.find((p) => p.codi === 'LI4')).toMatchObject({
      pinyin: 'Hegu',
      hanzi: '合谷',
    })
    expect(cataleg.punts.find((p) => p.codi === 'ST36')).toMatchObject({
      pinyin: 'Zusanli',
      hanzi: '足三里',
    })
  })

  it("cada punt té posició als dos costats sobre el cos definitiu, calculada amb la regla de l'OMS", () => {
    for (const p of cataleg.punts) {
      const mh = p.posicions.filter((q) => q.topologia.startsWith('mh-'))
      const bilateral = cataleg.meridians.find((m) => m.codi === p.meridia)!.bilateral && !p.mitja
      const n = p.subpunts?.length ?? 1
      const esperat = (bilateral ? ['D', 'E'] : ['C']).flatMap((k) => Array.from({ length: n }, (_, i) => `${k}${i}`))
      expect(mh.map((q) => `${q.costat}${q.index ?? 0}`).sort(), p.codi).toEqual(esperat.sort())
      expect(
        mh.every((q) => q.origen === 'oms' || q.origen === 'doctora'),
        p.codi,
      ).toBe(true)
      expect(p.orella).toBeNull()
    }
  })

  it('cada punt té la localització redactada; el nom català i la revisió queden per a la doctora', () => {
    for (const p of cataleg.punts) {
      expect(p.localitzacio.length, p.codi).toBeGreaterThan(15)
      expect(p.localitzacio.endsWith('.'), p.codi).toBe(true)
      expect(p.nomCatala).toBe('')
      expect(p.revisat).toBe(false)
    }
  })

  it('té una llista de precaucions pendents de confirmar', () => {
    const amb = cataleg.punts.filter((p) => p.precaucions.nota !== '')
    expect(amb.length).toBeGreaterThan(10)
    expect(amb.every((p) => p.precaucions.nota.endsWith('.'))).toBe(true)
    // cada precaució té categoria, i cada punt amb categoria té text
    for (const p of cataleg.punts) expect(p.precaucions.nota !== '', p.codi).toBe(p.precaucions.categories.length > 0)
    expect(cataleg.punts.every((p) => !p.precaucions.confirmada)).toBe(true)
    expect(cataleg.punts.find((p) => p.codi === 'LI4')?.precaucions.categories).toEqual(['embaras'])
    expect(cataleg.punts.find((p) => p.codi === 'ST9')?.precaucions.nota).toMatch(/caròtida/)
  })

  it('dona el nom del meridià', () => {
    expect(nomMeridia(cataleg, 'ST')).toBe('Estómac')
  })
})

describe('validació del format', () => {
  const base = () => structuredClone(cataleg)
  const posicio: Posicio3D = {
    topologia: 'prova',
    costat: 'E',
    triangle: 12,
    b: [0.2, 0.3, 0.5],
    origen: 'manual',
  }

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

  it('troba els extraordinaris pel codi amb guionet o sense, i pel pinyin', () => {
    expect(codis('EX-HN3')[0]).toBe('EX-HN3')
    expect(codis('exhn3')[0]).toBe('EX-HN3')
    expect(codis('yintang')).toEqual(['EX-HN3'])
    expect(codis('jiaji')).toEqual(['EX-B2'])
  })

  it('una consulta buida no dona res', () => {
    expect(codis('  ')).toEqual([])
  })
})

describe('calibratge sobre el catàleg', () => {
  const pos = (costat: 'E' | 'D', triangle: number): Posicio3D => ({
    topologia: 'maniqui',
    costat,
    triangle,
    b: [1, 0, 0],
    origen: 'manual',
  })

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
    const maniqui = (c: typeof c2) =>
      c.punts.find((p) => p.codi === 'LI4')!.posicions.filter((q) => q.topologia === 'maniqui')
    expect(maniqui(c2).map((q) => q.costat)).toEqual(['D'])
    // Les posicions del cos definitiu i el catàleg original no canvien
    expect(c2.punts.find((p) => p.codi === 'LI4')!.posicions.filter((q) => q.topologia !== 'maniqui')).toHaveLength(2)
    expect(maniqui(cataleg)).toEqual([])
  })

  it('corregeix un sol subpunt sense tocar els altres', () => {
    const jiaji = (c: typeof cataleg) => c.punts.find((p) => p.codi === 'EX-B2')!
    const abans = jiaji(cataleg)
    const topo = abans.posicions[0]!.topologia
    const l3 = posicioDe(abans, topo, 'E', 14)!
    expect(l3.index).toBe(14)
    const nova = { ...l3, triangle: 1, b: [1, 0, 0] as [number, number, number], origen: 'doctora' as const }
    const c = ambCalibratge(cataleg, [{ codi: 'EX-B2', topologia: topo, costat: 'E', index: 14, posicio: nova }])
    expect(posicioDe(jiaji(c), topo, 'E', 14)).toEqual(nova)
    expect(posicioDe(jiaji(c), topo, 'E', 13)).toEqual(posicioDe(abans, topo, 'E', 13))
    expect(posicioDe(jiaji(c), topo, 'E')).toEqual(posicioDe(abans, topo, 'E'))
    expect(jiaji(c).posicions).toHaveLength(abans.posicions.length)
    expect(esquemaCataleg.safeParse(c).success).toBe(true)
  })

  it('no accepta un subpunt que no existeix', () => {
    const c = structuredClone(cataleg)
    const yintang = c.punts.find((p) => p.codi === 'EX-HN3')!
    yintang.posicions.push({ ...yintang.posicions[0]!, index: 3 })
    expect(esquemaCataleg.safeParse(c).success).toBe(false)
  })

  it('exporta un JSON vàlid que es pot tornar a carregar', () => {
    const c = ambCalibratge(cataleg, [{ codi: 'ST36', topologia: 'maniqui', costat: 'E', posicio: pos('E', 1) }])
    const json = exportarCataleg(c)
    expect(esquemaCataleg.parse(JSON.parse(json))).toEqual(c)
    expect(json.endsWith('\n')).toBe(true)
  })
})

describe('precaucions per categories', () => {
  it('tots els punts amb precaució en tenen alguna categoria', () => {
    expect(puntsAmbPrecaucio(cataleg).length).toBe(cataleg.punts.filter((p) => p.precaucions.nota !== '').length)
  })

  const de = (codi: string) => cataleg.punts.find((p) => p.codi === codi)!
  const cats = (codi: string) => de(codi).precaucions.categories

  it('els punts clàssics són a la seva categoria', () => {
    for (const c of ['LI4', 'SP6', 'BL31', 'BL32', 'BL33', 'BL34', 'BL60', 'BL67', 'GB21'])
      expect(cats(c), c).toContain('embaras')
    for (const c of ['ST9', 'LI18', 'SP11', 'LR12', 'BL40', 'KI3']) expect(cats(c), c).toContain('vasos')
    expect(puntsDeCategoria(cataleg, 'ull', REVISIO_BUIDA).map((p) => p.codi)).toEqual(['ST1', 'BL1', 'EX-HN4', 'EX-HN7'])
    expect(cats('EX-CA1')).toEqual(['embaras'])
    for (const c of ['EX-B2', 'EX-B3']) expect(cats(c), c).toContain('pulmo')
    for (const c of ['LU1', 'ST13', 'BL13', 'GB21', 'ST12']) expect(cats(c), c).toContain('pulmo')
    expect(
      puntsDeCategoria(cataleg, 'bulb', REVISIO_BUIDA)
        .map((p) => p.codi)
        .sort(),
    ).toEqual(['BL10', 'GB20', 'GV15', 'GV16'])
    expect(puntsDeCategoria(cataleg, 'noEsPunxa', REVISIO_BUIDA).map((p) => p.codi)).toEqual(['ST17', 'CV8'])
    for (const c of ['ST21', 'BL23', 'GB30', 'CV14']) expect(cats(c), c).toEqual(['profunditat'])
  })

  it("les categories van en l'ordre fix i sense repetir", () => {
    for (const p of cataleg.punts) expect(p.precaucions.categories).toEqual(ordenarCategories(p.precaucions.categories))
  })

  it('un punt queda confirmat quan totes les seves categories ho estan', () => {
    // GB21: embaràs i pulmó
    expect(cats('GB21')).toEqual(['embaras', 'pulmo'])
    const nomesEmbaras = ambPrecaucions(cataleg, {
      categories: ['embaras'],
      excepcions: [],
    })
    const pt = (c: typeof cataleg, codi: string) => c.punts.find((p) => p.codi === codi)!.precaucions
    expect(pt(nomesEmbaras, 'LI4').confirmada).toBe(true)
    expect(pt(nomesEmbaras, 'GB21').confirmada).toBe(false)
    expect(pt(nomesEmbaras, 'ST36').confirmada).toBe(false)
    const totes = ambPrecaucions(cataleg, {
      categories: ['embaras', 'pulmo'],
      excepcions: [],
    })
    expect(pt(totes, 'GB21').confirmada).toBe(true)
    // el catàleg original no canvia
    expect(pt(cataleg, 'LI4').confirmada).toBe(false)
  })

  it("una excepció canvia el text i les categories d'un punt i el deixa confirmat", () => {
    const revisio = {
      categories: [],
      excepcions: [
        {
          codi: 'ST9',
          categories: ['profunditat', 'vasos'] as const,
          nota: 'Palpar la caròtida i apartar-la amb el dit.',
        },
      ],
    }
    const c = ambPrecaucions(cataleg, revisio)
    expect(c.punts.find((p) => p.codi === 'ST9')!.precaucions).toEqual({
      categories: ['vasos', 'profunditat'],
      nota: 'Palpar la caròtida i apartar-la amb el dit.',
      confirmada: true,
    })
    // a la llista de la categoria hi surt tant si l'excepció l'hi afegeix…
    expect(puntsDeCategoria(cataleg, 'profunditat', revisio).map((p) => p.codi)).toContain('ST9')
    // …com si l'en treu (per poder desfer l'excepció)
    const fora = {
      categories: [],
      excepcions: [{ codi: 'LI4', categories: [], nota: '' }],
    }
    expect(puntsDeCategoria(cataleg, 'embaras', fora).map((p) => p.codi)).toContain('LI4')
    expect(ambPrecaucions(cataleg, fora).punts.find((p) => p.codi === 'LI4')!.precaucions.categories).toEqual([])
  })
})
