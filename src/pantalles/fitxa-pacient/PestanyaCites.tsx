// Pestanya Cites de la fitxa del pacient: la pròxima cita, el recompte de
// visites i l'historial (data, tipus, estat i sessió).

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { diaDe, fiDe, novaCita, properaCita, recompteCites, diaHoraDe, type Cita } from '../../domini/cita'
import { diaLlarg, formatar, hora, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { FormulariCita } from '../cites/FormulariCita'
import { useFitxaPacient } from './PantallaFitxaPacient'

type Obert = { tipus: 'nova' } | { tipus: 'editar'; cita: Cita } | null

/** Proposta per a una cita nova: demà a les 10 */
function propostaInici(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${diaDe(d)}T10:00`
}

export function PestanyaCites() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [versio, setVersio] = useState(0)
  const [obert, setObert] = useState<Obert>(null)
  const [ara] = useState(() => diaHoraDe(new Date()))
  const [carrega] = useCarrega(async () => {
    const [cites, pacients] = await Promise.all([magatzem.llistarCites('0000', '9999'), magatzem.llistarPacients()])
    return { cites, pacients }
  }, [magatzem, pacient.id, versio])

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>

  const { cites: totes, pacients } = carrega.dades
  const cites = totes.filter((c) => c.pacientId === pacient.id)
  const propera = properaCita(cites, ara)
  const recompte = recompteCites(cites)
  const historial = [...cites].sort((a, b) => b.inici.localeCompare(a.inici))
  const desat = () => {
    setObert(null)
    setVersio((n) => n + 1)
  }

  return (
    <section className="pestanya-cites">
      <div className="capcalera-pantalla">
        <div>
          <h2>{t.cites.propera}</h2>
          <p>
            {propera
              ? `${diaLlarg(propera.inici)}, ${hora(propera.inici)}–${hora(fiDe(propera))} · ${t.cites.tipusNoms[propera.tipus]}`
              : t.cites.capPropera}
          </p>
        </div>
        {!obert && <Boto onClick={() => setObert({ tipus: 'nova' })}>{t.cites.novaCita}</Boto>}
      </div>
      <p className="detall" role="status">
        {formatar(t.cites.recompte, {
          fetes: String(recompte.fetes),
          anullades: String(recompte.anullades),
          noPresentat: String(recompte.noPresentat),
        })}
      </p>

      {obert && (
        <section
          className="panell"
          aria-label={obert.tipus === 'nova' ? t.cites.novaCita : t.cites.editar}
        >
          <h3>{obert.tipus === 'nova' ? t.cites.novaCita : t.cites.editar}</h3>
          <FormulariCita
            key={obert.tipus === 'nova' ? 'nova' : obert.cita.id}
            id={obert.tipus === 'editar' ? obert.cita.id : undefined}
            inicial={obert.tipus === 'nova' ? novaCita(pacient.id, propostaInici(), cites.length === 0 ? 'primera' : 'seguiment') : obert.cita}
            pacients={pacients}
            pacientFix
            altres={totes}
            onCancellar={() => setObert(null)}
            onDesar={async (dades) => {
              if (obert.tipus === 'nova') await magatzem.crearCita(dades)
              else await magatzem.actualitzarCita(obert.cita.id, dades)
              desat()
            }}
            onEsborrar={
              obert.tipus === 'editar'
                ? async () => {
                    await magatzem.esborrarCita(obert.cita.id)
                    desat()
                  }
                : undefined
            }
          />
        </section>
      )}

      <h2>{t.cites.historial}</h2>
      {historial.length === 0 ? (
        <p className="buit">{t.cites.capCita}</p>
      ) : (
        <ul className="llista-cites" aria-label={t.cites.historial}>
          {historial.map((c) => (
            <li key={c.id} className={`estat-${c.estat}`}>
              <div className="dades-cita">
                <span className="nom">
                  {diaLlarg(c.inici)}, {hora(c.inici)}
                </span>
                <span className="detall">
                  {t.cites.tipusNoms[c.tipus]}
                  {c.motiu && ` · ${c.motiu}`}
                </span>
              </div>
              <span className="etiqueta">{t.cites.estats[c.estat]}</span>
              <span className="detall">{c.sessioId ? t.cites.ambSessio : t.cites.senseSessio}</span>
              <div className="accions">
                <Boto variant="discret" onClick={() => setObert({ tipus: 'editar', cita: c })}>
                  {t.cites.editar}
                </Boto>
                <Link className="boto boto-discret" to={`/agenda?dia=${c.inici.slice(0, 10)}&vista=dia`}>
                  {t.cites.veureAgenda}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
