// Referències anatòmiques sobre el cos de MakeHuman i unitats de cun
// proporcional (B-cun) de cada regió, segons les distàncies estàndard:
//   canell – plec del colze ................ 12 cun
//   plec axil·lar anterior – plec del colze .  9 cun
//   entre els dos mugrons ...................  8 cun
//   (la unió xifoesternal es pren a l'alçada del 5è espai intercostal, com CV16)
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
import { AMUNT, CosMesurable, DARRERE, DAVANT, dir, signe, v, type Costat } from './cos'

export interface UnitatsCun {
  avantbrac: number
  brac: number
  /** Horitzontal al tòrax i a l'abdomen (entre mugrons = 8) */
  pit: number
  abdomenSuperior: number
  abdomenInferior: number
  cuixa: number
  cama: number
  /** Cap, part anterior: de la glabel·la a GV20 hi ha 8 cun */
  cap: number
  /** Cap i nuca, part posterior: de GV20 a C7 hi ha 10 cun (7 fins al cabell + 3) */
  capPosterior: number
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
  tragus: Vector3
  cantIntern: Vector3
  cantExtern: Vector3
  orellaApex: Vector3
  orellaLobul: Vector3
  orellaPosterior: Vector3
  // Direccions oposades (per comoditat)
  palmar: Vector3
  cubital: Vector3
  medialColze: Vector3
  posteriorColze: Vector3
  medial: Vector3
  posteriorGenoll: Vector3
  // Més referències de les extremitats
  aixella: Vector3
  acromi: Vector3
  malleolIntern: Vector3
  capPerone: Vector3
  plecPopliti: Vector3
  trocanter: Vector3
  plecGluti: Vector3
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
  /** Alçada de la línia anterior del cabell (3 cun per sobre de la glabel·la) */
  nivellCabell: number
  /** Alçada total del cos (m) */
  alcada: number
  /** Alçada (Y) de l'apòfisi espinosa de cada vertebra: C7, T1…T12, L1…L5, S1…S4, coccix */
  vertebres: Readonly<Record<string, number>>
  /**
   * Línia mitja del cap, de la glabel·la cap enrere fins a la nuca, vista des
   * de fora. Els punts del cap es mesuren en cun sobre aquest arc.
   */
  arcCap: Vector3[]
  /** Distància sobre l'arc de la glabel·la a GV20 (punt mitjà entre les puntes de les orelles) */
  distanciaGV20: number
}

/** Vertebres en ordre, de C7 al còccix */
export const VERTEBRES = [
  'C7',
  ...Array.from({ length: 12 }, (_, i) => `T${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `L${i + 1}`),
  'S1',
  'S2',
  'S3',
  'S4',
  'coccix',
] as const

/**
 * Nivells de les vertebres per proporcions antropomètriques: C7 (cervicale)
 * al 84,6 % de l'alçada, L4 a l'alçada de la cresta ilíaca; dorsals i
 * lumbars repartides per pes (una lumbar = 1,35 dorsals); sacre i còccix sota L5.
 */
function nivellsVertebres(alcada: number, nivellL4: number): Record<string, number> {
  const c7 = 0.846 * alcada
  const pesos = [...Array(12).fill(1), ...Array(4).fill(1.35)] as number[]
  const unitat = (c7 - nivellL4) / pesos.reduce((a, b) => a + b, 0)
  const n: Record<string, number> = { C7: c7 }
  let y = c7
  const noms = [...Array.from({ length: 12 }, (_, i) => `T${i + 1}`), 'L1', 'L2', 'L3', 'L4']
  noms.forEach((nom, i) => {
    y -= pesos[i]! * unitat
    n[nom] = y
  })
  const lumbar = 1.35 * unitat
  n.L5 = n.L4! - lumbar
  n.S1 = n.L5 - 0.85 * lumbar
  n.S2 = n.S1 - 0.6 * lumbar
  n.S3 = n.S2 - 0.55 * lumbar
  n.S4 = n.S3 - 0.5 * lumbar
  n.coccix = n.S4 - 0.9 * lumbar
  return n
}

/**
 * Línia mitja del cap i la nuca des de fora: de la glabel·la (alçada yInici)
 * cap enrere fins a l'alçada de C7. S'atura si troba un salt (espatlles).
 */
function arcCapComplet(c: CosMesurable, centre: Vector3, yInici: number, yC7: number): Vector3[] {
  const punts: Vector3[] = []
  for (let graus = -10; graus <= 270; graus += 0.5) {
    const a = (graus * Math.PI) / 180
    const p = c.pellOpcional(centre.clone().addScaledVector(v(0, Math.sin(a), Math.cos(a)), 0.4), v(0, -Math.sin(a), -Math.cos(a)), 0.8)
    if (!p) continue
    if (graus < 90 && p.y < yInici) continue
    const darrer = punts[punts.length - 1]
    if (darrer && p.distanceTo(darrer) > 0.015) break
    punts.push(p)
    if (p.y <= yC7) break
  }
  return punts
}

/** Distància sobre l'arc fins al punt més proper a un pla z (el primer, venint de davant) */
function distanciaFinsZ(punts: Vector3[], z: number, yMinim: number): number {
  let recorregut = 0
  let millor = { d: Infinity, s: 0 }
  punts.forEach((p, i) => {
    if (i) recorregut += p.distanceTo(punts[i - 1]!)
    if (p.y >= yMinim && Math.abs(p.z - z) < millor.d) millor = { d: Math.abs(p.z - z), s: recorregut }
  })
  return millor.s
}

/**
 * Distància sobre l'arc del cap per a una posició expressada en cun des de la
 * glabel·la: fins a 8 cun (GV20) amb el cun anterior, i després amb el posterior.
 */
export function distanciaArcCap(r: Referencies, cun: number): number {
  return cun <= 8 ? cun * r.cun.cap : r.distanciaGV20 + (cun - 8) * r.cun.capPosterior
}

/** Punt de la línia mitja del cap a una distància (m) de la glabel·la, sobre l'arc. */
export function puntArcCap(r: Referencies, distancia: number): Vector3 {
  return puntSobreArc(r.arcCap, distancia)
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

/** Àpex de l'aixella: el punt més alt que troben els raigs que pugen entre el braç i el tronc. */
function aixella(c: CosMesurable, s: number, espatlla: Vector3): Vector3 {
  let millor: Vector3 | null = null
  for (let x = 0.1; x <= 0.26; x += 0.005) {
    const p = c.pellOpcional(v(s * x, espatlla.y - 0.37, espatlla.z), AMUNT, 0.5)
    if (p && p.y < espatlla.y && (!millor || p.y > millor.y)) millor = p
  }
  if (!millor) throw new Error('No s\'ha trobat l\'aixella')
  return millor
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

  // Mugró: el relleu més corbat de la pell a menys de 3 cm de la referència de
  // MakeHuman («breast-point», que marca la zona del pit però no la punta)
  const mugro = c.curvaturaMaxima(c.ref('mugro', costat), 0.03)

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
    tragus: c.ref('tragus', costat),
    cantIntern: c.ref('cant-intern', costat),
    cantExtern: c.ref('cant-extern', costat),
    orellaApex: c.ref('orella-apex', costat),
    orellaLobul: c.ref('orella-lobul', costat),
    orellaPosterior: c.ref('orella-posterior', costat),
    palmar: dorsal.clone().negate(),
    cubital: radial.clone().negate(),
    medialColze: lateralColze.clone().negate(),
    posteriorColze: anteriorColze.clone().negate(),
    medial: lateral.clone().negate(),
    posteriorGenoll: anteriorGenoll.clone().negate(),
    aixella: aixella(c, s, espatlla),
    acromi: c.pell(espatlla, dir([AMUNT, 1], [v(s, 0, 0), 0.35])),
    malleolIntern: c.pell(turmell.clone().add(v(0, 0.004, 0)), dir([v(-s, 0, 0), 1], [DAVANT, -0.1])),
    capPerone: c.pell(genoll.clone().addScaledVector(eixCama, 0.045), dir([lateral, 1], [anteriorGenoll, -0.35])),
    plecPopliti: c.pell(genoll, anteriorGenoll.clone().negate()),
    trocanter: c.pell(maluc.clone().add(v(0, -0.015, 0)), v(s, 0, 0)),
    plecGluti: c.pell(v(maluc.x * 0.85, maluc.y - 0.075, maluc.z), DARRERE),
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

  // Melic: el centre que mou la deformació «navel-in» de MakeHuman
  const melic = c.ref('melic')

  // Símfisi del pubis: a l'alçada dels caps del fèmur
  const nivellSimfisi = (E.maluc.y + D.maluc.y) / 2
  const simfisi = c.pell(v(0, nivellSimfisi, -0.02), DAVANT)
  // Unió xifoesternal (CV16): a l'alçada del 5è espai intercostal
  const nivellXifoide = (E.mugro.y + D.mugro.y) / 2 - (E.espaiIntercostal + D.espaiIntercostal) / 2
  const unioXifoesternal = c.pell(v(0, nivellXifoide, -0.02), DAVANT)

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

  // Cun del cap: GV20 és el punt mitjà entre les puntes de les orelles; de la
  // glabel·la a GV20 hi ha 8 cun, i de GV20 a C7, 10 cun. (Sense cabell al
  // model, les línies del cabell es dedueixen d'aquestes mesures.)
  const nivellCellaSuperior = ull.y + 0.018
  const alcadaCos = c.model.geometria.boundingBox!.max.y - c.model.geometria.boundingBox!.min.y
  const vertebres = nivellsVertebres(alcadaCos, (E.maluc.y + D.maluc.y) / 2 + 0.105)
  const arcCap = arcCapComplet(c, centreCap, nivellCellaSuperior, vertebres.C7!)
  const zOrelles = (E.orellaApex.z + D.orellaApex.z) / 2
  const distanciaGV20 = distanciaFinsZ(arcCap, zOrelles, (E.orellaApex.y + D.orellaApex.y) / 2)
  const cunCap = distanciaGV20 / 8
  const cunCapPosterior = (longitud(arcCap) - distanciaGV20) / 10
  const arc = arcCap
  // Línia anterior del cabell: 3 cun per sobre de la glabel·la, sobre l'arc
  const nivellCabell = puntSobreArc(arc, 3 * cunCap).y

  const alcada = c.model.geometria.boundingBox!.max.y - c.model.geometria.boundingBox!.min.y
  const cun: UnitatsCun = {
    avantbrac: (E.colze.distanceTo(E.canell) + D.colze.distanceTo(D.canell)) / 2 / 12,
    brac: (0.8 * (E.espatlla.distanceTo(E.colze) + D.espatlla.distanceTo(D.colze))) / 2 / 9,
    pit: cunPit,
    abdomenSuperior: (unioXifoesternal.y - melic.y) / 8,
    abdomenInferior: (melic.y - simfisi.y) / 5,
    cuixa: (simfisi.y - (E.basePatella.y + D.basePatella.y) / 2) / 18,
    cama: ((E.genoll.y - E.malleolExtern.y) + (D.genoll.y - D.malleolExtern.y)) / 2 / 16,
    cap: cunCap,
    capPosterior: cunCapPosterior,
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
    nivellCabell,
    alcada,
    vertebres,
    arcCap,
    distanciaGV20,
  }
}

