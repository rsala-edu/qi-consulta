// «Proposar la propera cita» des de la pestanya Tancar de la visita. El
// formulari s'obre a sobre de la visita, amb el pacient i l'episodi de la
// visita ja posats, i en desar es torna a Tancar amb una línia de
// confirmació: «Propera cita: dc. 18/11 a les 10:00 · Canviar».

import { useCallback, useState } from 'react'
import { Boto } from '../../components/Boto'
import { llegirDiesTancats, llegirHorari } from '../../db/agenda'
import { recalcularTipusVisita } from '../../db/tipusVisita'
import { diaDe, novaCita, sumarDies, type Cita, type DadesCita } from '../../domini/cita'
import { episodisActius } from '../../domini/episodi'
import type { Sessio } from '../../domini/sessio'
import { diaCurtAmbMes, formatar, hora, t } from '../../i18n/t'
import { useMagatzem, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useAvisTipus } from '../cites/AvisTipus'
import { FormulariCita } from '../cites/FormulariCita'

/** La primera cita programada del pacient després d'aquesta visita */
export function properaDespresDe(cites: readonly Cita[], pacientId: string, despresDe: string): Cita | undefined {
  return cites
    .filter((c) => c.pacientId === pacientId && c.estat === 'programada' && c.inici > despresDe)
    .sort((a, b) => a.inici.localeCompare(b.inici))[0]
}

export function ProperaCita({ sessio }: { sessio: Sessio }) {
  const magatzem = useMagatzem()
  const { db } = useSessio()
  const v = t.visita
  const [versio, setVersio] = useState(0)
  const [obert, setObert] = useState<'nova' | Cita | null>(null)
  const [avisTipus, mostrarAvisTipus] = useAvisTipus()
  const [carrega] = useCarrega(async () => {
    const [cites, pacients, horari, diesTancats] = await Promise.all([
      magatzem.llistarCites('0000', '9999'),
      magatzem.llistarPacients(),
      llegirHorari(db),
      llegirDiesTancats(db),
    ])
    return { cites, pacients, horari, diesTancats }
  }, [magatzem, db, versio])
  const carregarEpisodis = useCallback(
    async (pacientId: string) => episodisActius(await magatzem.llistarEpisodis(pacientId)),
    [magatzem],
  )
  if (carrega.estat !== 'llest') return null
  const { cites, pacients, horari, diesTancats } = carrega.dades

  // La cita d'aquesta visita: la propera, d'aquí a una setmana a la mateixa hora
  const citaVisita = cites.find((c) => c.id === sessio.citaId)
  const iniciVisita = citaVisita?.inici ?? diaDe(new Date(sessio.iniciAt)) + 'T' + new Date(sessio.iniciAt).toTimeString().slice(0, 5)
  const propera = properaDespresDe(cites, sessio.pacientId, iniciVisita)
  const proposta: DadesCita = {
    ...novaCita(sessio.pacientId, `${sumarDies(iniciVisita.slice(0, 10), 7)}T${iniciVisita.slice(11, 16)}`, 'seguiment'),
    episodiId: sessio.episodiId,
    durada: 40,
  }

  return (
    <div className="propera-cita">
      {avisTipus}
      {propera ? (
        <p role="status" className="confirmacio-cita">
          {formatar(v.properaCita, { dia: diaCurtAmbMes(propera.inici), hora: hora(propera.inici) })} ·{' '}
          <button type="button" className="enllac-en-linia" aria-label={v.canviarProperaCita} onClick={() => setObert(propera)}>
            {v.canviarCita}
          </button>
        </p>
      ) : (
        <div className="accions accions-esquerra">
          <Boto variant="secundari" onClick={() => setObert('nova')}>
            {v.proposarCita}
          </Boto>
        </div>
      )}

      {obert && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setObert(null)}>
          <section className="dialeg dialeg-cita" role="dialog" aria-modal="true" aria-label={obert === 'nova' ? v.proposarCita : v.canviarProperaCita}>
            <h2>{obert === 'nova' ? v.proposarCita : v.canviarProperaCita}</h2>
            <FormulariCita
              id={obert === 'nova' ? undefined : obert.id}
              inicial={obert === 'nova' ? proposta : obert}
              pacients={pacients}
              pacientFix
              carregarEpisodis={carregarEpisodis}
              altres={cites}
              horari={horari}
              diesTancats={diesTancats}
              onCancellar={() => setObert(null)}
              onDesar={async (dades) => {
                const desada = obert === 'nova' ? await magatzem.crearCita(dades) : await magatzem.actualitzarCita(obert.id, dades, obert)
                mostrarAvisTipus((await recalcularTipusVisita(magatzem, [sessio.pacientId])).filter((c) => c.id !== desada.id))
                setObert(null)
                setVersio((n) => n + 1)
              }}
            />
          </section>
        </div>
      )}
    </div>
  )
}
