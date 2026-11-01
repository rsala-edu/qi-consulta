// Referències anatòmiques sobre el cos de MakeHuman i unitats de cun
// proporcional (B-cun) de cada regió, segons les distàncies estàndard:
//   canell – plec del colze ................ 12 cun
//   plec axil·lar anterior – plec del colze .  9 cun
//   entre els dos mugrons ...................  8 cun
//   fossa supraesternal – unió xifoesternal .  9 cun
//   unió xifoesternal – melic ...............  8 cun
//   melic – vora superior de la símfisi .....  5 cun
//   símfisi – base de la ròtula ............. 18 cun
//   plec popliti (ST35) – mal·lèol extern ... 16 cun
//   glabel·la – vèrtex (sobre la línia mitja del cap) 8 cun
//     (3 fins a la línia anterior del cabell + 5 fins a GV20)
//
// Són aproximacions geomètriques sobre la malla: les proves comproven que
// cada punt compleix la seva regla respecte d'aquestes referències.

import { Vector3 } from 'three'
import { CosMesurable, DAVANT, dir, signe, v, type Costat } from './cos'

export interface UnitatsCun {
  avantbrac: number
  brac: number
  /** Horitzontal al tòrax i a l'abdomen (entre mugrons = 8) */
  pit: number
  abdomenSuperior: number
  abdomenInferior: number
  cuixa: number
  cama: number
  cap: number
}

export interface ReferenciesCostat {
  // Braç
  espatlla: Vector3
  colze: Vector3
  canell: Vector3
  /** Direcció del braç (espatlla → colze) */
  eixBrac: Vector3
  /** Direcció de l'avantbraç (colze → canell) */
  eixAvantbrac: Vector3
  /** Costat radial (polze) de la mà */
  radial: Vector3
  /** Dors de la mà */
  dorsal: Vector3
  /** Costat lateral (epicòndil) del colze */
  lateralColze: Vector3
  /** Cara anterior (de flexió) del colze */
  anteriorColze: Vector3
  mcp2: Vector3
  // Tòrax
  mugro: Vector3
  /** Vora inferior de la clavícula a la línia mamil·lar */
  clavicula: Vector3
  /** Separació entre espais intercostals a la línia mamil·lar (m) */
  espaiIntercostal: number
  // Cama
  maluc: Vector3
  genoll: Vector3
  turmell: Vector3
  eixCuixa: Vector3
  eixCama: Vector3
  anteriorGenoll: Vector3
  lateral: Vector3
  basePatella: Vector3
  espinaIliaca: Vector3
  malleolExtern: Vector3
  // Cara
  ull: Vector3
}

export interface Referencies {
  E: ReferenciesCostat
  D: ReferenciesCostat
  cun: UnitatsCun
  fossaSupraesternal: Vector3
  unioXifoesternal: Vector3
  melic: Vector3
  /** Vora superior de la símfisi del pubis */
  simfisi: Vector3
  /** Nivells (Y) del coll */
  nivellTiroide: number
  nivellCricoide: number
  centreCap: Vector3
  /** Punta del nas */
  nas: Vector3
  nivellAlaNas: number
  nivellBaseNas: number
  nivellBoca: number
  nivellCellaSuperior: number
  /** Alçada de ST8 (0,5 cun dins la línia anterior del cabell) */
  nivellST8: number
}

/** Punts de la línia mitja del cap, de la glabel·la (alçada `yInici`) fins al vèrtex. */
function arcSagital(c: CosMesurable, centre: Vector3, yInici: number): Vector3[] {
  const punts: Vector3[] = []
  for (let graus = -10; graus <= 100; graus += 1) {
    const a = (graus * Math.PI) / 180
    const p = c.pellDesDeFora(centre, v(0, Math.sin(a), Math.cos(a)))
    if (p.y >= yInici && p.z > centre.z - 0.02) punts.push(p)
  }
  // fins al punt més alt (vèrtex)
  const cim = punts.reduce((m, p, i) => (p.y > punts[m]!.y ? i : m), 0)
  return punts.slice(0, cim + 1)
}

function longitud(punts: Vector3[]): number {
  return punts.reduce((s, p, i) => (i === 0 ? 0 : s + p.distanceTo(punts[i - 1]!)), 0)
}

function puntSobreArc(punts: Vector3[], distancia: number): Vector3 {
  let recorregut = 0
  for (let i = 1; i < punts.length; i++) {
    const pas = punts[i]!.distanceTo(punts[i - 1]!)
    if (recorregut + pas >= distancia) return punts[i - 1]!.clone().lerp(punts[i]!, (distancia - recorregut) / pas)
    recorregut += pas
  }
  return punts[punts.length - 1]!.clone()
}

function perpendicular(vec: Vector3, eix: Vector3): Vector3 {
  return vec.clone().sub(eix.clone().multiplyScalar(vec.dot(eix))).normalize()
}

function referenciesCostat(c: CosMesurable, costat: Costat): ReferenciesCostat {
  const s = signe(costat)
  const espatlla = c.art('shoulder', costat)
  const colze = c.art('elbow', costat)
  const canell = c.art('hand', costat)
  const mcp2 = c.art('finger-2-1', costat)
  const mcp5 = c.art('finger-5-1', costat)
  const eixBrac = colze.clone().sub(espatlla).normalize()
  const eixAvantbrac = canell.clone().sub(colze).normalize()
  const eixMa = mcp2.clone().lerp(mcp5, 0.5).sub(canell).normalize()
  const radial = perpendicular(mcp2.clone().sub(mcp5), eixMa)
  const dorsal = radial.clone().cross(eixMa).multiplyScalar(s).normalize()
  const lateralColze = colze.clone().sub(espatlla).cross(canell.clone().sub(colze)).multiplyScalar(-s).normalize()
  const anteriorColze = perpendicular(eixAvantbrac, eixBrac)

  // Mugró: el vèrtex més avançat del pit en aquest costat
  const candidats = c.vertexsDins(v(s > 0 ? 0.04 : -0.17, 1.08, 0), v(s > 0 ? 0.17 : -0.04, 1.32, 0.3))
  const mugroVertex = candidats.reduce((a, b) => (b.z > a.z ? b : a))
  const mugro = c.puntDe(c.aLaPell(mugroVertex))

  // Clavícula: de l'articulació esternoclavicular cap a l'acromi
  const esternoclav = c.art('clavicle', costat)
  const acromi = espatlla.clone().add(v(s * 0.01, 0.035, 0))
  const t = (Math.abs(mugro.x) - Math.abs(esternoclav.x)) / (Math.abs(acromi.x) - Math.abs(esternoclav.x))
  const nivellClav = esternoclav.y + t * (acromi.y - esternoclav.y) - 0.012
  const clavicula = c.pell(v(mugro.x, nivellClav, 0), DAVANT)
  const espaiIntercostal = (clavicula.y - mugro.y) / 3.4

  // Cama
  const maluc = c.art('upper-leg', costat)
  const genoll = c.art('knee', costat)
  const turmell = c.art('ankle', costat)
  const eixCuixa = genoll.clone().sub(maluc).normalize()
  const eixCama = turmell.clone().sub(genoll).normalize()
  const anteriorGenoll = perpendicular(DAVANT, eixCama)
  const lateral = perpendicular(v(s, 0, 0), eixCama)
  const basePatella = c.pell(genoll.clone().addScaledVector(eixCuixa, -0.035), dir([anteriorGenoll, 1], [lateral, 0.3]))
  const espinaIliaca = c.pell(v(s * 0.085, maluc.y + 0.075, 0), dir([DAVANT, 1], [v(s, 0, 0), 0.35]))
  const malleolExtern = c.pell(turmell.clone().add(v(0, -0.004, 0)), dir([v(s, 0, 0), 1], [DAVANT, -0.15]))

  return {
    espatlla,
    colze,
    canell,
    eixBrac,
    eixAvantbrac,
    radial,
    dorsal,
    lateralColze,
    anteriorColze,
    mcp2,
    mugro,
    clavicula,
    espaiIntercostal,
    maluc,
    genoll,
    turmell,
    eixCuixa,
    eixCama,
    anteriorGenoll,
    lateral,
    basePatella,
    espinaIliaca,
    malleolExtern,
    ull: c.art('eye', costat),
  }
}

/** Perfil de la pell (z) al llarg de la línia mitja anterior, de dalt a baix, vist des de davant. */
function perfilMitja(c: CosMesurable, yMin: number, yMax: number, pas: number): Array<{ y: number; z: number }> {
  const r: Array<{ y: number; z: number }> = []
  for (let y = yMax; y >= yMin; y -= pas) {
    const p = c.pellOpcional(v(0, y, 0.5), v(0, 0, -1), 0.6)
    if (p) r.push({ y, z: p.z })
  }
  return r
}

export function calcularReferencies(c: CosMesurable): Referencies {
  const E = referenciesCostat(c, 'E')
  const D = referenciesCostat(c, 'D')

  // Tòrax: fossa supraesternal (centre, per sobre de les articulacions esternoclaviculars)
  const esternoclav = c.art('clavicle', 'E')
  const fossaSupraesternal = c.pell(v(0, esternoclav.y + 0.006, esternoclav.z - 0.02), DAVANT)
  const cunPit = (Math.abs(E.mugro.x) + Math.abs(D.mugro.x)) / 8

  // Melic: la depressió més marcada del perfil de l'abdomen a la línia mitja
  const perfil = perfilMitja(c, 0.9, 1.12, 0.002)
  let melicY = perfil[0]!.y
  let pitjor = Infinity
  perfil.forEach((p, i) => {
    const veins = perfil.slice(Math.max(0, i - 10), i + 11)
    const mitjana = veins.reduce((a, b) => a + b.z, 0) / veins.length
    if (i > 10 && i < perfil.length - 10 && p.z - mitjana < pitjor) {
      pitjor = p.z - mitjana
      melicY = p.y
    }
  })
  const melic = c.pell(v(0, melicY, -0.02), DAVANT)

  // Símfisi del pubis: a l'alçada dels caps del fèmur
  const nivellSimfisi = (E.maluc.y + D.maluc.y) / 2
  const simfisi = c.pell(v(0, nivellSimfisi, -0.02), DAVANT)
  const unioXifoesternal = c.pell(v(0, fossaSupraesternal.y - 9 * cunPit, -0.02), DAVANT)

  // Coll: nivells del cartílag tiroide i del cricoide entre la fossa i el mentó
  const mento = c.art('jaw')
  const nivellTiroide = fossaSupraesternal.y + 0.5 * (mento.y - fossaSupraesternal.y)
  const nivellCricoide = fossaSupraesternal.y + 0.3 * (mento.y - fossaSupraesternal.y)

  // Cara: punta del nas (el punt més avançat de la línia mitja sota els ulls)
  const centreCap = c.art('head')
  const ull = E.ull
  const perfilCara = perfilMitja(c, ull.y - 0.075, ull.y - 0.005, 0.001)
  const puntaNas = perfilCara.reduce((a, b) => (b.z > a.z ? b : a))
  const nas = c.pellDesDeFora(v(0, puntaNas.y, 0), DAVANT)
  const nivellAlaNas = nas.y - 0.004
  const nivellBaseNas = nas.y - 0.013
  // Boca: el plec més profund entre els llavis, sota la base del nas
  const llavis = perfilMitja(c, nas.y - 0.05, nas.y - 0.02, 0.001)
  let nivellBoca = nas.y - 0.035
  for (let i = 1; i < llavis.length - 1; i++) {
    const p = llavis[i]!
    if (p.z < llavis[i - 1]!.z && p.z < llavis[i + 1]!.z) {
      nivellBoca = p.y
      break
    }
  }

  // Cun del cap: l'arc de la línia mitja de la glabel·la al vèrtex fa 8 cun.
  // (Sense cabell al model, la línia del cabell no serveix de referència.)
  const nivellCellaSuperior = ull.y + 0.018
  const arc = arcSagital(c, centreCap, nivellCellaSuperior)
  const cunCap = longitud(arc) / 8
  // Línia anterior del cabell + 0,5 cun (alçada de ST8): 3,5 cun sobre l'arc
  const nivellST8 = puntSobreArc(arc, 3.5 * cunCap).y

  const cun: UnitatsCun = {
    avantbrac: (E.colze.distanceTo(E.canell) + D.colze.distanceTo(D.canell)) / 2 / 12,
    brac: (0.8 * (E.espatlla.distanceTo(E.colze) + D.espatlla.distanceTo(D.colze))) / 2 / 9,
    pit: cunPit,
    abdomenSuperior: (unioXifoesternal.y - melic.y) / 8,
    abdomenInferior: (melic.y - simfisi.y) / 5,
    cuixa: (simfisi.y - (E.basePatella.y + D.basePatella.y) / 2) / 18,
    cama: ((E.genoll.y - E.malleolExtern.y) + (D.genoll.y - D.malleolExtern.y)) / 2 / 16,
    cap: cunCap,
  }

  return {
    E,
    D,
    cun,
    fossaSupraesternal,
    unioXifoesternal,
    melic,
    simfisi,
    nivellTiroide,
    nivellCricoide,
    centreCap,
    nas,
    nivellAlaNas,
    nivellBaseNas,
    nivellBoca,
    nivellCellaSuperior,
    nivellST8,
  }
}

