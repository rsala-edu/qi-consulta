import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { AvisAjuntada, type EstatAjuntades } from '../pacients/PantallaAjuntar'
import { Indicador } from '../../components/Indicador'
import { nomComplet, type Pacient } from '../../domini/pacient'
import { formatar, t } from '../../i18n/t'
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
  { ruta: 'tractaments', text: t.tractaments.titol },
  { ruta: 'consentiments', text: t.consentiments.titol },
  { ruta: 'fotos', text: t.fotos.titol },
] as const
const PESTANYES_FUTURES = [p.valoracions, p.evolucio]

export function PantallaFitxaPacient() {
  const { id = '' } = useParams()
  const magatzem = useMagatzem()
  const [desfet, setDesfet] = useState(0)
  const [carrega, substituir] = useCarrega(() => magatzem.obtenirPacient(id), [magatzem, id, desfet])
  // En arribar d'ajuntar dues fitxes: què s'hi ha mogut
  const ajuntades = (useLocation().state as EstatAjuntades | null)?.ajuntades
  const [desfetAra, setDesfetAra] = useState(false)

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
          {ajuntades && (
            <div className="avis avis-ajuntades" role="status">
              <p>
                {formatar(t.ajuntar.fetes, {
                  cites: String(ajuntades.cites),
                  episodis: String(ajuntades.episodis),
                  sessions: String(ajuntades.sessions),
                  addendes: String(ajuntades.addendes),
                })}
              </p>
              {ajuntades.citesRepetides > 0 && <p>{formatar(t.ajuntar.repetidesTretes, { n: String(ajuntades.citesRepetides) })}</p>}
            </div>
          )}
          {desfetAra && <p className="avis" role="status">{t.ajuntar.desfet}</p>}
          {carrega.dades.ajuntadaAmb && carrega.dades.ajuntadaAmb.desfetAt === null ? (
            <AvisAjuntada
              pacient={carrega.dades}
              onDesfet={() => {
                setDesfetAra(true)
                setDesfet((n) => n + 1)
              }}
            />
          ) : (
            carrega.dades.arxivat && <p className="avis">{t.fitxa.avisArxivat}</p>
          )}
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
