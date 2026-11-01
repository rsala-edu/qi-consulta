// Funcions comunes per escriure les regles dels punts: rajos fins a la pell
// des de les extremitats, el tronc, l'esquena i el cap, mesurats en cun.

import { Vector3 } from 'three'
import { normalTriangle } from '../../mapa/geometria/baricentriques'
import { AMUNT, CosMesurable, DARRERE, DAVANT, dir, signe, v, type Costat } from './cos'
import { distanciaArcCap, puntArcCap, type Referencies, type UnitatsCun } from './referencies'

export function avantbrac(c: CosMesurable, r: Referencies, costat: Costat, cunDesDelCanell: number): Vector3 {
  const k = r[costat]
  const t = cunDesDelCanell / 12
  const origen = k.canell.clone().lerp(k.colze, t)
  const aCanell = dir([k.radial, 1], [k.dorsal, 0.5])
  const aColze = dir([k.lateralColze, 1], [k.anteriorColze, 0.35])
  return c.pell(origen, aCanell.lerp(aColze, t).normalize())
}

export function brac(c: CosMesurable, r: Referencies, costat: Costat, cunSobreColze: number, anterior = 0): Vector3 {
  const k = r[costat]
  const origen = k.colze.clone().addScaledVector(k.eixBrac, -cunSobreColze * r.cun.brac)
  return c.pell(origen, dir([k.lateralColze, 1], [k.anteriorColze, anterior]))
}

/** Pell del coll a una alçada, girant `graus` des de davant cap al costat. */
export function coll(c: CosMesurable, _r: Referencies, costat: Costat, y: number, graus: number): Vector3 {
  const a = (graus * Math.PI) / 180
  const centre = c.art('neck')
  return c.pell(v(0, y, centre.z), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/** Pell de la cara (vista des de davant) a una distància lateral de la línia mitja (m) i una alçada. */
export function cara(c: CosMesurable, _r: Referencies, costat: Costat, lateral: number, y: number): Vector3 {
  return c.pellDesDeFora(v(signe(costat) * lateral, y, 0), DAVANT)
}

/** Pell del cap a una alçada, vista des d'un angle de `graus` entre davant i el costat. */
export function cap(c: CosMesurable, r: Referencies, costat: Costat, y: number, graus: number): Vector3 {
  const a = (graus * Math.PI) / 180
  return c.pellDesDeFora(v(0, y, r.centreCap.z), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/**
 * Angle del front (en graus des de davant) a una alçada: on la pell deixa de
 * mirar endavant i passa a mirar cap al costat (normal a 45°), és a dir, on
 * el front es gira cap a la templa.
 */
export function angleDelFront(c: CosMesurable, r: Referencies, costat: Costat, y: number): number {
  for (let graus = 5; graus <= 85; graus++) {
    const p = c.aLaPell(cap(c, r, costat, y, graus))
    const n = normalTriangle(c.model.geometria, p.triangle)
    if (Math.abs(n.x) >= n.z) return graus
  }
  throw new Error('No s\'ha trobat l\'angle del front')
}

export function pit(c: CosMesurable, r: Referencies, costat: Costat, y: number, amunt = 0): Vector3 {
  return c.pell(v(r[costat].mugro.x, y, 0), dir([DAVANT, 1], [AMUNT, amunt]))
}

export function abdomen(c: CosMesurable, r: Referencies, costat: Costat, cun: number, unitat: keyof UnitatsCun): Vector3 {
  return c.pell(v(signe(costat) * 2 * r.cun.pit, r.melic.y + cun * r.cun[unitat], -0.02), DAVANT)
}

/** Cuixa: sobre la línia espina ilíaca – base de la ròtula, a `cun` per sobre de la ròtula. */
export function cuixa(c: CosMesurable, r: Referencies, costat: Costat, cunSobreRotula: number): Vector3 {
  const k = r[costat]
  const t = (cunSobreRotula * r.cun.cuixa) / (k.espinaIliaca.y - k.basePatella.y)
  return c.puntDe(c.aLaPell(k.basePatella.clone().lerp(k.espinaIliaca, t)))
}

/** Cama: a `cun` per sota del genoll, a un través de dit lateral de la cresta de la tíbia. */
export function cama(c: CosMesurable, r: Referencies, costat: Costat, cunSotaGenoll: number, lateral = 0.22): Vector3 {
  const k = r[costat]
  const origen = k.genoll.clone().addScaledVector(k.eixCama, (cunSotaGenoll * r.cun.cama) / -k.eixCama.y)
  return c.pell(origen, dir([k.anteriorGenoll, 1], [k.lateral, lateral]))
}

export const dits = (costat: Costat, nom: string, c: CosMesurable) => c.art(nom, costat)

// --- Funcions generals ---------------------------------------------------------

/** El punt de la pell més proper a un punt de l'espai. */
export function aPell(c: CosMesurable, p: Vector3): Vector3 {
  return c.puntDe(c.aLaPell(p))
}

/** Punt de la pell sobre la línia A–B, a la fracció `t`. */
export function pellLinia(c: CosMesurable, a: Vector3, b: Vector3, t: number): Vector3 {
  return aPell(c, a.clone().lerp(b, t))
}

type DirCostat = (k: Referencies['E']) => Vector3

/**
 * Avantbraç: a `cun` del plec del canell (12 cun fins al plec del colze), amb
 * la direcció del raig interpolada entre la del canell i la del colze.
 */
export function avantbracDir(
  c: CosMesurable,
  r: Referencies,
  costat: Costat,
  cun: number,
  dCanell: DirCostat,
  dColze: DirCostat,
): Vector3 {
  const k = r[costat]
  const t = cun / 12
  return c.pell(k.canell.clone().lerp(k.colze, t), dCanell(k).lerp(dColze(k), t).normalize())
}

/** Braç: a `cun` per sobre del plec del colze (9 cun fins al plec axil·lar). */
export function bracDir(c: CosMesurable, r: Referencies, costat: Costat, cun: number, d: DirCostat): Vector3 {
  const k = r[costat]
  return c.pell(k.colze.clone().addScaledVector(k.eixBrac, -cun * r.cun.brac), d(k))
}

/** Unitat de cun de la cara medial de la cama: de SP9 al mal·lèol intern hi ha 13 cun. */
export function cunCamaMedial(r: Referencies, costat: Costat): number {
  const k = r[costat]
  return (k.genoll.y - 0.04 - k.malleolIntern.y) / 13
}

/** Punt de l'eix de la cama a una alçada. */
function eixCamaA(r: Referencies, costat: Costat, y: number): Vector3 {
  const k = r[costat]
  return k.genoll.clone().addScaledVector(k.eixCama, (k.genoll.y - y) / -k.eixCama.y)
}

/**
 * Cama: a `cun` per sobre d'un mal·lèol (intern: unitat medial, 13 cun fins a
 * SP9; extern: 16 cun fins al plec popliti).
 */
export function camaMalleol(
  c: CosMesurable,
  r: Referencies,
  costat: Costat,
  cun: number,
  quin: 'intern' | 'extern',
  d: DirCostat,
): Vector3 {
  const k = r[costat]
  const m = quin === 'intern' ? k.malleolIntern : k.malleolExtern
  const unitat = quin === 'intern' ? cunCamaMedial(r, costat) : r.cun.cama
  return c.pell(eixCamaA(r, costat, m.y + cun * unitat), d(k))
}

/** Cama: a `cun` per sota del plec popliti (16 cun fins al mal·lèol extern). */
export function camaPopliti(c: CosMesurable, r: Referencies, costat: Costat, cun: number, d: DirCostat): Vector3 {
  const k = r[costat]
  return c.pell(eixCamaA(r, costat, k.plecPopliti.y - cun * r.cun.cama), d(k))
}

/** Cuixa: a `cun` per sobre del genoll, amb la unitat que es digui. */
export function cuixaDir(
  c: CosMesurable,
  r: Referencies,
  costat: Costat,
  cun: number,
  unitat: number,
  d: DirCostat,
): Vector3 {
  const k = r[costat]
  const y = k.genoll.y + cun * unitat
  return c.pell(k.genoll.clone().addScaledVector(k.eixCuixa, (k.genoll.y - y) / -k.eixCuixa.y), d(k))
}

/** Unitat de cun lateral de la cuixa: del trocànter al plec popliti hi ha 19 cun. */
export function cunCuixaLateral(r: Referencies, costat: Costat): number {
  return (r[costat].trocanter.y - r[costat].plecPopliti.y) / 19
}

/** Unitat de cun posterior de la cuixa: del plec gluti al plec popliti hi ha 14 cun. */
export function cunCuixaPosterior(r: Referencies, costat: Costat): number {
  return (r[costat].plecGluti.y - r[costat].plecPopliti.y) / 14
}

// --- Tronc ------------------------------------------------------------------------

/** Alçada d'una vertebra, o de la depressió de sota la seva apòfisi espinosa. */
export function nivellVertebra(r: Referencies, nom: string, sota: boolean): number {
  const noms = Object.keys(r.vertebres)
  const y = r.vertebres[nom]
  if (y === undefined) throw new Error(`Vertebra desconeguda: ${nom}`)
  if (!sota) return y
  const seguent = r.vertebres[noms[noms.indexOf(nom) + 1]!]
  return seguent === undefined ? y : (y + seguent) / 2
}

/** Esquena: pell a una alçada i a `lateralCun` de la línia mitja (cun horitzontal del tronc). */
export function esquena(c: CosMesurable, r: Referencies, costat: Costat, y: number, lateralCun: number): Vector3 {
  return c.pellDesDeFora(v(signe(costat) * lateralCun * r.cun.pit, y, 0), DARRERE, 0.5)
}

/** Tronc vist des de dins: pell a una alçada, girant `graus` des de davant cap al costat. */
export function troncLateral(c: CosMesurable, costat: Costat, y: number, graus: number, zCentre = 0): Vector3 {
  const a = (graus * Math.PI) / 180
  return c.pell(v(0, y, zCentre), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/** Alçada de l'espai intercostal `n` a la línia mamil·lar (el mugró és al 4t). */
export function espaiIntercostal(r: Referencies, costat: Costat, n: number): number {
  const k = r[costat]
  return k.mugro.y - (n - 4) * k.espaiIntercostal
}

/** Pit: pell a `xCun` de la línia mitja (cun horitzontal del tòrax) i a una alçada. */
export function pitX(c: CosMesurable, r: Referencies, costat: Costat, xCun: number, y: number, amunt = 0): Vector3 {
  const x = signe(costat) * xCun * r.cun.pit
  const p = c.pellOpcional(v(x, y, 0), dir([DAVANT, 1], [AMUNT, amunt]))
  if (p) return p
  // Fora del tòrax (punts molt laterals en un tòrax estret): el punt de la
  // vora del tòrax, a aquesta alçada, més proper a la distància demanada
  let millor: Vector3 | null = null
  for (let graus = 0; graus <= 100; graus += 1) {
    const q = c.pellOpcional(v(0, y, 0), v(signe(costat) * Math.sin((graus * Math.PI) / 180), 0, Math.cos((graus * Math.PI) / 180)))
    if (q && (!millor || Math.abs(Math.abs(q.x) - Math.abs(x)) < Math.abs(Math.abs(millor.x) - Math.abs(x)))) millor = q
  }
  if (!millor) throw new Error('No s\'ha trobat el tòrax')
  return millor
}

/** Abdomen: a `cun` per sobre (+) o per sota (−) del melic i a `lateralCun` de la línia mitja. */
export function abdomenX(c: CosMesurable, r: Referencies, costat: Costat, cun: number, lateralCun: number): Vector3 {
  const unitat = cun >= 0 ? r.cun.abdomenSuperior : r.cun.abdomenInferior
  return c.pell(v(signe(costat) * lateralCun * r.cun.pit, r.melic.y + cun * unitat, -0.02), DAVANT)
}

/** Alçada de la vora inferior de la clavícula a una distància de la línia mitja. */
export function nivellClavicula(c: CosMesurable, r: Referencies, costat: Costat, x: number): number {
  const sc = c.art('clavicle', costat)
  const ac = r[costat].acromi
  const t = (Math.abs(x) - Math.abs(sc.x)) / (Math.abs(ac.x) - Math.abs(sc.x))
  return sc.y + t * (ac.y - 0.02 - sc.y) - 0.012
}

// --- Cap ----------------------------------------------------------------------------

/**
 * Cap: punt a `cun` de la glabel·la sobre l'arc de la línia mitja i a
 * `lateralCun` d'aquesta línia, mesurat seguint la pell cap al costat.
 */
export function capArc(c: CosMesurable, r: Referencies, costat: Costat, cun: number, lateralCun: number): Vector3 {
  const mig = puntArcCap(r, distanciaArcCap(r, cun))
  if (lateralCun === 0) return mig
  const centre = r.centreCap
  const u = mig.clone().sub(centre).normalize()
  const lat = v(signe(costat), 0, 0)
  // Les distàncies transversals del cap es mesuren amb el cun anterior (el
  // posterior només serveix per a la posició al llarg de la línia mitja)
  const objectiu = lateralCun * r.cun.cap
  let anterior = mig
  let recorregut = 0
  for (let graus = 0.5; graus <= 100; graus += 0.5) {
    const a = (graus * Math.PI) / 180
    const actual = c.pellDesDeFora(centre, u.clone().multiplyScalar(Math.cos(a)).addScaledVector(lat, Math.sin(a)))
    const pas = actual.distanceTo(anterior)
    if (recorregut + pas >= objectiu) return anterior.lerp(actual, (objectiu - recorregut) / pas)
    recorregut += pas
    anterior = actual
  }
  throw new Error('El cap no és prou ample per a aquesta distància')
}

/** Cap vist des de dins: pell a una alçada, girant `graus` des de davant cap al costat. */
export function capDesDeDins(c: CosMesurable, r: Referencies, costat: Costat, y: number, graus: number): Vector3 {
  const a = (graus * Math.PI) / 180
  return c.pell(v(0, y, r.centreCap.z), v(signe(costat) * Math.sin(a), 0, Math.cos(a)))
}

/** Angle (graus des de davant) d'un punt del cap respecte de l'eix vertical del cap. */
function angleCap(r: Referencies, p: Vector3): number {
  return (Math.atan2(Math.abs(p.x), p.z - r.centreCap.z) * 180) / Math.PI
}

/** Punt del cap entre A i B, interpolant alçada i angle (segueix la pell, no la corda). */
export function capInterpolat(c: CosMesurable, r: Referencies, costat: Costat, a: Vector3, b: Vector3, t: number): Vector3 {
  const y = a.y + (b.y - a.y) * t
  const graus = angleCap(r, a) + (angleCap(r, b) - angleCap(r, a)) * t
  return capDesDeDins(c, r, costat, y, graus)
}

/** Pell lateral del cap vista des de fora a una alçada i una profunditat (z). */
export function capLateral(c: CosMesurable, costat: Costat, y: number, z: number): Vector3 {
  return c.pellDesDeFora(v(0, y, z), v(signe(costat), 0, 0), 0.25)
}
