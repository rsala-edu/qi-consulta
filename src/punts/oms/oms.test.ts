// @vitest-environment node
// Comprovació automàtica dels punts calculats sobre el cos definitiu:
// regla de l'OMS (cun), simetria, ordre dins el meridià i referències.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Vector3 } from 'three'
import { beforeAll, describe, expect, it } from 'vitest'
import { normalTriangle } from '../../mapa/geometria/baricentriques'
import { modelDesDeGlb, type ModelCos } from '../../mapa/model'
import { cataleg } from '../cataleg'
import { calcularPunts, type ResultatCalcul } from './calcular'
import type { Costat, DadesMakeHuman } from './cos'
import { REGLES } from './regles'

let model: ModelCos
let calcul: ResultatCalcul
let dades: DadesMakeHuman

beforeAll(async () => {
  const glb = readFileSync(resolve('public/models/cos.glb'))
  model = await modelDesDeGlb(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength))
  dades = JSON.parse(readFileSync(resolve('src/punts/articulacions.json'), 'utf8'))
  calcul = calcularPunts(model, dades)
}, 30_000)

const COSTATS: Costat[] = ['E', 'D']
const p = (codi: string, costat: Costat): Vector3 => {
  const r = calcul.perId.get(`${codi}|${costat}`)
  if (!r) throw new Error(`Falta ${codi} ${costat}`)
  return r.punt
}
/** Valor d'una referència o d'un punt pel nom */
const ref = (nom: string, costat: Costat): Vector3 => p(nom, costat)

describe('cos definitiu', () => {
  it('és el cos de MakeHuman', () => {
    expect(model.definitiu).toBe(true)
    expect(model.topologia).toMatch(/^mh-13380v-26756t-/)
    const alcada = model.geometria.boundingBox!.max.y - model.geometria.boundingBox!.min.y
    expect(alcada).toBeGreaterThan(1.6)
    expect(alcada).toBeLessThan(1.8)
  })

  it('el catàleg està al dia: les posicions guardades són les calculades', () => {
    for (const punt of calcul.punts) {
      const desat = cataleg.punts
        .find((x) => x.codi === punt.codi)!
        .posicions.find((q) => q.topologia === model.topologia && q.costat === punt.costat)
      expect(desat, `${punt.codi} ${punt.costat}`).toBeDefined()
      if (desat!.origen === 'doctora') continue
      expect(desat).toMatchObject({ triangle: punt.posicio.triangle, origen: 'oms' })
      desat!.b.forEach((b, i) => expect(b).toBeCloseTo(punt.posicio.b[i]!, 5))
    }
  })

  it('tots els punts de LI i ST tenen regla i posició als dos costats', () => {
    const codis = cataleg.punts.filter((x) => ['LI', 'ST'].includes(x.meridia)).map((x) => x.codi)
    expect(REGLES.map((r) => r.codi).sort()).toEqual([...codis].sort())
    expect(calcul.punts).toHaveLength(codis.length * 2)
  })
})

describe('regla de l\'OMS de cada punt', () => {
  const r = () => calcul.referencies

  for (const def of REGLES) {
    const regla = def.regla
    if (regla.tipus === 'segment') {
      it(`${def.codi}: a ${regla.cun} de ${regla.total} cun de ${regla.de} cap a ${regla.a}`, () => {
        for (const k of COSTATS) {
          const de = ref(regla.de, k)
          const a = ref(regla.a, k)
          const punt = p(def.codi, k)
          const linia = a.clone().sub(de)
          const t = punt.clone().sub(de).dot(linia) / linia.lengthSq()
          expect(t, `${def.codi} ${k}`).toBeCloseTo(regla.cun / regla.total, 1)
          // No s'aparta més de 2,5 cm de la línia (la pell no és recta)
          const projeccio = de.clone().addScaledVector(linia, t)
          expect(punt.distanceTo(projeccio), `${def.codi} ${k} fora de la línia`).toBeLessThan(0.025)
        }
      })
    }
    if (regla.tipus === 'vertical') {
      it(`${def.codi}: ${regla.cun} cun respecte de ${regla.ref}${regla.lateral ? ` i ${regla.lateral} cun de la línia mitja` : ''}`, () => {
        for (const k of COSTATS) {
          const punt = p(def.codi, k)
          const base = regla.ref === 'melic' ? r().melic : r()[k].basePatella
          expect((punt.y - base.y) / r().cun[regla.unitat], `${def.codi} ${k}`).toBeCloseTo(regla.cun, 0)
          if (regla.lateral !== undefined)
            expect(Math.abs(punt.x) / r().cun.pit, `${def.codi} ${k}`).toBeCloseTo(regla.lateral, 0)
        }
      })
    }
    if (regla.tipus === 'nivell') {
      it(`${def.codi}: a la mateixa alçada que ${regla.com}`, () => {
        for (const k of COSTATS) expect(Math.abs(p(def.codi, k).y - p(regla.com, k).y)).toBeLessThan(0.008)
      })
    }
  }
})

describe('distàncies en cun', () => {
  const cun = () => calcul.referencies.cun
  const enCun = (a: Vector3, b: Vector3, unitat: number) => a.distanceTo(b) / unitat

  it('cama: ST36 a 3 cun de ST35 i ST39 a 9 cun', () => {
    for (const k of COSTATS) {
      expect((p('ST35', k).y - p('ST36', k).y) / cun().cama).toBeCloseTo(3, 0)
      expect((p('ST35', k).y - p('ST39', k).y) / cun().cama).toBeCloseTo(9, 0)
    }
  })

  it('avantbraç: LI10 a 2 cun de LI11 i LI5–LI11 fa 12 cun', () => {
    for (const k of COSTATS) {
      expect(enCun(p('LI10', k), p('LI11', k), cun().avantbrac)).toBeGreaterThan(1.4)
      expect(enCun(p('LI10', k), p('LI11', k), cun().avantbrac)).toBeLessThan(2.6)
      expect(enCun(p('LI5', k), p('LI11', k), cun().avantbrac)).toBeGreaterThan(10.5)
      expect(enCun(p('LI5', k), p('LI11', k), cun().avantbrac)).toBeLessThan(13.5)
    }
  })

  it('tòrax: el mugró (ST17) a 4 cun de la línia mitja; ST25 a 2 cun', () => {
    for (const k of COSTATS) {
      expect(Math.abs(p('ST17', k).x) / cun().pit).toBeCloseTo(4, 1)
      expect(Math.abs(p('ST25', k).x) / cun().pit).toBeCloseTo(2, 0)
    }
  })

  it('abdomen: ST30 a 5 cun per sota del melic, a l\'alçada de la símfisi', () => {
    for (const k of COSTATS) expect(Math.abs(p('ST30', k).y - calcul.referencies.simfisi.y)).toBeLessThan(0.01)
  })

  it('les unitats de cun són raonables per a un adult (1,5–3,2 cm)', () => {
    for (const [nom, valor] of Object.entries(cun())) {
      expect(valor, nom).toBeGreaterThan(0.015)
      expect(valor, nom).toBeLessThan(0.032)
    }
  })
})

describe('simetria', () => {
  it('cada punt esquerre és el mirall del dret (±3 mm)', () => {
    for (const def of REGLES) {
      const e = p(def.codi, 'E')
      const d = p(def.codi, 'D')
      expect(e.x, `${def.codi} ha de ser a l'esquerra (+X)`).toBeGreaterThan(0.004)
      expect(Math.abs(e.x + d.x), def.codi).toBeLessThan(0.003)
      expect(Math.abs(e.y - d.y), def.codi).toBeLessThan(0.003)
      expect(Math.abs(e.z - d.z), def.codi).toBeLessThan(0.003)
    }
  })
})

describe('ordre dins el meridià', () => {
  const baixen = (codis: string[], k: Costat) => codis.every((c, i) => i === 0 || p(c, k).y < p(codis[i - 1]!, k).y)

  it('LI puja del dit índex fins a l\'espatlla sense fer marrada', () => {
    for (const k of COSTATS) {
      const dist = Array.from({ length: 15 }, (_, i) => p(`LI${i + 1}`, k).distanceTo(p('LI1', k)))
      dist.forEach((d, i) => i > 0 && expect(d, `LI${i + 1} ${k}`).toBeGreaterThan(dist[i - 1]!))
    }
  })

  it('LI continua pel coll i acaba a la cara, al costat del nas', () => {
    for (const k of COSTATS) {
      const nas = calcul.referencies.nas
      expect(p('LI17', k).y).toBeLessThan(p('LI18', k).y)
      expect(p('LI18', k).y).toBeLessThan(p('LI19', k).y)
      expect(p('LI19', k).y).toBeLessThan(p('LI20', k).y)
      expect(p('LI20', k).distanceTo(nas)).toBeLessThan(0.04)
    }
  })

  it('ST baixa per la cara (ST1 → ST4)', () => {
    for (const k of COSTATS) expect(baixen(['ST1', 'ST2', 'ST3', 'ST4'], k)).toBe(true)
  })

  it('ST baixa pel tòrax i l\'abdomen (ST11 → ST30) i per la cama (ST31 → ST42)', () => {
    const tronc = ['ST12', 'ST13', 'ST14', 'ST15', 'ST16', 'ST17', 'ST18', ...Array.from({ length: 12 }, (_, i) => `ST${19 + i}`)]
    const cama = ['ST31', 'ST32', 'ST33', 'ST34', 'ST35', 'ST36', 'ST37', 'ST38', 'ST39', 'ST41', 'ST42']
    for (const k of COSTATS) {
      expect(baixen(tronc, k), `tronc ${k}`).toBe(true)
      expect(baixen(cama, k), `cama ${k}`).toBe(true)
    }
  })

  it('ST acaba al peu, cap a la punta del 2n dit (ST42 → ST45)', () => {
    for (const k of COSTATS) {
      const z = ['ST41', 'ST42', 'ST43', 'ST44', 'ST45'].map((c) => p(c, k).z)
      z.forEach((v, i) => i > 0 && expect(v).toBeGreaterThan(z[i - 1]!))
    }
  })
})

describe('referències de la cara i el tòrax', () => {
  const r = () => calcul.referencies
  const brut = (nom: string) => new Vector3(...(dades.referencies[nom] as [number, number, number]))

  it('ST17 és a menys de 5 mm del mugró detectat a la malla', () => {
    for (const k of COSTATS) {
      const mugroMakeHuman = brut(`${k === 'E' ? 'l' : 'r'}-mugro`)
      expect(p('ST17', k).distanceTo(r()[k].mugro), `ST17 ${k}`).toBeLessThan(0.005)
      // el mugró detectat (relleu més corbat) és dins la zona del pit que marca MakeHuman
      expect(r()[k].mugro.distanceTo(mugroMakeHuman), `mugró ${k}`).toBeLessThan(0.03)
      // i és on toca: a la meitat lateral del pit, entre la clavícula i el xifoide
      expect(Math.abs(r()[k].mugro.x)).toBeGreaterThan(0.08)
      expect(r()[k].mugro.y).toBeLessThan(r()[k].clavicula.y)
      expect(r()[k].mugro.y).toBeGreaterThan(r().unioXifoesternal.y)
    }
  })

  it('ST7 és davant del tragus, no damunt l\'orella', () => {
    for (const k of COSTATS) {
      const t = r()[k].tragus
      const st7 = p('ST7', k)
      expect(st7.z - t.z, `ST7 ${k} davant del tragus`).toBeGreaterThan(0.01)
      expect(st7.z - t.z).toBeLessThan(0.035)
      expect(Math.abs(st7.y - t.y)).toBeLessThan(0.01)
      expect(Math.abs(st7.x)).toBeGreaterThan(0.05)
    }
  })

  it('ST8 és a l\'angle del front, 0,5 cun dins la línia del cabell', () => {
    for (const k of COSTATS) {
      const st8 = p('ST8', k)
      expect((st8.y - r().nivellCabell) / r().cun.cap).toBeCloseTo(0.5, 0)
      // a l'angle: la pell mira a mig camí entre davant i el costat
      const pos = calcul.perId.get(`ST8|${k}`)!.posicio
      const n = normalTriangle(model.geometria, pos.triangle)
      const graus = (Math.atan2(Math.abs(n.x), n.z) * 180) / Math.PI
      expect(graus, `ST8 ${k}`).toBeGreaterThan(30)
      expect(graus, `ST8 ${k}`).toBeLessThan(60)
      // davant de l'orella
      expect(st8.z).toBeGreaterThan(r()[k].tragus.z)
    }
  })
})

describe('referències anatòmiques', () => {
  const r = () => calcul.referencies
  it('melic i símfisi a la línia mitja, en ordre, i el melic sota el xifoide', () => {
    expect(Math.abs(r().melic.x)).toBeLessThan(0.002)
    expect(r().unioXifoesternal.y).toBeGreaterThan(r().melic.y)
    expect(r().melic.y).toBeGreaterThan(r().simfisi.y)
    // Proporció habitual: melic cap al 60 % de l'alçada
    expect(r().melic.y / 1.66).toBeGreaterThan(0.57)
    expect(r().melic.y / 1.66).toBeLessThan(0.65)
  })

  it('els punts amb referència són a prop de la seva articulació', () => {
    for (const k of COSTATS) {
      const art = (n: string) => calcul.referencies[k][n as 'canell' | 'colze' | 'genoll' | 'turmell']
      expect(p('LI4', k).distanceTo(art('canell'))).toBeLessThan(0.07)
      expect(p('LI5', k).distanceTo(art('canell'))).toBeLessThan(0.04)
      expect(p('LI11', k).distanceTo(art('colze'))).toBeLessThan(0.05)
      expect(p('ST35', k).distanceTo(art('genoll'))).toBeLessThan(0.07)
      expect(p('ST41', k).distanceTo(art('turmell'))).toBeLessThan(0.07)
    }
  })

  it('els punts de la cara són a la cara (davant de les orelles) i els del tronc, a davant', () => {
    for (const k of COSTATS) {
      for (const c of ['ST1', 'ST2', 'ST3', 'ST4', 'LI19', 'LI20']) expect(p(c, k).z, c).toBeGreaterThan(0.11)
      for (let n = 13; n <= 30; n++) expect(p(`ST${n}`, k).z, `ST${n}`).toBeGreaterThan(0.06)
    }
  })
})
