// Xarxa de seguretat: si una part de la interfície peta en dibuixar-se, només
// cau aquella part (una pantalla, el visor 3D) i la resta de l'app continua.
// Es mostra un missatge tranquil·litzador amb un codi curt (UI-MAPA) per
// enviar-lo, i a la consola només hi va el nom de l'error, el component i la
// pila: mai el missatge, que podria portar dades d'un pacient.

import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n/t'
import { Boto } from './Boto'

interface Props {
  /** Codi curt per identificar on ha fallat (UI-MAPA, UI-COS3D…) */
  codi: string
  children: ReactNode
  /** Què es mostra al lloc de la part que ha fallat (per defecte, el missatge de pantalla) */
  alternativa?: ReactNode
  /** Si canvia (p. ex. la ruta), es torna a provar de dibuixar */
  clau?: string
}

interface Estat {
  error: boolean
}

/** El que es pot escriure a la consola d'un error, sense dades clíniques. */
export function resumError(codi: string, error: unknown, info: { componentStack?: string | null }) {
  const nom = error instanceof Error ? error.name : typeof error
  // La primera línia de la pila de V8 repeteix el missatge: fora
  const pila = error instanceof Error && error.stack ? error.stack.split('\n').filter((l) => /^\s+at\s/.test(l) || /^\S*@\S+:\d+:\d+$/.test(l)) : []
  const components = (info.componentStack ?? '')
    .split('\n')
    .map((l) => l.trim().match(/^(?:at\s+)?([A-Za-z0-9_$.]+)/)?.[1])
    .filter((x): x is string => !!x && x !== 'at')
  return { codi, nom, component: components[0] ?? '?', components: components.join(' < '), pila: pila.join('\n') }
}

export const textResum = (r: ReturnType<typeof resumError>) =>
  `[${r.codi}] ${r.nom} a ${r.component}\nComponents: ${r.components}\n${r.pila}`

export class LimitError extends Component<Props, Estat> {
  state: Estat = { error: false }

  static getDerivedStateFromError(): Estat {
    return { error: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(textResum(resumError(this.props.codi, error, info)))
  }

  componentDidUpdate(anteriors: Props) {
    if (this.state.error && anteriors.clau !== this.props.clau) this.setState({ error: false })
  }

  render() {
    if (!this.state.error) return this.props.children
    return this.props.alternativa ?? <ErrorPantalla codi={this.props.codi} />
  }
}

export function ErrorPantalla({ codi }: { codi: string }) {
  const [copiat, setCopiat] = useState(false)
  const e = t.errorPantalla
  return (
    <main className="pantalla-error">
      <div className="error-pantalla" role="alert">
        <p>{e.missatge}</p>
        <p className="codi-error">
          <span>{e.codi}: </span>
          <code>{codi}</code>
        </p>
        <div className="accions accions-esquerra">
          <Boto onClick={() => window.location.reload()}>{e.tornarCarregar}</Boto>
          <Boto
            variant="secundari"
            onClick={() =>
              void navigator.clipboard?.writeText(codi).then(
                () => setCopiat(true),
                () => setCopiat(false),
              )
            }
          >
            {copiat ? e.codiCopiat : e.copiarCodi}
          </Boto>
        </div>
      </div>
    </main>
  )
}
