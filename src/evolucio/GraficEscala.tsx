// Gràfic d'una escala sessió a sessió (etapa 3C), en SVG propi: una línia per
// sèrie, cadascuna amb el seu color, traç i forma de punt (no depèn només del
// color). A l'eix horitzontal, el número de sessió i la data. Cada sessió és
// una columna que es pot tocar (com a mínim 44 px si hi cap): el primer toc (o
// passar-hi el ratolí) mostra les dades; el segon obre la sessió.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { diaCurtMes, formatar, t } from '../i18n/t'
import { nombre } from './textos'

export type Forma = 'cercle' | 'quadrat' | 'triangle'

export interface SerieGrafic {
  id: string
  nom: string
  valors: readonly (number | null)[]
  forma: Forma
  /** Classe CSS amb el color i el traç (serie-principal, serie-2, serie-3) */
  classe: string
}

export interface ColumnaGrafic {
  numero: number
  dia: string
  sessioId: string | null
}

interface Props {
  titol: string
  columnes: readonly ColumnaGrafic[]
  series: readonly SerieGrafic[]
  min: number
  max: number
  /** Una marca petita a les sessions on ha canviat el tractament */
  marques?: readonly boolean[]
  /** Línies de més al globus de cada sessió (punts, retenció…) */
  detall?(i: number): ReactNode
  onObrir?(sessioId: string): void
  alcada?: number
}

const MARGE = { esquerra: 34, dreta: 18, dalt: 18, baix: 42 }
const ZONA_MINIMA = 44

export function GraficEscala({ titol, columnes, series, min, max, marques, detall, onObrir, alcada = 220 }: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [amplada, setAmplada] = useState(600)
  const [triat, setTriat] = useState<number | null>(null)
  // Si el darrer canvi de selecció ha estat del ratolí (el clic obre de seguida)
  const [perRatoli, setPerRatoli] = useState(false)

  useEffect(() => {
    const el = caixa.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const o = new ResizeObserver(([e]) => e && setAmplada(Math.max(200, Math.round(e.contentRect.width))))
    o.observe(el)
    return () => o.disconnect()
  }, [])

  const n = columnes.length
  const ample = amplada - MARGE.esquerra - MARGE.dreta
  const alt = alcada - MARGE.dalt - MARGE.baix
  const pas = n > 1 ? ample / (n - 1) : 0
  const x = (i: number) => (n > 1 ? MARGE.esquerra + i * pas : MARGE.esquerra + ample / 2)
  const y = (v: number) => MARGE.dalt + alt - ((v - min) / (max - min || 1)) * alt
  const zona = Math.max(ZONA_MINIMA, n > 1 ? pas : ample)
  const graella = [min, (min + max) / 2, max]
  const principal = series[0]

  const obrir = (i: number) => {
    const id = columnes[i]?.sessioId
    if (id && onObrir) onObrir(id)
  }
  const tocar = (i: number) => {
    if (triat === i || perRatoli) {
      obrir(i)
      return
    }
    setTriat(i)
  }
  const tecla = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (triat === i) obrir(i)
    else setTriat(i)
  }

  const valorsText = (i: number) =>
    series
      .map((s) => formatar(t.evolucio.valor, { nom: s.nom, n: s.valors[i] === null || s.valors[i] === undefined ? t.evolucio.senseValor : nombre(s.valors[i]!) }))
      .join(', ')

  return (
    <div className="grafic-escala" ref={caixa} onPointerLeave={(e) => e.pointerType === 'mouse' && setTriat(null)}>
      <svg width={amplada} height={alcada} viewBox={`0 0 ${amplada} ${alcada}`} role="group" aria-label={titol}>
        {/* Graella i eix vertical */}
        {graella.map((v) => (
          <g key={v} className="graella-grafic">
            <line x1={MARGE.esquerra} x2={amplada - MARGE.dreta} y1={y(v)} y2={y(v)} />
            <text x={MARGE.esquerra - 8} y={y(v)} dy="0.35em" textAnchor="end">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}
        {/* Eix horitzontal: S1 i la data */}
        {columnes.map((c, i) => (
          <g key={c.numero + c.dia} className={`eix-x${triat === i ? ' triat' : ''}`}>
            <text x={x(i)} y={alcada - MARGE.baix + 18} textAnchor="middle">
              {formatar(t.evolucio.sessioCurta, { n: String(c.numero) })}
            </text>
            <text x={x(i)} y={alcada - MARGE.baix + 34} textAnchor="middle" className="data-eix">
              {diaCurtMes(c.dia)}
            </text>
          </g>
        ))}
        {triat !== null && <line className="guia-grafic" x1={x(triat)} x2={x(triat)} y1={MARGE.dalt} y2={MARGE.dalt + alt} />}
        {/* Les línies (de l'última a la primera: la principal, al damunt) */}
        {[...series].reverse().map((s) => (
          <g key={s.id} className={`serie ${s.classe}`}>
            {trams(s.valors).map((tram, k) => (
              <polyline key={k} points={tram.map((i) => `${x(i)},${y(s.valors[i]!)}`).join(' ')} />
            ))}
            {s.valors.map((v, i) => (v === null ? null : <FormaPunt key={i} forma={s.forma} cx={x(i)} cy={y(v)} gran={triat === i} />))}
          </g>
        ))}
        {/* Canvis de tractament: un rombe petit sobre la línia principal */}
        {marques?.map((m, i) => {
          if (!m) return null
          const v = principal?.valors[i]
          const cy = (v === null || v === undefined ? MARGE.dalt + alt : y(v)) - 14
          return <path key={i} className="marca-canvi" d={`M${x(i)} ${cy - 5} l5 5 l-5 5 l-5 -5 z`} />
        })}
        {/* Zones de toc (una per sessió) */}
        {columnes.map((c, i) => (
          <rect
            key={`zona-${i}`}
            className="zona-toc"
            data-sessio={c.numero}
            x={x(i) - zona / 2}
            y={0}
            width={zona}
            height={alcada}
            tabIndex={0}
            role="button"
            aria-label={formatar(t.evolucio.puntGrafic, { n: String(c.numero), dia: diaCurtMes(c.dia), valors: valorsText(i) })}
            aria-pressed={triat === i}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return
              setPerRatoli(true)
              setTriat(i)
            }}
            onPointerDown={(e) => {
              if (e.pointerType !== 'mouse') setPerRatoli(false)
            }}
            onClick={() => tocar(i)}
            onFocus={(e) => {
              // Només amb el teclat (amb el dit, el focus arriba abans del clic i l'obriria de seguida)
              if (!e.currentTarget.matches(':focus-visible')) return
              setPerRatoli(false)
              setTriat(i)
            }}
            onKeyDown={(e) => tecla(e, i)}
          />
        ))}
      </svg>
      {triat !== null && columnes[triat] && (
        <div
          className="globus-grafic"
          role="status"
          // Al costat del punt (a la dreta, o a l'esquerra si no hi cap), per tapar-ne poc
          style={x(triat) + 200 < amplada ? { left: x(triat) + 16, top: 4 } : { right: amplada - x(triat) + 16, top: 4 }}
        >
          <strong>{formatar(t.evolucio.sessioDia, { n: String(columnes[triat].numero), dia: diaCurtMes(columnes[triat].dia) })}</strong>
          {series.map((s) => (
            <span key={s.id} className="linia-globus">
              <MostraSerie serie={s} />
              {formatar(t.evolucio.valor, { nom: s.nom, n: s.valors[triat] === null || s.valors[triat] === undefined ? '—' : nombre(s.valors[triat]!) })}
            </span>
          ))}
          {detall?.(triat)}
          {columnes[triat].sessioId && onObrir && (
            <span className="detall">{perRatoli ? t.evolucio.clicaObrir : t.evolucio.tocaObrir}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** Trams seguits de valors (una sessió sense valor talla la línia) */
function trams(valors: readonly (number | null)[]): number[][] {
  const r: number[][] = []
  let actual: number[] = []
  valors.forEach((v, i) => {
    if (v === null) {
      if (actual.length) r.push(actual)
      actual = []
    } else actual.push(i)
  })
  if (actual.length) r.push(actual)
  return r
}

function FormaPunt({ forma, cx, cy, gran }: { forma: Forma; cx: number; cy: number; gran?: boolean }) {
  const r = gran ? 6.5 : 4.5
  if (forma === 'quadrat') return <rect className="punt-serie" x={cx - r} y={cy - r} width={r * 2} height={r * 2} />
  if (forma === 'triangle') return <path className="punt-serie" d={`M${cx} ${cy - r * 1.2} L${cx + r * 1.1} ${cy + r * 0.8} L${cx - r * 1.1} ${cy + r * 0.8} Z`} />
  return <circle className="punt-serie" cx={cx} cy={cy} r={r} />
}

/** La mostra de la llegenda: un tros de línia amb la forma del punt */
export function MostraSerie({ serie }: { serie: Pick<SerieGrafic, 'forma' | 'classe'> }) {
  return (
    <svg className={`mostra-serie serie ${serie.classe}`} width="28" height="14" viewBox="0 0 28 14" aria-hidden="true">
      <polyline points="1,7 27,7" />
      <FormaPunt forma={serie.forma} cx={14} cy={7} />
    </svg>
  )
}
