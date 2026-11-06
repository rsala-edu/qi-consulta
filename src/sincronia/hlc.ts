// Rellotge lògic híbrid (HLC): una «hora» per a cada canvi que mai va enrere
// i que sempre és més gran que qualsevol canvi que aquest dispositiu ja ha
// vist, encara que el seu rellotge vagi endarrerit. Decideix què és «el més
// nou» en fusionar (docs/sincronia.md, 8.2).
//
// Format: «ttttttttttttt-cccc-node» (mil·lisegons en 13 xifres, comptador en
// base 36 i identificador del dispositiu i de la pestanya). Es pot comparar
// com un text.

export type Hlc = string

const RE = /^(\d{13})-([0-9a-z]{4})-(.+)$/

export interface PartsHlc {
  ms: number
  comptador: number
  node: string
}

export function llegirHlc(h: Hlc): PartsHlc | null {
  const m = RE.exec(h)
  return m ? { ms: Number(m[1]), comptador: parseInt(m[2]!, 36), node: m[3]! } : null
}

export function formatHlc({ ms, comptador, node }: PartsHlc): Hlc {
  return `${String(ms).padStart(13, '0')}-${comptador.toString(36).padStart(4, '0')}-${node}`
}

/** HLC d'una data del format d'abans (modificatAt): per migrar registres que no en tenen */
export function hlcDeData(iso: string | undefined, node = 'v1'): Hlc {
  const ms = iso ? Date.parse(iso) : NaN
  return formatHlc({ ms: Number.isFinite(ms) ? ms : 0, comptador: 0, node })
}

export const maxHlc = (a: Hlc | undefined | null, b: Hlc | undefined | null): Hlc | undefined =>
  !a ? (b ?? undefined) : !b ? a : a > b ? a : b

export class RellotgeHlc {
  private ultim: PartsHlc
  readonly node: string
  private readonly ara: () => number

  constructor(node: string, ultim: Hlc | null = null, ara: () => number = () => Date.now()) {
    this.node = node
    this.ara = ara
    this.ultim = (ultim && llegirHlc(ultim)) || { ms: 0, comptador: 0, node }
  }

  /** L'últim HLC que ha generat o vist */
  get actual(): Hlc {
    return formatHlc({ ...this.ultim, node: this.node })
  }

  /** Un HLC nou per a un canvi d'aquest dispositiu */
  nou(): Hlc {
    const ms = Math.max(this.ara(), this.ultim.ms)
    const comptador = ms === this.ultim.ms ? this.ultim.comptador + 1 : 0
    this.ultim = { ms, comptador, node: this.node }
    return formatHlc(this.ultim)
  }

  /** S'ha rebut un canvi d'un altre dispositiu: el rellotge avança fins a ell */
  veure(h: Hlc | undefined): void {
    const p = h ? llegirHlc(h) : null
    if (!p) return
    if (p.ms > this.ultim.ms || (p.ms === this.ultim.ms && p.comptador > this.ultim.comptador))
      this.ultim = { ms: p.ms, comptador: p.comptador, node: this.node }
  }
}
