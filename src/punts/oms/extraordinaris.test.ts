// @vitest-environment node
// Punts extraordinaris de l'OMS sobre el cos definitiu: cada un respecte de
// la seva referència (punt d'un meridià, articulació o vertebra), en cun.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { modelDesDeGlb } from '../../mapa/model'
import { calcularPunts, clauCalcul, type ResultatCalcul } from './calcular'
import type { Costat, DadesMakeHuman } from './cos'
import { nivellVertebra } from './eines'
import { VERTEBRES_JIAJI } from './meridians/extraordinaris'
import { REGLES } from './regles'

let calcul: ResultatCalcul
let dades: DadesMakeHuman

beforeAll(async () => {
  const glb = readFileSync(resolve('public/models/cos.glb'))
  const model = await modelDesDeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength))
  dades = JSON.parse(readFileSync(resolve('src/punts/articulacions.json'), 'utf8'))
  calcul = calcularPunts(model, dades)
}, 30_000)

const COSTATS: Costat[] = ['E', 'D']
const p = (codi: string, costat: Costat | 'C', index = 0): Vector3 => {
  const r = calcul.perId.get(clauCalcul(codi, costat, index)) ?? calcul.perId.get(clauCalcul(codi, 'C', index))
  if (!r) throw new Error(`Falta ${codi} ${costat} ${index}`)
  return r.punt
}
const r = () => calcul.referencies
const art = (nom: string, k: Costat) => new Vector3(...dades.articulacions[`${k === 'E' ? 'l' : 'r'}-${nom}`]!)
const EX = () => REGLES.filter((d) => d.codi.startsWith('EX-'))

describe('extraordinaris: cap i coll', () => {
  it('Sishencong (EX-HN1): quatre punts a 1 cun de GV20, al davant, al darrere i a cada costat', () => {
    const gv20 = p('GV20', 'C')
    const [davant, darrere, esquerra, dreta] = [0, 1, 2, 3].map((i) => p('EX-HN1', 'C', i))
    // Per darrere de GV20, el cun és el posterior del cap (GV20–C7 = 10 cun)
    const unitats = [r().cun.cap, r().cun.capPosterior, r().cun.cap, r().cun.cap]
    ;[davant, darrere, esquerra, dreta].forEach((q, i) => {
      const cun = q!.distanceTo(gv20) / unitats[i]!
      expect(cun, `subpunt ${i}`).toBeGreaterThan(0.75)
      expect(cun, `subpunt ${i}`).toBeLessThan(1.05)
    })
    expect(davant!.z).toBeGreaterThan(gv20.z)
    expect(darrere!.z).toBeLessThan(gv20.z)
    expect(esquerra!.x).toBeGreaterThan(0.01)
    expect(dreta!.x).toBeLessThan(-0.01)
    expect(Math.abs(davant!.x) + Math.abs(darrere!.x)).toBeLessThan(0.004)
  })

  it('Yintang (EX-HN3) és a la línia mitja, entre els extrems interns de les celles (BL2)', () => {
    const y = p('EX-HN3', 'C')
    expect(Math.abs(y.x)).toBeLessThan(0.003)
    expect(Math.abs(y.y - p('BL2', 'E').y)).toBeLessThan(0.005)
  })

  it('Dangyang (EX-HN2) sobre la pupil·la, entre GB15 i GB16; Yuyao (EX-HN4) a la cella, sota GB14', () => {
    for (const k of COSTATS) {
      expect(p('EX-HN2', k).y).toBeGreaterThan(p('GB15', k).y)
      expect(p('EX-HN2', k).z).toBeLessThan(p('GB15', k).z)
      expect(p('EX-HN2', k).z).toBeGreaterThan(p('GB16', k).z)
      expect(Math.abs(Math.abs(p('EX-HN2', k).x) - Math.abs(p('GB15', k).x))).toBeLessThan(0.01)
      const yuyao = p('EX-HN4', k)
      expect((p('GB14', k).y - yuyao.y) / r().cun.cap).toBeGreaterThan(0.8)
      expect((p('GB14', k).y - yuyao.y) / r().cun.cap).toBeLessThan(1.5)
      expect(Math.abs(Math.abs(yuyao.x) - Math.abs(r()[k].ull.x))).toBeLessThan(0.006)
      expect(yuyao.y).toBeGreaterThan(r()[k].cantExtern.y)
    }
  })

  it('Taiyang (EX-HN5) és a la templa: darrere del cantó extern i de TE23, i més a fora', () => {
    for (const k of COSTATS) {
      const t = p('EX-HN5', k)
      expect(t.z).toBeLessThan(p('TE23', k).z - 0.008)
      expect(Math.abs(t.x)).toBeGreaterThan(Math.abs(r()[k].cantExtern.x))
      expect(t.z).toBeGreaterThan(r()[k].tragus.z)
    }
  })

  it('Erjian (EX-HN6) a la punta de l\'orella, sota TE20', () => {
    for (const k of COSTATS) {
      expect(p('EX-HN6', k).distanceTo(r()[k].orellaApex)).toBeLessThan(0.005)
      expect(p('EX-HN6', k).y).toBeLessThan(p('TE20', k).y)
    }
  })

  it('Qiuhou (EX-HN7) a la vora infraorbitària, més a fora que ST1', () => {
    for (const k of COSTATS) {
      expect(Math.abs(p('EX-HN7', k).y - p('ST1', k).y)).toBeLessThan(0.006)
      expect(Math.abs(p('EX-HN7', k).x)).toBeGreaterThan(Math.abs(p('ST1', k).x))
    }
  })

  it('Shangyingxiang (EX-HN8) i Neiyingxiang (EX-HN9) són al costat del nas, per sobre de LI20 i a la narina', () => {
    for (const k of COSTATS) {
      const s = p('EX-HN8', k)
      expect(s.y).toBeGreaterThan(p('LI20', k).y)
      expect(Math.abs(s.x)).toBeLessThan(Math.abs(p('LI20', k).x) + 0.003)
      expect(s.distanceTo(r().nas)).toBeLessThan(0.04)
      const n = p('EX-HN9', k)
      expect(n.y).toBeLessThan(r().nas.y)
      expect(n.y).toBeGreaterThan(r().nivellBoca)
      expect(n.distanceTo(r().nas)).toBeLessThan(0.03)
    }
  })

  it('els punts de dins la boca (EX-HN10 a 13) es marquen als llavis: Jinjin a l\'esquerra i Yuye a la dreta', () => {
    for (const codi of ['EX-HN10', 'EX-HN11', 'EX-HN12', 'EX-HN13']) {
      expect(Math.abs(p(codi, 'C').y - r().nivellBoca), codi).toBeLessThan(0.01)
      expect(p(codi, 'C').z, codi).toBeGreaterThan(0.1)
    }
    expect(p('EX-HN12', 'C').x).toBeGreaterThan(0.004)
    expect(p('EX-HN13', 'C').x).toBeLessThan(-0.004)
  })

  it('Yiming (EX-HN14) 1 cun per darrere de TE17; Jingbailao (EX-HN15) 2 cun per sobre de GV14 i 1 cun a fora', () => {
    for (const k of COSTATS) {
      const y = p('EX-HN14', k)
      expect(y.z).toBeLessThan(p('TE17', k).z)
      expect(Math.abs(y.y - p('TE17', k).y)).toBeLessThan(0.008)
      const cun = y.distanceTo(p('TE17', k)) / r().cun.cap
      expect(cun).toBeGreaterThan(0.6)
      expect(cun).toBeLessThan(1.4)
      const j = p('EX-HN15', k)
      expect((j.y - p('GV14', 'C').y) / r().cun.capPosterior).toBeCloseTo(2, 0)
      expect(Math.abs(j.x) / r().cun.pit).toBeCloseTo(1, 0)
      expect(j.z).toBeLessThan(0)
    }
  })
})

describe('extraordinaris: tronc i esquena', () => {
  it('Jiaji (EX-B2): 17 punts per costat, de T1 a L5, 0,5 cun a fora de la línia mitja i baixant', () => {
    expect(VERTEBRES_JIAJI).toHaveLength(17)
    for (const k of COSTATS) {
      VERTEBRES_JIAJI.forEach((vert, i) => {
        const q = p('EX-B2', k, i)
        expect(Math.abs(q.y - nivellVertebra(r(), vert, true)), `${vert} ${k}`).toBeLessThan(0.008)
        expect(Math.abs(q.x) / r().cun.pit, `${vert} ${k}`).toBeCloseTo(0.5, 0)
        expect(q.z, `${vert} ${k}`).toBeLessThan(0)
        if (i > 0) expect(q.y, `${vert} ${k}`).toBeLessThan(p('EX-B2', k, i - 1).y)
      })
    }
  })

  it('Jiaji queda entre la línia mitja (GV) i la primera línia de BL', () => {
    for (const k of COSTATS) {
      const t5 = p('EX-B2', k, 4)
      expect(Math.abs(t5.x)).toBeLessThan(Math.abs(p('BL15', k).x))
      expect(Math.abs(t5.x)).toBeGreaterThan(Math.abs(p('GV11', 'C').x) + 0.005)
    }
  })

  it('Xiajishu (EX-B5) i Shiqizhui (EX-B8) a la línia mitja, sota L3 i L5; Yaoqi (EX-B9) per sobre de GV1', () => {
    expect(Math.abs(p('EX-B5', 'C').y - nivellVertebra(r(), 'L3', true))).toBeLessThan(0.008)
    expect(Math.abs(p('EX-B8', 'C').y - nivellVertebra(r(), 'L5', true))).toBeLessThan(0.008)
    expect(p('EX-B9', 'C').y).toBeGreaterThan(p('GV1', 'C').y)
    expect(p('EX-B9', 'C').y).toBeLessThan(p('EX-B8', 'C').y)
  })

  it('Yaoyan (EX-B7) més a fora que Yaoyi (EX-B6), tots dos a l\'altura de L4', () => {
    for (const k of COSTATS) expect(Math.abs(p('EX-B7', k).x)).toBeGreaterThan(Math.abs(p('EX-B6', k).x))
  })

  it('Zigong (EX-CA1) més a fora que ST29, a la mateixa alçada', () => {
    for (const k of COSTATS) {
      expect(Math.abs(p('EX-CA1', k).y - p('ST29', k).y)).toBeLessThan(0.008)
      expect(Math.abs(p('EX-CA1', k).x)).toBeGreaterThan(Math.abs(p('ST29', k).x))
    }
  })
})

describe('extraordinaris: braç i mà', () => {
  it('Zhoujian (EX-UE1) a la punta del colze, per sota de TE10', () => {
    for (const k of COSTATS) {
      expect(p('EX-UE1', k).distanceTo(r()[k].colze)).toBeLessThan(0.05)
      expect(p('EX-UE1', k).distanceTo(p('TE10', k))).toBeLessThan(0.04)
    }
  })

  it('Erbai (EX-UE2): dos punts a 4 cun del canell, a prop de la línia de PC i separats entre ells', () => {
    for (const k of COSTATS) {
      const [a, b] = [p('EX-UE2', k, 0), p('EX-UE2', k, 1)]
      expect(a.distanceTo(b)).toBeGreaterThan(0.006)
      expect(a.distanceTo(b)).toBeLessThan(0.03)
      for (const q of [a, b]) expect(q.distanceTo(p('PC4', k))).toBeLessThan(0.03)
    }
  })

  it('Zhongquan (EX-UE3) al canell, entre LI5 i TE4', () => {
    for (const k of COSTATS) {
      const z = p('EX-UE3', k)
      expect(z.distanceTo(p('LI5', k))).toBeLessThan(p('LI5', k).distanceTo(p('TE4', k)) + 0.005)
      expect(z.distanceTo(p('TE4', k))).toBeLessThan(p('LI5', k).distanceTo(p('TE4', k)) + 0.005)
    }
  })

  it('els punts dels dits són sobre la seva articulació, pel costat que toca', () => {
    for (const k of COSTATS) {
      const dorsal = r()[k].dorsal
      for (const [codi, nom] of [['EX-UE4', 'finger-3-2'], ['EX-UE6', 'finger-5-2']] as const) {
        const d = p(codi, k).clone().sub(art(nom, k))
        expect(d.length(), codi).toBeLessThan(0.018)
        expect(d.dot(dorsal), codi).toBeGreaterThan(0)
      }
      // el polze és més gruixut
      expect(p('EX-UE5', k).distanceTo(art('finger-1-3', k))).toBeLessThan(0.018)
      for (let i = 0; i < 4; i++) {
        const d = p('EX-UE10', k, i).clone().sub(art(`finger-${i + 2}-2`, k))
        expect(d.length()).toBeLessThan(0.018)
        expect(d.dot(r()[k].palmar)).toBeGreaterThan(0)
      }
    }
  })

  it('Shixuan (EX-UE11) a la punta de cada dit; Baxie (EX-UE9) entre els dits, al dors', () => {
    for (const k of COSTATS) {
      for (let i = 0; i < 5; i++) expect(p('EX-UE11', k, i).distanceTo(art(`finger-${i + 1}-4`, k))).toBeLessThan(0.018)
      for (let i = 1; i < 4; i++) {
        const entre = art(`finger-${i + 1}-1`, k).lerp(art(`finger-${i + 2}-1`, k), 0.5)
        expect(p('EX-UE9', k, i).distanceTo(entre)).toBeLessThan(0.03)
      }
      // Yaotongdian i Wailaogong, al dors de la mà
      for (const q of [p('EX-UE7', k, 0), p('EX-UE7', k, 1), p('EX-UE8', k)])
        expect(q.clone().sub(r()[k].canell).dot(r()[k].dorsal)).toBeGreaterThan(0)
    }
  })
})

describe('extraordinaris: cama i peu', () => {
  it('Kuangu (EX-LE1): dos punts a l\'alçada de ST34, un a fora i un a dins, a ~1,5 cun', () => {
    for (const k of COSTATS) {
      const st34 = p('ST34', k)
      const [fora, dins] = [p('EX-LE1', k, 0), p('EX-LE1', k, 1)]
      expect(Math.abs(fora.x)).toBeGreaterThan(Math.abs(st34.x))
      expect(Math.abs(dins.x)).toBeLessThan(Math.abs(st34.x))
      for (const q of [fora, dins]) {
        expect(Math.abs(q.y - st34.y)).toBeLessThan(0.008)
        const cun = q.distanceTo(st34) / r().cun.cuixa
        // en línia recta, una mica menys que l'1,5 cun mesurat sobre la pell
        expect(cun).toBeGreaterThan(1.2)
        expect(cun).toBeLessThan(1.51)
      }
    }
  })

  it('Heding (EX-LE2) per sobre de la ròtula; Baichongwo (EX-LE3) 1 cun per sobre de SP10', () => {
    for (const k of COSTATS) {
      expect(p('EX-LE2', k).y).toBeGreaterThan(r()[k].basePatella.y)
      expect(p('EX-LE2', k).y).toBeLessThan(p('ST34', k).y)
      expect((p('EX-LE3', k).y - p('SP10', k).y) / r().cun.cuixa).toBeCloseTo(1, 0)
    }
  })

  it('Neixiyan (EX-LE4) és el mirall de ST35 respecte del lligament rotulià; Xiyan (EX-LE5) són tots dos', () => {
    for (const k of COSTATS) {
      expect(Math.abs(p('EX-LE4', k).y - p('ST35', k).y)).toBeLessThan(0.01)
      expect(Math.abs(p('EX-LE4', k).x)).toBeLessThan(Math.abs(p('ST35', k).x))
      expect(p('EX-LE5', k, 0).distanceTo(p('EX-LE4', k))).toBeLessThan(0.001)
      expect(p('EX-LE5', k, 1).distanceTo(p('ST35', k))).toBeLessThan(0.001)
    }
  })

  it('Dannang (EX-LE6) 2 cun per sota de GB34; Lanwei (EX-LE7) 2 cun per sota de ST36', () => {
    for (const k of COSTATS) {
      expect((p('GB34', k).y - p('EX-LE6', k).y) / r().cun.cama).toBeCloseTo(2, 0)
      expect((p('ST36', k).y - p('EX-LE7', k).y) / r().cun.cama).toBeCloseTo(2, 0)
    }
  })

  it('els mal·lèols (EX-LE8 i 9) i els punts del peu (EX-LE10 a 12)', () => {
    for (const k of COSTATS) {
      expect(p('EX-LE8', k).distanceTo(r()[k].malleolIntern)).toBeLessThan(0.005)
      expect(p('EX-LE9', k).distanceTo(r()[k].malleolExtern)).toBeLessThan(0.005)
      // Bafeng: al dors del peu, entre els artells dels dits
      for (let i = 0; i < 4; i++) {
        const entre = art(`toe-${i + 1}-1`, k).lerp(art(`toe-${i + 2}-1`, k), 0.5)
        expect(p('EX-LE10', k, i).distanceTo(entre), `Bafeng ${i}`).toBeLessThan(0.03)
        // a dalt (al dors), no a la planta: el peu del model és prim i els artells hi queden a tocar
        expect(p('EX-LE10', k, i).y, `Bafeng ${i}`).toBeGreaterThan(entre.y - 0.005)
        expect(p('EX-LE10', k, i).y, `Bafeng ${i}`).toBeGreaterThan(p('EX-LE11', k).y + 0.01)
      }
      // Duyin: a la planta del 2n dit
      expect(p('EX-LE11', k).y).toBeLessThan(art('toe-2-3', k).y)
      // Qiduan: a la punta de cada dit
      expect(p('EX-LE12', k, 0).distanceTo(art('toe-1-3', k))).toBeLessThan(0.02)
      for (let i = 1; i < 5; i++) expect(p('EX-LE12', k, i).distanceTo(art(`toe-${i + 1}-4`, k))).toBeLessThan(0.02)
    }
  })
})

describe('extraordinaris: simetria', () => {
  it('cada subpunt esquerre és el mirall del dret (±3 mm)', () => {
    for (const def of EX().filter((d) => !d.mitja)) {
      for (let i = 0; i < (def.subpunts?.length ?? 1); i++) {
        const e = p(def.codi, 'E', i)
        const d = p(def.codi, 'D', i)
        expect(e.x, `${def.codi} ${i} a l'esquerra`).toBeGreaterThan(0.004)
        expect(e.distanceTo(new Vector3(-d.x, d.y, d.z)), `${def.codi} ${i}`).toBeLessThan(0.003)
      }
    }
  })
})
