// Audiometria tonal: llindars per freqüència i orella (250–8.000 Hz, via aèria
// i òssia) i l'audiograma estàndard (dB HL cap avall; O vermella i X blava per
// la via aèria de la dreta i l'esquerra; < i > per l'òssia), amb el PTA.

import { useId } from 'react'
import { formatar, t } from '../../i18n/t'

import { clauLlindar, FREQUENCIES, pta, VIES } from '../../domini/audiometria'

export { clauLlindar, pta }

type Llindars = Record<string, number>

const COLOR = { D: '#c0392b', E: '#1f63b5' }
const AMPLE = 360
const ALT = 300
const ESQ = 44
const DALT = 20
const x = (i: number) => ESQ + (i * (AMPLE - ESQ - 16)) / (FREQUENCIES.length - 1)
const y = (db: number) => DALT + ((db + 10) * (ALT - DALT - 24)) / 130

function Simbol({ orella, via, cx, cy }: { orella: 'D' | 'E'; via: 'aeria' | 'ossia'; cx: number; cy: number }) {
  const c = COLOR[orella]
  if (via === 'aeria' && orella === 'D') return <circle cx={cx} cy={cy} r={6} fill="none" stroke={c} strokeWidth={2} />
  if (via === 'aeria') return <path d={`M${cx - 6} ${cy - 6} L${cx + 6} ${cy + 6} M${cx + 6} ${cy - 6} L${cx - 6} ${cy + 6}`} stroke={c} strokeWidth={2} />
  const d = orella === 'D' ? `M${cx - 2} ${cy - 7} L${cx - 9} ${cy} L${cx - 2} ${cy + 7}` : `M${cx + 2} ${cy - 7} L${cx + 9} ${cy} L${cx + 2} ${cy + 7}`
  return <path d={d} fill="none" stroke={c} strokeWidth={2} />
}

export function GraficAudiograma({ llindars }: { llindars: Readonly<Llindars> }) {
  const a = t.audiograma
  return (
    <svg viewBox={`0 0 ${AMPLE} ${ALT}`} className="grafic-audiograma" role="img" aria-label={a.grafic}>
      {Array.from({ length: 14 }, (_, i) => -10 + i * 10).map((db) => (
        <g key={db}>
          <line x1={ESQ} x2={AMPLE - 16} y1={y(db)} y2={y(db)} className={db === 20 ? 'linia-normal' : 'linia-graella'} />
          <text x={ESQ - 6} y={y(db) + 4} className="text-audiograma" textAnchor="end">
            {db}
          </text>
        </g>
      ))}
      {FREQUENCIES.map((f, i) => (
        <g key={f}>
          <line x1={x(i)} x2={x(i)} y1={y(-10)} y2={y(120)} className="linia-graella" />
          <text x={x(i)} y={ALT - 6} className="text-audiograma" textAnchor="middle">
            {f >= 1000 ? `${f / 1000}k` : f}
          </text>
        </g>
      ))}
      {VIES.map((v) => {
        const punts = FREQUENCIES.map((f, i) => ({ i, db: llindars[clauLlindar(v.id, f)] })).filter((p) => p.db !== undefined) as { i: number; db: number }[]
        return (
          <g key={v.id} data-via={v.id}>
            {v.via === 'aeria' && punts.length > 1 && (
              <polyline points={punts.map((p) => `${x(p.i)},${y(p.db)}`).join(' ')} fill="none" stroke={COLOR[v.orella]} strokeWidth={1.5} />
            )}
            {punts.map((p) => (
              <Simbol key={p.i} orella={v.orella} via={v.via} cx={x(p.i)} cy={y(p.db)} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export function Audiograma({ valor, onCanviar, editable }: { valor: unknown; onCanviar(v: Llindars | null): void; editable: boolean }) {
  const llindars: Llindars = valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Llindars) : {}
  const id = useId()
  const a = t.audiograma
  const posar = (clau: string, text: string) => {
    const r = { ...llindars }
    const n = Number(text)
    if (text === '' || !Number.isFinite(n)) delete r[clau]
    else r[clau] = Math.max(-10, Math.min(120, Math.round(n / 5) * 5))
    onCanviar(Object.keys(r).length > 0 ? r : null)
  }
  const ptaD = pta(llindars, 'D_aeria')
  const ptaE = pta(llindars, 'E_aeria')
  return (
    <div className="audiograma">
      <div className="taula-audiograma">
        <table>
          <thead>
            <tr>
              <th scope="col">{a.hz}</th>
              {FREQUENCIES.map((f) => (
                <th key={f} scope="col">
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VIES.map((v) => (
              <tr key={v.id}>
                <th scope="row" style={{ color: COLOR[v.orella] }}>
                  {a.vies[v.id]}
                </th>
                {FREQUENCIES.map((f) => {
                  const clau = clauLlindar(v.id, f)
                  return (
                    <td key={f}>
                      <input
                        id={`${id}-${clau}`}
                        type="number"
                        inputMode="numeric"
                        step={5}
                        min={-10}
                        max={120}
                        aria-label={formatar(a.llindar, { via: a.vies[v.id], f: String(f) })}
                        value={llindars[clau] ?? ''}
                        disabled={!editable}
                        onChange={(e) => posar(clau, e.target.value)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GraficAudiograma llindars={llindars} />
      <p className="detall" role="status">
        {formatar(a.pta, { d: ptaD === null ? '—' : `${ptaD.toLocaleString('ca')} dB`, e: ptaE === null ? '—' : `${ptaE.toLocaleString('ca')} dB` })}
      </p>
    </div>
  )
}
