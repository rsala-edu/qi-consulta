import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router'
import { Indicador } from '../../components/Indicador'
import { nomComplet, type Pacient } from '../../domini/pacient'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

interface ContextFitxa {
  pacient: Pacient
  actualitzarPacient(p: Pacient): void
}

export function useFitxaPacient(): ContextFitxa {
  return useOutletContext<ContextFitxa>()
}

const p = t.fitxa.pestanyes
const PESTANYES_ACTIVES = [
  { ruta: 'dades', text: p.dades },
  { ruta: 'fitxa-clinica', text: p.fitxaClinica },
  { ruta: 'cites', text: p.cites },
] as const
const PESTANYES_FUTURES = [p.valoracions, p.sessions, p.evolucio]

export function PantallaFitxaPacient() {
  const { id = '' } = useParams()
  const magatzem = useMagatzem()
  const [carrega, substituir] = useCarrega(() => magatzem.obtenirPacient(id), [magatzem, id])

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/pacients">
        ← {t.pacients.titol}
      </Link>
      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && !carrega.dades && <p role="alert">{t.pacients.sensePacient}</p>}
      {carrega.estat === 'llest' && carrega.dades && (
        <>
          <h1>{nomComplet(carrega.dades)}</h1>
          {carrega.dades.arxivat && <p className="avis">{t.fitxa.avisArxivat}</p>}
          <nav className="pestanyes" aria-label={nomComplet(carrega.dades)}>
            {PESTANYES_ACTIVES.map(({ ruta, text }) => (
              <NavLink key={ruta} to={ruta} className="pestanya">
                {text}
              </NavLink>
            ))}
            {PESTANYES_FUTURES.map((text) => (
              <span key={text} className="pestanya desactivada" aria-disabled="true" title={t.fitxa.properament}>
                {text}
              </span>
            ))}
          </nav>
          <Outlet context={{ pacient: carrega.dades, actualitzarPacient: substituir } satisfies ContextFitxa} />
        </>
      )}
    </main>
  )
}
