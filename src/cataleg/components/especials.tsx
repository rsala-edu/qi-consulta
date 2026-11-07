// Els components propis dels camps especials, per a totes les pantalles que
// mostren catàlegs.

import type { Especials } from './Cataleg'
import { CodiCim } from './CodiCim'
import { PuntsPalpacio } from './PuntsPalpacio'
import { ZonesLlengua } from './ZonesLlengua'

export const ESPECIALS: Especials = {
  codiCim: ({ camp, valor, onCanviar, editable }) => (
    <CodiCim valor={valor} editable={editable} etiqueta={camp.ca} onCanviar={(v) => onCanviar(v ? { ...v } : null)} />
  ),
  zonesLlengua: ({ valor, onCanviar, editable }) => <ZonesLlengua valor={valor} editable={editable} onCanviar={onCanviar} />,
  puntsPalpacio: ({ valor, onCanviar, editable }) => <PuntsPalpacio valor={valor} editable={editable} onCanviar={onCanviar} />,
}
