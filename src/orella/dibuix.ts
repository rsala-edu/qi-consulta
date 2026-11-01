// Dibuix de l'orella (cara lateral) amb les zones anatòmiques de l'estàndard
// xinès GB/T 13734-2008. Coordenades d'un quadre de 300 × 450: és l'orella
// ESQUERRA vista des del costat esquerre (la cara queda a l'esquerra del
// dibuix, el tragus a l'esquerra i l'hèlix a la dreta). La dreta és el mirall.
//
// Cada zona és un polígon (les proves comproven que cada punt és dins la
// seva); en pantalla els polígons es dibuixen arrodonits.

export type P = readonly [number, number]

export const AMPLADA_ORELLA = 300
export const ALCADA_ORELLA = 450

export const ZONES_ORELLA = ['HX', 'SF', 'AH', 'TF', 'TG', 'AT', 'CO', 'LO'] as const
export type ZonaOrella = (typeof ZONES_ORELLA)[number]

/** Relleus (hèlix, antihèlix, tragus, antitragus) i clots (escafa, fossa, conca) */
export const RELLEU: Record<ZonaOrella, boolean> = {
  HX: true,
  SF: false,
  AH: true,
  TF: false,
  TG: true,
  AT: true,
  CO: false,
  LO: true,
}

/** Contorn de l'orella (vora de fora de l'hèlix, el lòbul i el tragus) */
export const CONTORN: readonly P[] = [
  [80, 178], [74, 150], [76, 118], [88, 86], [108, 58], [136, 36], [170, 22], [206, 18], [238, 26], [262, 46],
  [278, 76], [285, 112], [285, 152], [281, 194], [272, 236], [260, 274], [248, 306], [240, 330], [243, 362],
  [238, 394], [222, 422], [196, 438], [164, 440], [136, 430], [116, 410], [106, 382], [106, 354], [104, 338],
  [94, 324], [80, 304], [71, 280], [69, 254], [73, 230], [82, 212], [84, 196],
]

/** Vora de dins de l'hèlix, de l'arrel (davant) fins a la cua (sobre el lòbul) */
const HELIX_DINS: readonly P[] = [
  [96, 170], [92, 148], [93, 118], [103, 90], [121, 64], [148, 46], [178, 38], [208, 36], [234, 44], [252, 62],
  [264, 90], [269, 124], [268, 160], [263, 200], [255, 240], [244, 278], [232, 310], [226, 326],
]

/** Rel de l'hèlix (HX1): la carena que entra dins la conca i la parteix en dues */
const REL_HELIX: readonly P[] = [
  [84, 178], [100, 172], [130, 180], [160, 196], [180, 212], [174, 221], [150, 213], [124, 203], [98, 197], [86, 193],
]

/** Antihèlix: arrel inferior, arrel superior i cos, fins a l'escotadura amb l'antitragus */
const ANTIHELIX: readonly P[] = [
  // arrel inferior, vora de sota (cap a la cimba), de l'encreuament cap endavant
  [222, 172], [196, 161], [160, 153], [126, 149], [102, 148],
  // punta de l'arrel inferior, sota l'hèlix
  [97, 138],
  // vora de dalt (cap a la fossa triangular), cap enrere
  [100, 128], [128, 124], [162, 126], [196, 134], [214, 142],
  // arrel superior, vora de davant (fossa), cap amunt
  [208, 118], [198, 92], [186, 66], [176, 44],
  // dalt, sota l'hèlix
  [190, 39], [205, 39],
  // arrel superior, vora de darrere (escafa), cap avall
  [210, 62], [220, 92], [230, 122], [238, 150],
  // cos, vora de darrere (escafa), cap avall
  [244, 180], [240, 220], [232, 258], [218, 292], [210, 306],
  // escotadura entre l'antihèlix i l'antitragus
  [202, 300],
  // cos, vora de davant (conca), cap amunt
  [194, 292], [206, 262], [216, 226], [222, 194],
]

const FOSSA_TRIANGULAR: readonly P[] = [
  [100, 128], [128, 124], [162, 126], [196, 134], [214, 142], [208, 118], [198, 92], [186, 66], [176, 44],
  [148, 48], [123, 65], [106, 89], [97, 112],
]

const ESCAFA: readonly P[] = [
  [205, 39], [234, 44], [252, 62], [264, 90], [269, 124], [268, 160], [263, 200], [255, 240], [244, 278],
  [232, 310], [218, 314], [210, 306], [218, 292], [232, 258], [240, 220], [244, 180], [238, 150], [230, 122],
  [220, 92], [210, 62],
]

/** Cimba de la conca (per sobre de la rel de l'hèlix) */
const CIMBA: readonly P[] = [
  [102, 148], [126, 149], [160, 153], [196, 161], [222, 172], [222, 194], [219, 204], [200, 208], [180, 212],
  [160, 196], [130, 180], [100, 172],
]

/** Cavitat de la conca (per sota de la rel de l'hèlix) */
const CAVITAT: readonly P[] = [
  [98, 197], [124, 203], [150, 213], [174, 221], [180, 212], [200, 208], [219, 204], [216, 226], [206, 262],
  [194, 292], [186, 298], [162, 304], [138, 311], [120, 318], [110, 318], [104, 306], [100, 280], [100, 250],
  [100, 222],
]

const TRAGUS: readonly P[] = [
  [84, 198], [98, 201], [100, 222], [100, 250], [100, 280], [104, 306], [110, 318], [108, 326], [94, 324],
  [80, 304], [71, 280], [69, 254], [73, 230], [82, 212],
]

const ANTITRAGUS: readonly P[] = [
  [120, 318], [138, 311], [162, 304], [186, 298], [194, 292], [202, 300], [210, 306], [208, 314], [188, 326],
  [162, 336], [136, 338], [118, 334],
]

const LOBUL: readonly P[] = [
  [118, 334], [136, 338], [162, 336], [188, 326], [208, 314], [218, 318], [226, 327], [240, 330], [243, 362],
  [238, 394], [222, 422], [196, 438], [164, 440], [136, 430], [116, 410], [106, 382], [106, 354], [104, 338],
]

/** Banda de l'hèlix: entre el contorn i la vora de dins, de l'arrel a la cua */
const HELIX: readonly P[] = [...CONTORN.slice(0, 18), ...[...HELIX_DINS].reverse()]

/** Polígons de cada zona (la conca té la cimba i la cavitat; l'hèlix, la banda i la rel) */
export const POLIGONS: Record<ZonaOrella, readonly (readonly P[])[]> = {
  HX: [HELIX, REL_HELIX],
  SF: [ESCAFA],
  AH: [ANTIHELIX],
  TF: [FOSSA_TRIANGULAR],
  TG: [TRAGUS],
  AT: [ANTITRAGUS],
  CO: [CIMBA, CAVITAT],
  LO: [LOBUL],
}

/**
 * Línies de les subdivisions de l'estàndard (es retallen dins la seva zona):
 * escafa en 6, antihèlix (arrels i cos), fossa triangular, tragus,
 * antitragus, conca i lòbul en 9.
 */
export const SUBDIVISIONS: Record<ZonaOrella, readonly (readonly P[])[]> = {
  HX: [
    // HX2–HX4 (de la rel a l'arrel inferior de l'antihèlix), HX5, HX6, HX7, HX8, HX9–HX12
    [[70, 170], [100, 168]],
    [[66, 156], [100, 155]],
    [[66, 142], [100, 141]],
    [[66, 128], [100, 128]],
    [[160, 10], [178, 44]],
    [[206, 8], [206, 42]],
    [[250, 70], [295, 70]],
    [[262, 118], [295, 118]],
    [[262, 172], [295, 172]],
    [[258, 226], [295, 226]],
    [[245, 280], [290, 280]],
  ],
  SF: [86, 132, 178, 224, 270].map((y) => [[200, y], [290, y]] as const),
  AH: [
    // arrel superior: terços (AH5, AH4) i el terç de dalt en AH3 i AH1/AH2
    [[200, 113], [250, 113]],
    [[180, 77], [240, 77]],
    [[170, 58], [230, 58]],
    [[193, 30], [193, 58]],
    // arrel inferior: dos terços de davant (AH6) i el de darrere (AH7)
    [[178, 110], [178, 170]],
    // cos: on comença, i les cinquenes parts (2/5, 2/5, 1/5)
    [[214, 168], [250, 168]],
    [[200, 222], [260, 222]],
    [[190, 276], [250, 276]],
    // quart de davant del cos (AH8, AH10, AH12), al llarg de la vora de la conca
    [[228, 168], [224, 226], [214, 262], [204, 296]],
  ],
  TF: [
    [[138, 30], [138, 140]],
    [[176, 30], [176, 140]],
    [[90, 88], [138, 88]],
    [[176, 112], [220, 112]],
  ],
  TG: [[[60, 260], [110, 260]]],
  AT: [
    [[152, 290], [152, 345]],
    [[180, 285], [180, 345]],
  ],
  CO: [
    // sota i sobre la rel de l'hèlix, en terços de davant a darrere
    [[115, 150], [115, 240]],
    [[147, 155], [147, 245]],
    // final de la rel: cimba i cavitat
    [[180, 212], [222, 204]],
    // part de darrere de la cimba (CO11, CO12)
    [[200, 160], [200, 208]],
  ],
  LO: [
    [[100, 372], [250, 372]],
    [[100, 406], [250, 406]],
    [[151, 330], [151, 445]],
    [[197, 320], [197, 445]],
  ],
}

/**
 * Nom de cada zona, fora del dibuix perquè no tapi cap punt: on va el text,
 * a quin costat del text queda l'orella i on apunta la línia guia.
 */
export const NOM_ZONA: Record<ZonaOrella, { text: P; costat: 'esquerra' | 'dreta' | 'sota'; ancora: P }> = {
  HX: { text: [300, 40], costat: 'dreta', ancora: [264, 50] },
  SF: { text: [300, 168], costat: 'dreta', ancora: [256, 168] },
  AH: { text: [300, 300], costat: 'dreta', ancora: [222, 282] },
  TF: { text: [40, 58], costat: 'esquerra', ancora: [128, 92] },
  CO: { text: [40, 190], costat: 'esquerra', ancora: [118, 230] },
  TG: { text: [40, 262], costat: 'esquerra', ancora: [80, 262] },
  AT: { text: [40, 352], costat: 'esquerra', ancora: [128, 330] },
  LO: { text: [176, 462], costat: 'sota', ancora: [176, 441] },
}

// --- Geometria ---------------------------------------------------------------------

export function dinsPoligon([x, y]: P, poligon: readonly P[]): boolean {
  let dins = false
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const [xi, yi] = poligon[i]!
    const [xj, yj] = poligon[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dins = !dins
  }
  return dins
}

/** Distància d'un punt a la vora d'un polígon */
export function distanciaVora([x, y]: P, poligon: readonly P[]): number {
  let minima = Infinity
  for (let i = 0, j = poligon.length - 1; i < poligon.length; j = i++) {
    const [ax, ay] = poligon[j]!
    const [bx, by] = poligon[i]!
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
    minima = Math.min(minima, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  return minima
}

export function dinsZona(p: P, zona: ZonaOrella): boolean {
  return POLIGONS[zona].some((poligon) => dinsPoligon(p, poligon))
}

/** Camí SVG tancat i arrodonit (Catmull-Rom) que passa pels vèrtexs */
export function camiArrodonit(punts: readonly P[], tensio = 0.5): string {
  const n = punts.length
  const at = (i: number) => punts[(i + n) % n]!
  let d = `M${at(0)[0]},${at(0)[1]}`
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = [p1[0] + ((p2[0] - p0[0]) * tensio) / 3, p1[1] + ((p2[1] - p0[1]) * tensio) / 3]
    const c2 = [p2[0] - ((p3[0] - p1[0]) * tensio) / 3, p2[1] - ((p3[1] - p1[1]) * tensio) / 3]
    d += ` C${c1[0]!.toFixed(1)},${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)},${c2[1]!.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return `${d} Z`
}

export function camiRecte(punts: readonly P[]): string {
  return punts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
}
