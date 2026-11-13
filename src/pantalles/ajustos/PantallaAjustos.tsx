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
          <Link to="/ajustos/agenda">
            <span className="nom">{t.ajustAgenda.titol}</span>
            <span className="detall">{t.ajustAgenda.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/visita">
            <span className="nom">{t.ajustVisita.titol}</span>
            <span className="detall">{t.ajustVisita.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/consulta">
            <span className="nom">{t.informes.consultaTitol}</span>
            <span className="detall">{t.informes.consultaDesc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/protocols">
            <span className="nom">{t.protocols.titol}</span>
            <span className="detall">{t.protocols.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/consentiments">
            <span className="nom">{t.consentiments.titol}</span>
            <span className="detall">{t.consentiments.ajustDesc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/catalegs">
            <span className="nom">{t.ajustCatalegs.titol}</span>
            <span className="detall">{t.ajustCatalegs.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/aparenca">
            <span className="nom">{t.aparenca.titol}</span>
            <span className="detall">{t.aparenca.desc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/precaucions">
            <span className="nom">{t.ajustos.precaucions}</span>
            <span className="detall">{t.ajustos.precaucionsDesc}</span>
          </Link>
        </li>
        <li>
          <Link to="/ajustos/quant-a">
            <span className="nom">{t.quantA.titol}</span>
            <span className="detall">{t.quantA.desc}</span>
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
