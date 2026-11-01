import { describe, expect, it } from 'vitest'
import { cercarPuntsOrella, posicioOrella, PUNTS_ORELLA, puntOrella } from './cataleg'
import { CONTORN, dinsPoligon, dinsZona, distanciaVora, POLIGONS, ZONES_ORELLA, type ZonaOrella } from './dibuix'

const p = (codi: string) => {
  const q = puntOrella(codi)
  if (!q) throw new Error(`Falta ${codi}`)
  return q
}

describe('punts de l\'orella (GB/T 13734-2008, cara lateral)', () => {
  it('són els 84 de la cara lateral, sense codis repetits', () => {
    expect(PUNTS_ORELLA).toHaveLength(84)
    expect(new Set(PUNTS_ORELLA.map((x) => x.codi)).size).toBe(84)
    const perZona = Object.fromEntries(ZONES_ORELLA.map((z) => [z, PUNTS_ORELLA.filter((x) => x.zona === z).length]))
    expect(perZona).toEqual({ HX: 13, SF: 6, AH: 14, TF: 5, TG: 9, AT: 8, CO: 21, LO: 8 })
  })

  it('cada codi comença per la seva zona', () => {
    for (const q of PUNTS_ORELLA) expect(q.codi.startsWith(q.zona), q.codi).toBe(true)
  })

  it('té els noms de l\'estàndard (alguns de referència)', () => {
    expect(p('TF4')).toMatchObject({ nom: 'Shenmen', pinyin: 'Shenmen', hanzi: '神门' })
    expect(p('HX6,7i')).toMatchObject({ pinyin: 'Erjian', hanzi: '耳尖' })
    expect(p('CO15')).toMatchObject({ nom: 'Cor', hanzi: '心' })
    expect(p('AH6a')).toMatchObject({ nom: 'Simpàtic', hanzi: '交感' })
    expect(p('TG2p')).toMatchObject({ nom: 'Glàndula suprarenal', hanzi: '肾上腺' })
    expect(p('AT3,4i')).toMatchObject({ pinyin: 'Naogan', hanzi: '脑干' })
    expect(p('CO18')).toMatchObject({ nom: 'Endocrí', hanzi: '内分泌' })
    // Noms nous de l'estàndard del 2008
    for (const codi of ['HX6', 'HX7', 'TG1', 'TG2', 'TG2l', 'AT1l', 'AT3,4i']) expect(puntOrella(codi), codi).toBeDefined()
  })

  it('cada punt és dins la seva zona i no a tocar de la vora (es veu de quina és)', () => {
    for (const q of PUNTS_ORELLA) {
      expect(dinsZona([q.x, q.y], q.zona), `${q.codi} dins ${q.zona}`).toBe(true)
      const vora = Math.max(...POLIGONS[q.zona].filter((pol) => dinsPoligon([q.x, q.y], pol)).map((pol) => distanciaVora([q.x, q.y], pol)))
      expect(vora, `${q.codi} massa a prop de la vora`).toBeGreaterThan(2.5)
      // i en cap altra zona
      for (const z of ZONES_ORELLA.filter((x) => x !== q.zona)) expect(dinsZona([q.x, q.y], z), `${q.codi} també a ${z}`).toBe(false)
    }
  })

  it('les zones són dins el contorn de l\'orella i no se superposen', () => {
    for (const z of ZONES_ORELLA)
      for (const pol of POLIGONS[z])
        for (const v of pol) expect(dinsPoligon(v, CONTORN) || distanciaVora(v, CONTORN) < 1, `${z} ${v}`).toBe(true)
    // un mostreig del dibuix: cap punt és a dues zones
    for (let x = 60; x <= 290; x += 4)
      for (let y = 10; y <= 445; y += 4) {
        const zones = ZONES_ORELLA.filter((z) => dinsZona([x, y], z))
        expect(zones.length, `${x},${y}: ${zones.join(' ')}`).toBeLessThanOrEqual(1)
      }
  })

  it('dos punts no se superposen al dibuix', () => {
    for (const a of PUNTS_ORELLA)
      for (const b of PUNTS_ORELLA)
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.codi} i ${b.codi}`).toBeGreaterThan(9)
  })
})

describe('ordre dels punts dins de cada zona', () => {
  const y = (codi: string) => p(codi).y
  const x = (codi: string) => p(codi).x
  const baixen = (codis: string[]) => codis.every((c, i) => i === 0 || y(c) > y(codis[i - 1]!))

  it('hèlix: HX2 → HX4 pugen per davant; l\'àpex és el punt més alt; HX9 → HX12 baixen per darrere', () => {
    expect(baixen(['HX4', 'HX3', 'HX2'])).toBe(true)
    expect(y('HX5')).toBeLessThan(y('HX4'))
    const alts = PUNTS_ORELLA.filter((q) => q.zona === 'HX').sort((a, b) => a.y - b.y)
    expect(alts[0]!.codi).toBe('HX6,7i')
    expect(x('HX6')).toBeLessThan(x('HX6,7i'))
    expect(x('HX7')).toBeGreaterThan(x('HX6,7i'))
    expect(baixen(['HX8', 'HX9', 'HX10', 'HX11', 'HX12'])).toBe(true)
  })

  it('escafa: dits, canell, colze, espatlla i clavícula, de dalt a baix', () => {
    expect(baixen(['SF1', 'SF1,2i', 'SF2', 'SF3', 'SF4,5', 'SF6'])).toBe(true)
  })

  it('antihèlix: el peu a dalt de l\'arrel superior; la columna per darrere de les vísceres', () => {
    expect(baixen(['AH2', 'AH3', 'AH4', 'AH5'])).toBe(true)
    expect(x('AH1')).toBeLessThan(x('AH2'))
    // arrel inferior: el simpàtic a la punta, després el ciàtic i la natja
    expect(x('AH6a')).toBeLessThan(x('AH6'))
    expect(x('AH6')).toBeLessThan(x('AH7'))
    // cos: abdomen, tòrax i coll baixant; cada víscera més a prop de la conca que la seva vertebra
    expect(baixen(['AH8', 'AH10', 'AH12'])).toBe(true)
    expect(baixen(['AH9', 'AH11', 'AH13'])).toBe(true)
    for (const [viscera, columna] of [['AH8', 'AH9'], ['AH10', 'AH11'], ['AH12', 'AH13']]) expect(x(viscera!)).toBeLessThan(x(columna!))
  })

  it('fossa triangular: de davant a darrere TF1/TF2, TF3 i TF4/TF5', () => {
    expect(x('TF1')).toBeLessThan(x('TF3'))
    expect(x('TF3')).toBeLessThan(x('TF4'))
    expect(y('TF1')).toBeLessThan(y('TF2'))
    expect(y('TF4')).toBeLessThan(y('TF5'))
  })

  it('tragus: superior a dalt, inferior a baix; els punts de la cara interna, a la vora lliure', () => {
    expect(y('TG1')).toBeLessThan(y('TG2'))
    expect(y('TG1p')).toBeLessThan(y('TG2p'))
    expect(y('TG3')).toBeLessThan(y('TG4'))
    for (const codi of ['TG3', 'TG4', 'AT4']) expect(p(codi).caraInterna, codi).toBe(true)
    expect(x('TG3')).toBeGreaterThan(x('TG1'))
  })

  it('antitragus: front, temple i occipital de davant a darrere; el tronc de l\'encèfal a l\'escotadura', () => {
    expect(x('AT1')).toBeLessThan(x('AT2'))
    expect(x('AT2')).toBeLessThan(x('AT3'))
    expect(x('AT3,4i')).toBeGreaterThan(x('AT2,3,4i'))
    expect(x('AT2,3,4i')).toBeGreaterThan(x('AT1,2,4i'))
  })

  it('conca: boca, esòfag i càrdies sota la rel de l\'hèlix; intestí gros, prim i duodè per sobre', () => {
    expect(x('CO1')).toBeLessThan(x('CO2'))
    expect(x('CO2')).toBeLessThan(x('CO3'))
    expect(x('CO7')).toBeLessThan(x('CO6'))
    expect(x('CO6')).toBeLessThan(x('CO5'))
    for (const codi of ['CO1', 'CO2', 'CO3']) expect(y(codi)).toBeGreaterThan(y('HX1'))
    for (const codi of ['CO5', 'CO6', 'CO7', 'CO8', 'CO9', 'CO10', 'CO11']) expect(y(codi), codi).toBeLessThan(y('CO1'))
    expect(x('CO8')).toBeLessThan(x('CO9'))
    expect(x('CO9')).toBeLessThan(x('CO10'))
    // cor al centre de la cavitat, l'endocrí al fons
    expect(y('CO18')).toBeGreaterThan(y('CO17'))
    expect(y('CO17')).toBeGreaterThan(y('CO15'))
  })

  it('lòbul: tres files de tres, de davant a darrere', () => {
    expect(x('LO1')).toBeLessThan(x('LO2'))
    expect(x('LO2')).toBeLessThan(x('LO3'))
    expect(x('LO4')).toBeLessThan(x('LO5'))
    expect(x('LO5')).toBeLessThan(x('LO5,6i'))
    expect(x('LO5,6i')).toBeLessThan(x('LO6'))
    expect(baixen(['LO2', 'LO5', 'LO7,8,9'])).toBe(true)
  })
})

describe('cerca i correccions', () => {
  it('troba per codi, nom català o pinyin, sense accents ni comes', () => {
    expect(cercarPuntsOrella('tf4')[0]!.codi).toBe('TF4')
    expect(cercarPuntsOrella('shenmen')[0]!.codi).toBe('TF4')
    expect(cercarPuntsOrella('HX6,7i')[0]!.codi).toBe('HX6,7i')
    expect(cercarPuntsOrella('hx67i')[0]!.codi).toBe('HX6,7i')
    expect(cercarPuntsOrella('endocri')[0]!.codi).toBe('CO18')
    expect(cercarPuntsOrella('melsa').map((q) => q.codi)).toEqual(['CO13'])
    expect(cercarPuntsOrella(' ')).toEqual([])
  })

  it('la posició corregida per la doctora substitueix la de l\'estàndard', () => {
    const tf4 = p('TF4')
    expect(posicioOrella(tf4, new Map())).toEqual({ x: tf4.x, y: tf4.y, corregit: false })
    expect(posicioOrella(tf4, new Map([['TF4', { x: 1, y: 2 }]]))).toEqual({ x: 1, y: 2, corregit: true })
  })

  it('totes les zones tenen nom i polígon', () => {
    for (const z of ZONES_ORELLA as readonly ZonaOrella[]) expect(POLIGONS[z].length).toBeGreaterThan(0)
  })
})
