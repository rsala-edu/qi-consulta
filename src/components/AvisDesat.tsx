import { t } from '../i18n/t'

/**
 * Mostra «Desat» cada cop que augmenta `marca`. El text s'esvaeix amb CSS:
 * la `key` torna a muntar l'element i reinicia l'animació.
 */
export function AvisDesat({ marca }: { marca: number }) {
  return (
    <span className="avis-desat" role="status" aria-live="polite">
      {marca > 0 && <span key={marca} className="avis-desat-text">{t.app.desat}</span>}
    </span>
  )
}
