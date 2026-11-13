// Pantalla d'inici: les cites del dia, en ordre, amb «Començar visita» a la
// següent; accessos ràpids; i l'estat de la còpia a Google Drive.

import { AvisRellotge } from '../../components/AvisRellotge'
import { useComencarVisita } from '../../consentiment/useComencarVisita'
import { useState } from 'react'
import { Link } from 'react-router'
import { EstatCopia } from '../../components/EstatCopia'
import { Indicador } from '../../components/Indicador'
import { diaDe, diaHoraDe, fiDe, sumarDies } from '../../domini/cita'
import { nomComplet } from '../../domini/pacient'
import { diaCurtAmbMes, diaLlarg, formatar, hora, t } from '../../i18n/t'
import { llegirAjustosVisita } from '../../db/ajustosVisita'
import { teClauRecuperacio, teEmpremta } from '../../sessio/claus'
import { useMagatzem, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useSincronia } from '../../sincronia/ContextSincronia'
import { diesSenseCopia, textSenseCopia } from '../../sincronia/senseCopia'

export function PantallaAvui() {
  const magatzem = useMagatzem()
  const { db } = useSessio()
  const [ara] = useState(() => new Date())
  const avui = diaDe(ara)
  const [carrega] = useCarrega(async () => {
    const [cites, anteriors, pacients, empremta, clau, ajustos] = await Promise.all([
      magatzem.llistarCites(avui, sumarDies(avui, 1)),
      magatzem.llistarCites('0000', avui),
      magatzem.llistarPacients(),
      teEmpremta(db),
      teClauRecuperacio(db),
      llegirAjustosVisita(db),
    ])
    // Les sessions dels pacients d'avui: per saber el número de sessió de cada seguiment
    const sessions = (await Promise.all([...new Set(cites.map((c) => c.pacientId))].map((p) => magatzem.sessionsDelPacient(p)))).flat()
    // Visites començades un altre dia que no s'han finalitzat
    const enCurs = anteriors.filter((c) => c.estat === 'enCurs' && c.inici < avui).sort((x, y) => x.inici.localeCompare(y.inici))
    return { cites, enCurs, pacients, empremta, clau, ajustos, sessions }
  }, [magatzem, db, avui])
  const [comencant, setComencant] = useState<string | null>(null)

  // «Començar visita»: abans, si cal, l'avís del consentiment d'acupuntura (4A)
  const visita = useComencarVisita()

  /** «Començar visita»: crea la sessió (o obre la que ja hi ha) i obre la pantalla de visita */
  async function comencar(citaId: string, minuts: number) {
    setComencant(citaId)
    try {
      await visita.comencar(citaId, minuts)
    } finally {
      setComencant(null)
    }
  }

  const a = t.avui
  return (
    <main className="pantalla pantalla-avui">
      <header className="capcalera-avui">
        <h1>{a.titol}</h1>
        <p className="dia-avui">{diaLlarg(avui)}</p>
      </header>

      {visita.dialeg}
      <AvisSenseCopia />
      <AvisRellotge />

      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && (
        <>
          {(!carrega.dades.empremta || !carrega.dades.clau) && (
            <section className="panell recordatori" aria-label={a.configurar}>
              <h2>{a.configurar}</h2>
              <ul>
                {!carrega.dades.empremta && <li>{a.activarEmpremta}</li>}
                {!carrega.dades.clau && <li>{a.imprimirClau}</li>}
              </ul>
              <Link className="boto boto-secundari" to="/ajustos/seguretat">
                {a.anarSeguretat}
              </Link>
            </section>
          )}

          {carrega.dades.enCurs.length > 0 && (
            <section
              className="panell avis-en-curs"
              aria-label={
                carrega.dades.enCurs.length === 1
                  ? a.senseFinalitzar.un
                  : formatar(a.senseFinalitzar.diverses, { n: String(carrega.dades.enCurs.length) })
              }
            >
              <h2>
                {carrega.dades.enCurs.length === 1
                  ? a.senseFinalitzar.un
                  : formatar(a.senseFinalitzar.diverses, { n: String(carrega.dades.enCurs.length) })}
              </h2>
              <ul>
                {carrega.dades.enCurs.map((c) => {
                  const p = carrega.dades.pacients.find((x) => x.id === c.pacientId)
                  return (
                    <li key={c.id}>
                      <span>{formatar(a.visitaDel, { nom: p ? nomComplet(p) : '—', dia: diaCurtAmbMes(c.inici), hora: hora(c.inici) })}</span>
                      <button
                        type="button"
                        className="boto boto-secundari"
                        disabled={comencant === c.id}
                        onClick={() => void comencar(c.id, carrega.dades.ajustos.minutsRetencio)}
                      >
                        {a.continuarVisita}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section aria-label={a.citesAvui}>
            <h2>{a.citesAvui}</h2>
            {carrega.dades.cites.length === 0 ? (
              <p className="buit">{a.capCita}</p>
            ) : (
              <ol className="cites-avui">
                {(() => {
                  const actives = carrega.dades.cites.filter((c) => c.estat !== 'anullada')
                  const seguent = actives.find((c) => c.estat === 'programada' && fiDe(c) > diaHoraDe(ara))
                  return carrega.dades.cites.map((c) => {
                    const p = carrega.dades.pacients.find((x) => x.id === c.pacientId)
                    const esSeguent = c.id === seguent?.id
                    const sessio = carrega.dades.sessions.find((s) => s.id === c.sessioId)
                    const numero = sessio?.numero ?? carrega.dades.sessions.filter((s) => s.episodiId === c.episodiId).length + 1
                    return (
                      <li key={c.id} className={`estat-${c.estat}${esSeguent ? ' seguent' : ''}`}>
                        <div className="cos-cita">
                          <p className="linia-cita">
                            <span className="hora">{hora(c.inici)}</span>
                            <Link className="nom" to={`/pacients/${c.pacientId}/cites`}>
                              {p ? nomComplet(p) : '—'}
                            </Link>
                          </p>
                          {c.motiu && <p className="motiu-cita">{c.motiu}</p>}
                          <p className="etiquetes-cita">
                            <span className={`etiqueta-tipus tipus-${c.tipus}`}>
                              {c.tipus === 'primera' ? t.cites.tipusNoms.primera : formatar(a.seguimentSessio, { n: String(numero) })}
                            </span>
                            <span className="durada">{formatar(a.minuts, { n: String(c.durada) })}</span>
                            {c.estat !== 'programada' && <span className={`etiqueta etiqueta-${c.estat}`}>{t.cites.estats[c.estat]}</span>}
                          </p>
                        </div>
                        {(esSeguent || c.estat === 'enCurs') && (
                          <button
                            type="button"
                            className="boto boto-principal"
                            disabled={comencant === c.id}
                            onClick={() => void comencar(c.id, carrega.dades.ajustos.minutsRetencio)}
                          >
                            {c.estat === 'enCurs' ? a.continuarVisita : a.comencarVisita}
                          </button>
                        )}
                      </li>
                    )
                  })
                })()}
              </ol>
            )}
          </section>
        </>
      )}

      <nav className="accessos" aria-label={a.accessos}>
        <Link className="boto boto-secundari" to="/pacients/nou">
          {a.nouPacient}
        </Link>
        <Link className="boto boto-secundari" to={`/agenda?dia=${avui}&vista=dia&nova=1`}>
          {a.novaCita}
        </Link>
        <Link className="boto boto-secundari" to="/pacients">
          {a.cerca}
        </Link>
      </nav>

      <EstatCopia />
    </main>
  )
}

/** Fa més de 24 hores seguides que no es pot fer cap còpia a Drive */
function AvisSenseCopia() {
  const { senseCopiaDesDe, error } = useSincronia()
  const [ara] = useState(() => Date.now())
  const dies = diesSenseCopia(senseCopiaDesDe, ara)
  if (!dies) return null
  const s = t.sincronia
  return (
    <section className="panell avis-sense-copia" role="alert" aria-label={textSenseCopia(dies)}>
      <p>
        <strong>{textSenseCopia(dies)}.</strong> {s.avisAvui}
      </p>
      {error && <p>{s.motius[error.motiu]}</p>}
      <Link to="/ajustos/drive">{s.veureQuePassa}</Link>
    </section>
  )
}
