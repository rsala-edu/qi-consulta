// Ajustos → Aparença: el tema, per si algú no troba la icona de la barra.

import { Link } from 'react-router'
import { Camp } from '../../components/Camp'
import { t } from '../../i18n/t'
import { TEMES, esTema } from '../../tema/tema'
import { useTema } from '../../tema/useTema'

export function PantallaAparenca() {
  const [tema, canviar] = useTema()
  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{t.aparenca.titol}</h1>
      <section className="panell" aria-label={t.aparenca.tema}>
        <h2>{t.aparenca.tema}</h2>
        <p className="detall">{t.aparenca.temaDesc}</p>
        <Camp etiqueta={t.aparenca.tema}>
          <select value={tema} onChange={(e) => esTema(e.target.value) && canviar(e.target.value)}>
            {TEMES.map((x) => (
              <option key={x} value={x}>
                {t.tema.opcions[x]}
              </option>
            ))}
          </select>
        </Camp>
      </section>
    </main>
  )
}
