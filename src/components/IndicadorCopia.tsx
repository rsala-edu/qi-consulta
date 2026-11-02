// Píndola de la barra superior amb l'estat de la còpia a Google Drive. Un toc
// obre un panell petit amb el motiu en paraules senzilles, l'hora de l'última
// còpia correcta i el botó que toca (tornar-ho a provar, tornar a entrar amb
// Google o desar ara). No ensenya mai cap dada clínica.

import { useEffect, useRef, useState } from 'react'
import { diaDe, diaHoraDe } from '../domini/cita'
import { diaLlarg, faTemps, formatar, hora, t } from '../i18n/t'
import { ATRIBUT_CONNECTAR, useSincronia } from '../sincronia/ContextSincronia'
import { Boto } from './Boto'

function quan(iso: string): string {
  const d = new Date(iso)
  return `${diaLlarg(diaDe(d))}, ${hora(diaHoraDe(d))} (${faTemps(iso)})`
}

export function IndicadorCopia() {
  const { estat, pendent, error, ultimaCopia, connectar, sincronitzarAra } = useSincronia()
  const [obert, setObert] = useState(false)
  const arrel = useRef<HTMLDivElement>(null)

  // Es tanca tocant fora o amb Escape
  useEffect(() => {
    if (!obert) return
    const fora = (e: PointerEvent) => {
      if (!arrel.current?.contains(e.target as Node)) setObert(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setObert(false)
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [obert])

  if (estat === 'sense-google') return null
  const s = t.sincronia
  const senseConnexio = estat === 'error' && error?.motiu === 'xarxa'
  const text = senseConnexio
    ? s.curt.senseConnexio
    : estat === 'al-dia' && pendent
      ? s.curt.pendent
      : s.curt[estat]
  const calGoogle = estat === 'cal-connectar' || error?.motiu === 'permis'
  const missatge =
    estat === 'error' && error
      ? s.motius[error.motiu]
      : estat === 'al-dia' && pendent
        ? s.estats.pendent
        : estat === 'error'
          ? s.motius.desconegut
          : s.estats[estat]

  return (
    <div className="indicador-copia-arrel" ref={arrel}>
      <button
        type="button"
        className={`indicador-copia estat-${senseConnexio ? 'sense-connexio' : estat}`}
        aria-expanded={obert}
        onClick={() => setObert((o) => !o)}
      >
        {text}
      </button>
      {obert && (
        <section className="panell-copia" aria-label={s.panell} role="dialog">
          <h2>{s.panell}</h2>
          <p role="status">{missatge}</p>
          <p className="detall">
            {ultimaCopia ? formatar(s.ultimaCorrecta, { quan: quan(ultimaCopia) }) : s.capCopia}
          </p>
          {estat === 'error' && error && error.motiu !== 'xarxa' && (
            <p className="detall">{formatar(s.codi, { codi: error.codi })}</p>
          )}
          <div className="accions accions-esquerra">
            {calGoogle ? (
              <Boto
                {...{ [ATRIBUT_CONNECTAR]: '' }}
                onClick={() => void connectar().then(() => setObert(false), () => {})}
              >
                {s.tornarGoogle}
              </Boto>
            ) : estat !== 'sincronitzant' ? (
              <Boto onClick={() => void sincronitzarAra()}>{estat === 'error' ? s.tornarHoAProvar : s.desarAra}</Boto>
            ) : null}
            <Boto variant="discret" onClick={() => setObert(false)}>
              {s.tancar}
            </Boto>
          </div>
        </section>
      )}
    </div>
  )
}
