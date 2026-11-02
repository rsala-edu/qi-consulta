// Minicalendari del mes: saltar a qualsevol dia i marcar-lo com a tancat.
// A l'ordinador va a la columna lateral; a la tauleta, en un desplegable.

import { useState } from 'react'
import { diesMinicalendari, esLaborable, sumarMesos, type Horari } from '../../domini/agenda'
import { diaLlarg, formatar, mesAny, t } from '../../i18n/t'

/** dl. dt. dc. dj. dv. ds. dg. */
const CAPCALERA = [1, 2, 3, 4, 5, 6, 0].map((d) => t.dates.diesCurts[d]!.replace('.', ''))

interface Props {
  /** Dia triat (el que es veu a l'agenda) */
  dia: string
  avui: string
  /** Dies que es veuen ara (la setmana o el dia) */
  visibles: readonly string[]
  /** Dies amb alguna cita, per marcar-los amb un punt */
  ambCites: ReadonlySet<string>
  horari: Horari
  diesTancats: ReadonlySet<string>
  onTriar(dia: string): void
  onCanviarTancat(dia: string, tancat: boolean): void
}

export function Minicalendari({ dia, avui, visibles, ambCites, horari, diesTancats, onTriar, onCanviarTancat }: Props) {
  // El mes que es mira pot ser un altre que el del dia triat
  const [mes, setMes] = useState(dia)
  const [diaVist, setDiaVist] = useState(dia)
  if (dia !== diaVist) {
    setDiaVist(dia)
    setMes(dia)
  }
  const dies = diesMinicalendari(mes)
  const tancat = diesTancats.has(dia)

  return (
    <div className="minicalendari">
      <div className="minicalendari-capcalera">
        <button type="button" className="boto-rodo" aria-label={t.cites.mesAnterior} onClick={() => setMes(sumarMesos(mes, -1))}>
          ‹
        </button>
        <span className="minicalendari-mes">{mesAny(mes)}</span>
        <button type="button" className="boto-rodo" aria-label={t.cites.mesSeguent} onClick={() => setMes(sumarMesos(mes, 1))}>
          ›
        </button>
      </div>
      <div className="minicalendari-graella" role="grid" aria-label={t.cites.minicalendari}>
        {CAPCALERA.map((d) => (
          <span key={d} className="minicalendari-dia-setmana" aria-hidden="true">
            {d}
          </span>
        ))}
        {dies.map((d) => {
          const classes = [
            'minicalendari-dia',
            d.slice(0, 7) !== mes.slice(0, 7) && 'altre-mes',
            d === avui && 'avui',
            visibles.includes(d) && 'visible',
            d === dia && 'triat',
            (diesTancats.has(d) || !esLaborable(d, horari)) && 'tancat',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              className={classes}
              aria-label={`${diaLlarg(d)}${diesTancats.has(d) ? ` · ${t.cites.diaTancat}` : ''}`}
              aria-selected={d === dia}
              aria-current={d === avui ? 'date' : undefined}
              onClick={() => onTriar(d)}
            >
              {Number(d.slice(8))}
              {ambCites.has(d) && <span className="punt-cites" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
      <button type="button" className="enllac-tancat" onClick={() => onCanviarTancat(dia, !tancat)}>
        {formatar(tancat ? t.cites.obrirDia : t.cites.marcarTancat, { dia: diaLlarg(dia) })}
      </button>
    </div>
  )
}
