// Pestanya «Tractaments» de la fitxa del pacient (etapa 3A): els episodis,
// cadascun amb les seves sessions (data, escala i nombre de punts). Una sessió
// s'obre en lectura, o en edició si és dins les 24 hores. Un episodi es pot
// tancar amb un estat i una nota final.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { diaDe } from '../../domini/cita'
import { ESTATS_EPISODI, type Episodi, type EstatEpisodi } from '../../domini/episodi'
import { llistaPunts } from '../../domini/sessio'
import { diaLlarg, formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaTractaments() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const [episodis, sessions] = await Promise.all([magatzem.llistarEpisodis(pacient.id), magatzem.sessionsDelPacient(pacient.id)])
    return { episodis: [...episodis].reverse(), sessions }
  }, [magatzem, pacient.id, versio])
  const tr = t.tractaments

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>
  if (carrega.dades.episodis.length === 0) return <p className="buit">{tr.cap}</p>

  return (
    <section className="tractaments" aria-label={tr.titol}>
      {carrega.dades.episodis.map((e) => (
        <EpisodiAmbSessions
          key={e.id}
          episodi={e}
          sessions={carrega.dades.sessions.filter((s) => s.episodiId === e.id)}
          onCanviat={() => setVersio((n) => n + 1)}
        />
      ))}
    </section>
  )
}

function EpisodiAmbSessions({
  episodi,
  sessions,
  onCanviat,
}: {
  episodi: Episodi
  sessions: Awaited<ReturnType<ReturnType<typeof useMagatzem>['sessionsDelPacient']>>
  onCanviat(): void
}) {
  const magatzem = useMagatzem()
  const tr = t.tractaments
  const [tancant, setTancant] = useState(false)
  const [estat, setEstat] = useState<EstatEpisodi>('alta')
  const [nota, setNota] = useState('')
  const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...dades } = episodi
  return (
    <article className="panell episodi" aria-label={episodi.motiu}>
      <header className="capcalera-episodi">
        <h3>{episodi.motiu}</h3>
        <span className={`etiqueta etiqueta-episodi-${episodi.estat}`}>{tr.estats[episodi.estat]}</span>
        <span className="detall">{diaLlarg(episodi.dataInici)}</span>
      </header>
      {sessions.length === 0 ? (
        <p className="detall">{tr.capSessio}</p>
      ) : (
        <ol className="sessions-episodi">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link to={`/visita/${s.id}`}>{formatar(tr.sessio, { n: String(s.numero), dia: diaLlarg(diaDe(new Date(s.iniciAt))) })}</Link>
              <span className="detall">
                {s.comEsta.escala !== null && `${formatar(tr.escala, { n: String(s.comEsta.escala) })} · `}
                {formatar(tr.punts, { n: String(llistaPunts(s.punts).length) })}
                {s.estat === 'enCurs' && ` · ${tr.enCurs}`}
              </span>
            </li>
          ))}
        </ol>
      )}
      {episodi.estat !== 'actiu' ? (
        <p className="detall">
          {episodi.dataFinal && formatar(tr.tancat, { dia: diaLlarg(episodi.dataFinal) })}
          {episodi.notaFinal && ` · ${episodi.notaFinal}`}
        </p>
      ) : !tancant ? (
        <Boto variant="discret" onClick={() => setTancant(true)}>
          {tr.tancarEpisodi}
        </Boto>
      ) : (
        <div className="formulari tancar-episodi">
          <Camp etiqueta={tr.estatFinal}>
            <select value={estat} onChange={(e) => setEstat(e.target.value as EstatEpisodi)}>
              {ESTATS_EPISODI.filter((x) => x !== 'actiu').map((x) => (
                <option key={x} value={x}>
                  {tr.estats[x]}
                </option>
              ))}
            </select>
          </Camp>
          <Camp etiqueta={tr.notaFinal}>
            <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Camp>
          <div className="accions accions-esquerra">
            <Boto
              onClick={() =>
                void magatzem
                  .actualitzarEpisodi(episodi.id, { ...dades, estat, notaFinal: nota.trim(), dataFinal: diaDe(new Date()) })
                  .then(onCanviat)
              }
            >
              {tr.desarTancament}
            </Boto>
            <Boto variant="discret" onClick={() => setTancant(false)}>
              {t.app.cancellar}
            </Boto>
          </div>
        </div>
      )}
    </article>
  )
}
