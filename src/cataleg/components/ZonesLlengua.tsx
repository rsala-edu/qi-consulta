// Zones de la llengua (vista de la doctora: la punta a baix i el costat
// esquerre de la persona a la dreta del dibuix). Es marquen tocant el dibuix o
// els xips de sota, que també fan d'alternativa accessible.

import { formatar, t } from '../../i18n/t'
import { Xip } from './Cataleg'
import { ZONES_LLENGUA } from '../exploracio'

const CONTORN = 'M100 252 C 42 252 22 196 22 132 C 22 62 46 14 100 14 C 154 14 178 62 178 132 C 178 196 158 252 100 252 Z'

/** Rectangles de cada zona (es retallen amb el contorn de la llengua) */
const FORMES: Record<string, string> = {
  arrel: 'M62 0 H138 V78 H62 Z',
  // El costat esquerre de la persona queda a la dreta del dibuix
  lateralD: 'M0 0 H62 V190 H0 Z',
  lateralE: 'M138 0 H200 V190 H138 Z',
  centre: 'M62 78 H138 V190 H62 Z',
  punta: 'M0 190 H200 V260 H0 Z',
}

export function ZonesLlengua({ valor, onCanviar, editable }: { valor: unknown; onCanviar(v: string[] | null): void; editable: boolean }) {
  const triades = new Set(Array.isArray(valor) ? (valor as string[]) : [])
  const tocar = (id: string) => {
    if (!editable) return
    const nova = triades.has(id) ? [...triades].filter((x) => x !== id) : [...triades, id]
    onCanviar(nova.length > 0 ? nova : null)
  }
  return (
    <div className="zones-llengua">
      <svg viewBox="0 0 200 260" className="dibuix-llengua" aria-hidden="true">
        <defs>
          <clipPath id="contorn-llengua">
            <path d={CONTORN} />
          </clipPath>
        </defs>
        <g clipPath="url(#contorn-llengua)">
          {ZONES_LLENGUA.map((z) => (
            <path key={z.id} d={FORMES[z.id]} className={`zona-llengua${triades.has(z.id) ? ' triada' : ''}`} onClick={() => tocar(z.id)} />
          ))}
        </g>
        <path d={CONTORN} className="contorn-llengua" />
        <text x="100" y="40" className="text-llengua">
          {t.cataleg.arrel}
        </text>
        <text x="100" y="236" className="text-llengua">
          {t.cataleg.punta}
        </text>
      </svg>
      <div className="xips" role="group" aria-label={t.cataleg.zonesLlengua}>
        {ZONES_LLENGUA.map((z) => (
          <Xip key={z.id} opcio={z} triat={triades.has(z.id)} disabled={!editable} onClick={() => tocar(z.id)} />
        ))}
      </div>
      {triades.size > 0 && <p className="detall">{formatar(t.cataleg.zonesTriades, { n: String(triades.size) })}</p>}
    </div>
  )
}
