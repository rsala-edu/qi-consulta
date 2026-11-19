// «Desant…» / «Desat» amb una amplada fixa (la del text més llarg): en desar o
// sincronitzar, res del costat no es mou de lloc.

import { t } from '../i18n/t'

export function EstatDesat({ desant, pendent, desat = true, prefix = '', className = 'detall' }: { desant: boolean; pendent: boolean; desat?: boolean; prefix?: string; className?: string }) {
  const text = desant ? t.visita.desant : pendent || !desat ? '' : t.visita.desat
  const llarg = [t.visita.desant, t.visita.desat].sort((a, b) => b.length - a.length)[0]!
  return (
    <span className={`${className} estat-desat`} data-mida={`${prefix}${llarg}`} role="status">
      <span>{text && `${prefix}${text}`}</span>
    </span>
  )
}
