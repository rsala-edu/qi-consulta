// Pantalla d'inici: les cites del dia, en ordre, amb «Començar visita» a la
// següent; accessos ràpids; i l'estat de la còpia a Google Drive.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { EstatCopia } from '../../components/EstatCopia'
import { Indicador } from '../../components/Indicador'
import { diaDe, diaHoraDe, fiDe, sumarDies } from '../../domini/cita'
import { nomComplet } from '../../domini/pacient'
import { diaLlarg, hora, t } from '../../i18n/t'
import { teClauRecuperacio, teEmpremta } from '../../sessio/claus'
import { useMagatzem, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

export function PantallaAvui() {
  const magatzem = useMagatzem()
  const { db } = useSessio()
  const navegar = useNavigate()
  const [ara] = useState(() => new Date())
  const avui = diaDe(ara)
  const [carrega] = useCarrega(async () => {
    const [cites, pacients, empremta, clau] = await Promise.all([
      magatzem.llistarCites(avui, sumarDies(avui, 1)),
      magatzem.llistarPacients(),
      teEmpremta(db),
      teClauRecuperacio(db),
    ])
    return { cites, pacients, empremta, clau }
  }, [magatzem, db, avui])

  const a = t.avui
  return (
    <main className="pantalla pantalla-avui">
      <div className="capcalera-pantalla">
        <div>
          <h1>{a.titol}</h1>
          <p className="detall dia-avui">{diaLlarg(avui)}</p>
        </div>
      </div>

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
                    return (
                      <li key={c.id} className={`estat-${c.estat}${esSeguent ? ' seguent' : ''}`}>
                        <span className="hora">
                          {hora(c.inici)}–{hora(fiDe(c))}
                        </span>
                        <span className="qui">
                          <Link to={`/pacients/${c.pacientId}/cites`}>{p ? nomComplet(p) : '—'}</Link>
                          <span className="detall">
                            {t.cites.tipusNoms[c.tipus]}
                            {c.motiu && ` · ${c.motiu}`}
                            {c.estat !== 'programada' && ` · ${t.cites.estats[c.estat]}`}
                          </span>
                        </span>
                        {esSeguent && (
                          <button
                            type="button"
                            className="boto boto-principal"
                            // Les sessions arriben a l'etapa 3: de moment obre la fitxa del pacient
                            onClick={() => navegar(`/pacients/${c.pacientId}/cites`)}
                          >
                            {a.comencarVisita}
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
