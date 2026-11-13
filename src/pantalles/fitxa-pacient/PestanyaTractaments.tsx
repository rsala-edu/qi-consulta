// Pestanya «Tractaments» de la fitxa del pacient (etapa 3A): els episodis,
// cadascun amb les seves sessions. Una sessió s'obre en lectura, o en edició
// si és dins les 24 hores. Un episodi es pot tancar amb un estat i una nota
// final. Etapa 3C: les sessions en una cronologia (amb «Comparar») i un
// apartat «Evolució» plegable, obert a l'episodi actiu; en tancar l'episodi
// es proposa un resum automàtic.

import { useState } from 'react'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { diaDe } from '../../domini/cita'
import { ESTATS_EPISODI, type Episodi, type EstatEpisodi } from '../../domini/episodi'
import { resumTancament } from '../../domini/evolucio'
import type { Sessio } from '../../domini/sessio'
import type { Valoracio } from '../../domini/valoracio'
import { CompararSessions } from '../../evolucio/CompararSessions'
import { Cronologia } from '../../evolucio/Cronologia'
import { Evolucio } from '../../evolucio/Evolucio'
import { textResumTancament } from '../../evolucio/resumTancament'
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
    // Per a l'evolució: les escales ORL de cada episodi i quines sessions tenen addendes
    const [valoracions, addendes] = await Promise.all([
      Promise.all(episodis.map((e) => magatzem.valoracionsDe(e.id))),
      Promise.all(sessions.map((s) => magatzem.addendesDe(s.id))),
    ])
    return {
      episodis: [...episodis].reverse(),
      sessions,
      valoracions: new Map(episodis.map((e, i) => [e.id, valoracions[i] ?? []])),
      addendes: new Set(sessions.filter((_, i) => (addendes[i]?.length ?? 0) > 0).map((s) => s.id)),
    }
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
          sessionsPacient={carrega.dades.sessions}
          valoracions={carrega.dades.valoracions.get(e.id) ?? []}
          addendes={carrega.dades.addendes}
          onCanviat={() => setVersio((n) => n + 1)}
        />
      ))}
    </section>
  )
}

function EpisodiAmbSessions({
  episodi,
  sessions,
  sessionsPacient,
  valoracions,
  addendes,
  onCanviat,
}: {
  episodi: Episodi
  sessions: Sessio[]
  sessionsPacient: Sessio[]
  valoracions: Valoracio[]
  addendes: ReadonlySet<string>
  onCanviat(): void
}) {
  const magatzem = useMagatzem()
  const tr = t.tractaments
  const ev = t.evolucio
  const [tancant, setTancant] = useState(false)
  const [comparant, setComparant] = useState(false)
  const [estat, setEstat] = useState<EstatEpisodi>('alta')
  const [nota, setNota] = useState('')
  const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...dades } = episodi
  const enCurs = new Set(sessions.filter((s) => s.estat === 'enCurs').map((s) => s.id))
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
        <section className="sessions-episodi" aria-label={ev.sessions}>
          <div className="capcalera-sessions">
            <h4>{ev.sessions}</h4>
            {sessions.length > 1 && (
              <Boto variant="secundari" aria-expanded={comparant} onClick={() => setComparant((x) => !x)}>
                {comparant ? ev.tancarComparacio : ev.comparar}
              </Boto>
            )}
          </div>
          {comparant && <CompararSessions sessions={sessions} />}
          <Cronologia sessions={sessions} addendes={addendes} enCurs={enCurs} />
        </section>
      )}
      <details className="apartat-evolucio" open={episodi.estat === 'actiu'}>
        <summary>
          <h4>{ev.titol}</h4>
        </summary>
        <Evolucio sessions={sessions} sessionsPacient={sessionsPacient} valoracions={valoracions} />
      </details>
      {episodi.estat !== 'actiu' ? (
        <p className="detall">
          {episodi.dataFinal && formatar(tr.tancat, { dia: diaLlarg(episodi.dataFinal) })}
          {episodi.notaFinal && ` · ${episodi.notaFinal}`}
        </p>
      ) : !tancant ? (
        <Boto
          variant="discret"
          onClick={() => {
            // Es proposa un resum a partir de les sessions (es pot editar)
            setNota((n) => n || textResumTancament(resumTancament(sessions)))
            setTancant(true)
          }}
        >
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
            <textarea rows={4} value={nota} onChange={(e) => setNota(e.target.value)} />
          </Camp>
          {sessions.length > 0 && <p className="detall">{ev.resumProposat}</p>}
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
