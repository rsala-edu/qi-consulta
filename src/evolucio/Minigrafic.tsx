// Minigràfic (sparkline) de l'escala principal a «Com està»: les sessions
// anteriors de l'episodi i, si ja s'ha apuntat, la d'avui (el punt final).

import { formatar, t } from '../i18n/t'

const AMPLE = 112
const ALT = 30
const MARGE = 4

export function Minigrafic({ valors, max = 10 }: { valors: readonly (number | null)[]; max?: number }) {
  const punts = valors.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null)
  if (punts.length < 2) return null
  const n = valors.length
  const x = (i: number) => MARGE + (n > 1 ? (i / (n - 1)) * (AMPLE - 2 * MARGE) : (AMPLE - 2 * MARGE) / 2)
  const y = (v: number) => MARGE + (1 - v / max) * (ALT - 2 * MARGE)
  const darrer = punts.at(-1)!
  return (
    <svg
      className="minigrafic"
      width={AMPLE}
      height={ALT}
      viewBox={`0 0 ${AMPLE} ${ALT}`}
      role="img"
      aria-label={formatar(t.evolucio.minigrafic, { valors: valors.map((v) => (v === null ? '—' : String(v))).join(', ') })}
    >
      <line className="base-minigrafic" x1={MARGE} x2={AMPLE - MARGE} y1={y(0)} y2={y(0)} />
      <polyline points={punts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />
      {punts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={p === darrer ? 3.5 : 2} className={p === darrer ? 'darrer' : undefined} />
      ))}
    </svg>
  )
}
