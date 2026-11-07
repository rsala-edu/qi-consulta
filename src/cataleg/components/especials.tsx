// Els components propis dels camps especials, per a totes les pantalles que
// mostren catàlegs.

import type { Especials } from './Cataleg'
import { CodiCim } from './CodiCim'
import { PuntsPalpacio } from './PuntsPalpacio'
import { Sindromes } from './Sindromes'
import { Audiograma } from './Audiograma'
import { Escala } from './Escala'
import type { IdEscala } from '../../domini/escales'
import { ZonesLlengua } from './ZonesLlengua'

export const ESPECIALS: Especials = {
  codiCim: ({ camp, valor, onCanviar, editable }) => (
    <CodiCim valor={valor} editable={editable} etiqueta={camp.ca} onCanviar={(v) => onCanviar(v ? { ...v } : null)} />
  ),
  zonesLlengua: ({ valor, onCanviar, editable }) => <ZonesLlengua valor={valor} editable={editable} onCanviar={onCanviar} />,
  puntsPalpacio: ({ valor, onCanviar, editable }) => <PuntsPalpacio valor={valor} editable={editable} onCanviar={onCanviar} />,
  audiograma: ({ valor, onCanviar, editable }) => <Audiograma valor={valor} editable={editable} onCanviar={onCanviar} />,
  escala: ({ camp, valor, onCanviar, editable }) => (
    <Escala id={(camp.config ?? 'thi') as IdEscala} valor={valor} editable={editable} onCanviar={(v) => onCanviar(v ? { ...v } : null)} />
  ),
  sindromes: ({ camp, valor, onCanviar, editable }) => (
    <Sindromes
      mode={camp.config === 'secundaries' ? 'secundaries' : 'principal'}
      etiqueta={camp.ca}
      valor={valor}
      editable={editable}
      onCanviar={(v) => onCanviar(v ? { ...v } : null)}
    />
  ),
}
