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
import { cunCamaMedial, nivellVertebra } from './eines'
import { distanciaArcCap, puntArcCap } from './referencies'
import { ORDRES, REGLES } from './regles'

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
  const r = calcul.perId.get(`${codi}|${costat}`) ?? calcul.perId.get(`${codi}|C`)
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
        .posicions.find((q) => q.topologia === model.topologia && q.costat === punt.costat && (q.index ?? 0) === punt.index)
      expect(desat, `${punt.codi} ${punt.costat} ${punt.index}`).toBeDefined()
      if (desat!.origen === 'doctora') continue
      expect(desat).toMatchObject({ triangle: punt.posicio.triangle, origen: 'oms' })
      desat!.b.forEach((b, i) => expect(b).toBeCloseTo(punt.posicio.b[i]!, 5))
    }
  })

  it('els 361 punts dels 14 meridians i els 48 extraordinaris tenen regla i posició (dos costats, o una)', () => {
    const codis = cataleg.punts.map((x) => x.codi)
    expect(codis).toHaveLength(361 + 48)
    expect(REGLES.map((r) => r.codi).sort()).toEqual([...codis].sort())
    const meridians = REGLES.filter((r) => !r.codi.startsWith('EX-'))
    expect(meridians.filter((r) => r.mitja)).toHaveLength(52)
    const posicions = REGLES.reduce((n, r) => n + (r.subpunts?.length ?? 1) * (r.mitja ? 1 : 2), 0)
    expect(posicions).toBe(670 + 164)
    expect(calcul.punts).toHaveLength(posicions)
  })

  it('els punts de la línia mitja dels meridians són els de CV i GV', () => {
    for (const r of REGLES.filter((x) => !x.codi.startsWith('EX-'))) expect(Boolean(r.mitja), r.codi).toBe(/^(CV|GV)/.test(r.codi))
  })

  it('el catàleg i les regles tenen els mateixos subpunts i el mateix tipus de posició', () => {
    for (const r of REGLES) {
      const p = cataleg.punts.find((x) => x.codi === r.codi)!
      expect(p.subpunts, r.codi).toEqual(r.subpunts ? [...r.subpunts] : undefined)
      expect(Boolean(p.mitja), r.codi).toBe(Boolean(r.mitja) && r.codi.startsWith('EX-'))
    }
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
          expect(punt.distanceTo(projeccio), `${def.codi} ${k} fora de la línia`).toBeLessThan(regla.desviacio ?? 0.025)
        }
      })
    }
    if (regla.tipus === 'vertical') {
      it(`${def.codi}: ${regla.cun} cun respecte de ${regla.ref}${regla.lateral ? ` i ${regla.lateral} cun de la línia mitja` : ''}`, () => {
        for (const k of COSTATS) {
          const punt = p(def.codi, k)
          const base = regla.ref === 'melic' ? r().melic : r()[k][regla.ref]
          const unitat = regla.ref === 'malleolIntern' ? cunCamaMedial(r(), k) : r().cun[regla.unitat]
          expect((punt.y - base.y) / unitat, `${def.codi} ${k}`).toBeCloseTo(regla.cun, 0)
          if (regla.lateral !== undefined)
            expect(Math.abs(punt.x) / r().cun.pit, `${def.codi} ${k}`).toBeCloseTo(regla.lateral, 0)
        }
      })
    }
    if (regla.tipus === 'vertebra') {
      it(`${def.codi}: a l'alçada de ${regla.vertebra}${regla.sota ? ' (sota l\'apòfisi)' : ''}, ${regla.lateral} cun de la línia mitja`, () => {
        for (const k of COSTATS) {
          const punt = p(def.codi, k)
          expect(Math.abs(punt.y - nivellVertebra(r(), regla.vertebra, regla.sota)), `${def.codi} ${k}`).toBeLessThan(0.008)
          expect(Math.abs(punt.x) / r().cun.pit, `${def.codi} ${k}`).toBeCloseTo(regla.lateral, 0)
          expect(punt.z, `${def.codi} és a l'esquena`).toBeLessThan(0)
        }
      })
    }
    if (regla.tipus === 'cap') {
      it(`${def.codi}: al cap, a ${regla.cun} cun de la glabel·la i ${regla.lateral} cun de la línia mitja`, () => {
        for (const k of COSTATS) {
          const punt = p(def.codi, k)
          const mig = puntArcCap(r(), distanciaArcCap(r(), regla.cun))
          if (regla.lateral === 0) expect(punt.distanceTo(mig), def.codi).toBeLessThan(0.005)
          else {
            // la distància en línia recta és una mica menor que la mesurada sobre la pell
            const proporcio = punt.distanceTo(mig) / (regla.lateral * r().cun.cap)
            expect(proporcio, `${def.codi} ${k}`).toBeGreaterThan(0.75)
            expect(proporcio, `${def.codi} ${k}`).toBeLessThan(1.02)
          }
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
      // El cun posterior del cap (GV20–C7 = 10 cun) surt més gran perquè
      // aquest model té el coll posterior llarg; les posicions hi quadren.
      expect(valor, nom).toBeLessThan(nom === 'capPosterior' ? 0.036 : 0.032)
    }
  })

  it('GV15 i GV16 són a la nuca, a l\'alçada del lòbul de l\'orella, i GV20 entre les puntes de les orelles', () => {
    const r = calcul.referencies
    const lobul = (r.E.orellaLobul.y + r.D.orellaLobul.y) / 2
    expect(Math.abs(p('GV15', 'E').y - lobul)).toBeLessThan(0.02)
    expect(p('GV16', 'E').y).toBeGreaterThan(p('GV15', 'E').y)
    expect(p('GV16', 'E').y).toBeLessThan(r.E.orellaApex.y)
    expect(Math.abs(p('GV20', 'E').z - r.E.orellaApex.z)).toBeLessThan(0.01)
  })
})

describe('simetria', () => {
  it('els punts de la línia mitja hi són (±3 mm)', () => {
    // Fora de la línia: Jinjin i Yuye (a cada costat del fre de la llengua) i Sishencong, que són quatre
    const foraDeLinia = ['EX-HN1', 'EX-HN12', 'EX-HN13']
    for (const def of REGLES.filter((d) => d.mitja && !foraDeLinia.includes(d.codi))) expect(Math.abs(p(def.codi, 'E').x), def.codi).toBeLessThan(0.003)
  })

  it('cada punt esquerre és el mirall del dret (±3 mm)', () => {
    for (const def of REGLES.filter((d) => !d.mitja)) {
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
  for (const o of ORDRES) {
    it(`${o.codis[0]} → ${o.codis[o.codis.length - 1]}: ${o.criteri}`, () => {
      for (const k of COSTATS) {
        o.codis.forEach((codi, i) => {
          if (i === 0) return
          const a = p(o.codis[i - 1]!, k)
          const b = p(codi, k)
          if (o.criteri === 'baixa') expect(b.y, `${codi} sota ${o.codis[i - 1]} (${k})`).toBeLessThan(a.y)
          if (o.criteri === 'puja') expect(b.y, `${codi} sobre ${o.codis[i - 1]} (${k})`).toBeGreaterThan(a.y)
          if (o.criteri === 'allunya')
            expect(b.distanceTo(p(o.codis[0]!, k)), `${codi} més lluny que ${o.codis[i - 1]} (${k})`).toBeGreaterThan(a.distanceTo(p(o.codis[0]!, k)))
        })
      }
    })
  }

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

  it('ST8 és a l\'angle del front, 0,5 cun dins la línia del cabell i a 4,5 cun de la línia mitja', () => {
    for (const k of COSTATS) {
      const st8 = p('ST8', k)
      expect((st8.y - r().nivellCabell) / r().cun.cap).toBeCloseTo(0.5, 0)
      // a l'angle: la pell ja s'ha girat cap a la templa (en aquest model el
      // front és estret i a 4,5 cun la normal mira més al costat que endavant)
      const pos = calcul.perId.get(`ST8|${k}`)!.posicio
      const n = normalTriangle(model.geometria, pos.triangle)
      const graus = (Math.atan2(Math.abs(n.x), n.z) * 180) / Math.PI
      expect(graus, `ST8 ${k}`).toBeGreaterThan(45)
      expect(graus, `ST8 ${k}`).toBeLessThan(85)
      // davant de l'orella
      expect(st8.z).toBeGreaterThan(r()[k].tragus.z)
    }
  })
})

describe('cap i espatlla', () => {
  it('ST8, GB15, GB13, BL4 i GV24 (0,5 cun dins la línia anterior del cabell) són a la mateixa alçada', () => {
    const gv24 = p('GV24', 'E').y
    for (const k of COSTATS)
      for (const codi of ['ST8', 'GB15', 'GB13', 'BL4']) {
        expect(Math.abs(p(codi, k).y - gv24), `${codi} ${k}`).toBeLessThan(0.003)
      }
  })

  it('al front, de dins cap a fora: GV24, BL4, GB15, GB13 i ST8', () => {
    for (const k of COSTATS) {
      const xs = ['GV24', 'BL4', 'GB15', 'GB13', 'ST8'].map((codi) => Math.abs(p(codi, k).x))
      for (let i = 1; i < xs.length; i++) expect(xs[i]!, `${k} ${i}`).toBeGreaterThan(xs[i - 1]!)
    }
  })

  it('GB21 és simètric i a dalt de l\'espatlla, a mig camí entre C7 i l\'acromi', () => {
    const r = calcul.referencies
    const e = p('GB21', 'E')
    const d = p('GB21', 'D')
    // simetria: el mateix punt reflectit (x → −x)
    expect(e.distanceTo(new Vector3(-d.x, d.y, d.z))).toBeLessThan(0.002)
    for (const k of COSTATS) {
      const g = p('GB21', k)
      const gv14 = p('GV14', k)
      const acromi = r[k].acromi
      // a mig camí en amplada
      expect(Math.abs(Math.abs(g.x) - (Math.abs(gv14.x) + Math.abs(acromi.x)) / 2)).toBeLessThan(0.005)
      // a dalt: no a la cara de davant (darrere de l'acromi) ni a l'esquena
      expect(g.z, `GB21 ${k}`).toBeLessThan(acromi.z)
      expect(g.z, `GB21 ${k}`).toBeGreaterThan(gv14.z)
      expect(g.y).toBeGreaterThan(acromi.y)
      // a la carena: la normal de la pell mira amunt
      const n = normalTriangle(model.geometria, calcul.perId.get(`GB21|${k}`)!.posicio.triangle)
      expect(n.y, `GB21 ${k}`).toBeGreaterThan(0.8)
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
