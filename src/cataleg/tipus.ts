// Catàlegs clínics (etapa 3B): com es descriuen.
//
// Un catàleg és una llista de grups (Valoració, Exploració, Diagnòstic, ORL…);
// cada grup té seccions plegables i cada secció té camps. Gairebé tots els
// camps són opcions per tocar (xips de selecció simple o múltiple); cada
// secció té, a més, «Normal / sense alteracions» i «Altres / observacions».
//
// Tots els textos són en català; quan hi ha terme xinès, s'hi posa el pinyin i
// els caràcters (simplificats), i cada secció diu d'on surt (`ref`, fonts.ts).
// Els identificadors no es canvien mai: són el que es desa a les dades.

export type IdFont = 'oms-ist-2022' | 'cim11-tm1' | 'zyyxh-t157-2009' | 'mtc-diagnosi' | 'orl-clinica' | 'cim11-mms' | 'escala'

export interface TermeXines {
  pinyin?: string
  hanzi?: string
}

export interface Opcio extends TermeXines {
  id: string
  ca: string
}

interface CampBase extends TermeXines {
  id: string
  ca: string
  /** Explicació curta sota el nom */
  ajuda?: string
}

export interface CampOpcions extends CampBase {
  tipus: 'simple' | 'multiple'
  opcions: readonly Opcio[]
  /** Mostra el pinyin i els caràcters dins els xips (pols, llengua…) */
  xines?: boolean
}

export interface CampText extends CampBase {
  tipus: 'text' | 'textLlarg' | 'data'
}

export interface CampNombre extends CampBase {
  tipus: 'nombre'
  min: number
  max: number
  unitat?: string
}

/** Graella de caselles, cadascuna amb opcions múltiples (p. ex. el pols per posició) */
export interface CampGraella extends CampBase {
  tipus: 'graella'
  files: readonly Opcio[]
  columnes: readonly Opcio[]
  opcions: readonly Opcio[]
  xines?: boolean
}

/** Camps amb un component propi (dibuix de la llengua, audiograma, escales, codis…) */
export interface CampEspecial extends CampBase {
  tipus: 'especial'
  component: 'zonesLlengua' | 'audiograma' | 'escala' | 'codiCim' | 'sindromes' | 'mymop' | 'puntsPalpacio'
  /** Configuració del component (p. ex. quina escala) */
  config?: string
}

export type Camp = CampOpcions | CampText | CampNombre | CampGraella | CampEspecial

export interface Seccio extends TermeXines {
  /** Únic a tot el catàleg, amb el grup davant: «anamnesi:son» (sense punts: la sincronia camp a camp separa els camins per punts) */
  id: string
  ca: string
  ref: IdFont
  camps: readonly Camp[]
  /** Només si escau (p. ex. ginecologia) */
  nomesSi?: 'dona'
  /** Sense «Normal / sense alteracions» (p. ex. motiu de consulta) */
  senseNormal?: boolean
}

export interface Grup {
  id: string
  ca: string
  seccions: readonly Seccio[]
}

// --- Dades ------------------------------------------------------------------

/** El valor d'un camp: un id, una llista d'ids, un text, un nombre o un objecte (graella, audiograma) */
export type ValorCamp = string | number | readonly string[] | Readonly<Record<string, unknown>> | null

/** El que es desa d'una secció (només si s'ha tocat) */
export interface DadesSeccio {
  /** «Normal / sense alteracions» */
  normal?: boolean
  valors?: Readonly<Record<string, ValorCamp>>
  altres?: string
}

export type DadesSeccions = Readonly<Record<string, DadesSeccio>>
