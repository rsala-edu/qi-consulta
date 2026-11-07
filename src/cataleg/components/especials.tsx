// Els components propis dels camps especials, per a totes les pantalles que
// mostren catàlegs.

import type { Especials } from './Cataleg'
import { CodiCim } from './CodiCim'
import { PuntsPalpacio } from './PuntsPalpacio'
import { Sindromes } from './Sindromes'
import { ZonesLlengua } from './ZonesLlengua'

export const ESPECIALS: Especials = {
  codiCim: ({ camp, valor, onCanviar, editable }) => (
    <CodiCim valor={valor} editable={editable} etiqueta={camp.ca} onCanviar={(v) => onCanviar(v ? { ...v } : null)} />
  ),
  zonesLlengua: ({ valor, onCanviar, editable }) => <ZonesLlengua valor={valor} editable={editable} onCanviar={onCanviar} />,
  puntsPalpacio: ({ valor, onCanviar, editable }) => <PuntsPalpacio valor={valor} editable={editable} onCanviar={onCanviar} />,
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
