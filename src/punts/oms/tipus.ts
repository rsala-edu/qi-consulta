import type { Vector3 } from 'three'
import type { CosMesurable, Costat } from './cos'
import type { Referencies, UnitatsCun } from './referencies'

export type RefVertical = 'melic' | 'basePatella' | 'malleolIntern' | 'malleolExtern' | 'plecPopliti'

export type Regla =
  /** A `cun` de `de` en direcció a `a`; tot el segment `de`–`a` fa `total` cun */
  | {
      tipus: 'segment'
      de: string
      a: string
      cun: number
      total: number
      /** Distància màxima a la línia (m) quan el punt n'és fora per definició; per defecte 2,5 cm */
      desviacio?: number
    }
  /** A `cun` per sobre (positiu) o per sota (negatiu) d'una referència i, si cal, a `lateral` cun de la línia mitja */
  | { tipus: 'vertical'; ref: RefVertical; cun: number; unitat: keyof UnitatsCun; lateral?: number }
  /** A la mateixa alçada que un altre punt */
  | { tipus: 'nivell'; com: string }
  /**
   * A l'esquena, a l'alçada d'una vertebra (a la depressió de sota l'apòfisi
   * espinosa si `sota`) i a `lateral` cun de la línia mitja
   */
  | { tipus: 'vertebra'; vertebra: string; sota: boolean; lateral: number }
  /** Al cap, a `cun` de la glabel·la sobre l'arc de la línia mitja i a `lateral` cun d'aquesta línia */
  | { tipus: 'cap'; cun: number; lateral: number }
  /** Sobre una referència anatòmica concreta (mugró, espai intercostal…) */
  | { tipus: 'referencia'; descripcio: string }

/** Accés als punts ja calculats (del mateix costat si no se'n diu cap) */
export type PuntCalculat = (codi: string, costat?: Costat | 'C') => Vector3

export interface DefinicioPunt {
  codi: string
  regla: Regla
  /** Una sola posició, costat «C» (línia mitja, o un punt únic com Jinjin) */
  mitja?: boolean
  /**
   * Punts amb un sol codi però diverses posicions per costat (Jiaji, Baxie,
   * Shixuan…): el nom de cada una. `calcular` rep l'índex.
   */
  subpunts?: readonly string[]
  /** Punt de la pell en aquest costat (per als de la línia mitja, el costat no compta) */
  calcular(c: CosMesurable, r: Referencies, costat: Costat, punt: PuntCalculat, index: number): Vector3
}

/** Seqüències que s'han de complir dins un meridià (les proves les comproven) */
export interface Ordre {
  codis: string[]
  /** «baixa»: cada punt més avall que l'anterior; «allunya»: cada punt més lluny del primer */
  criteri: 'baixa' | 'puja' | 'allunya'
}
