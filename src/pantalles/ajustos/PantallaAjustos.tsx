import { Link } from 'react-router'
import { t } from '../../i18n/t'

export function PantallaAjustos() {
  return (
    <main className="pantalla">
      <h1>{t.ajustos.titol}</h1>
      <ul className="llista-pacients">
        <li>
          <Link to="/ajustos/seguretat">
            <span className="nom">{t.seguretat.titol}</span>
            <span className="detall">{t.seguretat.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/precaucions">
            <span className="nom">{t.ajustos.precaucions}</span>
            <span className="detall">{t.ajustos.precaucionsDesc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/calibratge">
            <span className="nom">{t.ajustos.calibratge}</span>
            <span className="detall">{t.ajustos.calibratgeDesc}</span>
          </Link>
        </li>
      </ul>
      <p className="buit">{t.ajustos.properament}</p>
    </main>
  )
}
