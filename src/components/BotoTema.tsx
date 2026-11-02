// Icona del tema a la barra superior (i, petita, a la pantalla d'entrada).
// Cada toc canvia de mode: Sistema → Clar → Fosc → Sistema.
// Icones SVG pròpies, de traç arrodonit com la resta de l'app.

import { formatar, t } from '../i18n/t'
import { temaSeguent, type Tema } from '../tema/tema'
import { useTema } from '../tema/useTema'

export function BotoTema({ petit = false }: { petit?: boolean }) {
  const [tema, canviar] = useTema()
  const etiqueta = formatar(t.tema.etiqueta, { tema: t.tema.noms[tema] })
  return (
    <button
      type="button"
      className={`boto-tema${petit ? ' petit' : ''}`}
      aria-label={etiqueta}
      title={etiqueta}
      data-tema={tema}
      onClick={() => canviar(temaSeguent(tema))}
    >
      <IconaTema tema={tema} />
    </button>
  )
}

export function IconaTema({ tema }: { tema: Tema }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tema === 'clar' && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.8" x2="12" y2="5" transform={`rotate(${a} 12 12)`} />
          ))}
        </>
      )}
      {tema === 'fosc' && <path d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1Z" />}
      {tema === 'sistema' && (
        <>
          {/* Meitat sol (esquerra) i meitat lluna (dreta), separats per l'eix */}
          <path d="M12 7.2a4.8 4.8 0 0 0 0 9.6" />
          {[225, 270, 315].map((a) => (
            <line key={a} x1="12" y1="2.4" x2="12" y2="4.4" transform={`rotate(${a} 12 12)`} />
          ))}
          <path d="M12 3.2a8.8 8.8 0 0 1 0 17.6a6 6.6 0 0 0 0-17.6Z" fill="currentColor" fillOpacity={0.18} />
          <line x1="12" y1="2.2" x2="12" y2="21.8" strokeOpacity={0.35} />
        </>
      )}
    </svg>
  )
}
