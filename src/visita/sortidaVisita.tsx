// Avís suau en sortir d'una visita que encara és en curs (sense finalitzar):
// «La visita continua en curs. La pots reprendre des d'Avui». La pantalla de
// visita l'avisa en desmuntar-se; el marc de l'app el mostra uns segons.

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { t } from '../i18n/t'

const ESDEVENIMENT = 'qi:sortida-visita-en-curs'
const DURADA = 7000

export function avisarSortidaVisita(): void {
  window.dispatchEvent(new Event(ESDEVENIMENT))
}

export function AvisSortidaVisita() {
  const [marca, setMarca] = useState(0)
  useEffect(() => {
    const sortida = () => setMarca((n) => n + 1)
    window.addEventListener(ESDEVENIMENT, sortida)
    return () => window.removeEventListener(ESDEVENIMENT, sortida)
  }, [])
  useEffect(() => {
    if (marca === 0) return
    const tmp = window.setTimeout(() => setMarca(0), DURADA)
    return () => window.clearTimeout(tmp)
  }, [marca])
  if (marca === 0) return null
  const a = t.visita.sortida
  return (
    <div className="avis-sortida-visita" role="status">
      <p>
        {a.text}
        <Link to="/avui" onClick={() => setMarca(0)}>
          {a.avui}
        </Link>
      </p>
      <button type="button" className="tancar-avis" aria-label={a.tancar} onClick={() => setMarca(0)}>
        ×
      </button>
    </div>
  )
}
