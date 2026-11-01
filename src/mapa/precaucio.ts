// Text de la precaució a la fitxa del punt. La categoria ja surt a l'etiqueta
// («Precaució · Embaràs»), així que si la nota comença repetint-la
// («Embaràs: tradicionalment contraindicat.») se li treu el prefix.

import { normalitzar } from '../domini/cercaPacients'

export function notaSenseCategoria(nota: string, categories: readonly string[]): string {
  const m = /^([^:.]{1,40}):\s*(.+)$/s.exec(nota.trim())
  if (!m) return nota.trim()
  const prefix = normalitzar(m[1]!)
  const repetida = categories.some((c) => normalitzar(c.replace(/\s*\(.*\)$/, '')) === prefix)
  if (!repetida) return nota.trim()
  const resta = m[2]!
  return resta.charAt(0).toUpperCase() + resta.slice(1)
}
