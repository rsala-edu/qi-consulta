// Avís si el rellotge d'aquest dispositiu va desfasat més de 2 minuts
// respecte de Google. Les dades no es perden (la sincronia fa servir un
// rellotge lògic, sincronia/hlc.ts), però convé posar-lo en hora. Surt a la
// pantalla Avui i al panell de la píndola, amb els altres avisos de la còpia.

import { formatar, t } from '../i18n/t'
import { useSincronia } from '../sincronia/ContextSincronia'

export const LIMIT_DESFAS = 2 * 60_000

export function AvisRellotge() {
  const { desfasMs } = useSincronia()
  if (desfasMs === null || Math.abs(desfasMs) <= LIMIT_DESFAS) return null
  const minuts = Math.round(Math.abs(desfasMs) / 60_000)
  const text = formatar(desfasMs > 0 ? t.app.rellotgeAvancat : t.app.rellotgeEndarrerit, { n: String(minuts) })
  return (
    <p className="panell avis-sense-copia" role="note">
      {text}
    </p>
  )
}
