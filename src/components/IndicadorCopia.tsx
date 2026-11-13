// Píndola de la barra superior amb l'estat de la còpia a Google Drive. Un toc
// obre un panell petit amb el motiu en paraules senzilles, l'hora de l'última
// còpia correcta i el botó que toca (tornar-ho a provar, tornar a entrar amb
// Google o desar ara). No ensenya mai cap dada clínica.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { diaDe, diaHoraDe } from '../domini/cita'
import { diaLlarg, faTemps, formatar, hora, t } from '../i18n/t'
import { ATRIBUT_CONNECTAR, useSincronia } from '../sincronia/ContextSincronia'
import { actualitzarApp } from '../sincronia/actualitzarApp'
import { diesSenseCopia, textSenseCopia } from '../sincronia/senseCopia'
import { Boto } from './Boto'
import { DetallsTecnics } from './DetallsTecnics'
import { BotoTornarConnectar } from './BotoTornarConnectar'
import { AvisRellotge } from './AvisRellotge'
import { useSessio } from '../sessio/ContextSessio'

function quan(iso: string): string {
  const d = new Date(iso)
  return `${diaLlarg(diaDe(d))}, ${hora(diaHoraDe(d))} (${faTemps(iso)})`
}

export function IndicadorCopia() {
  const {
    estat,
    pendent,
    pendents,
    nomesLectura,
    error,
    ultimaCopia,
    connectar,
    sincronitzarAra,
    provarCopiesAnteriors,
    senseCopiaDesDe,
    altreCompte,
    darreraCorrecta,
  } = useSincronia()
  const { canviarAlCompte } = useSessio()
  const [obert, setObert] = useState(false)
  const [provant, setProvant] = useState<'provant' | 'fet' | 'cap' | null>(null)
  const navigate = useNavigate()
  // Torna a mirar cada minut si ja fa més de 24 hores
  const [ara, setAra] = useState(() => Date.now())
  useEffect(() => {
    const i = window.setInterval(() => setAra(Date.now()), 60_000)
    return () => window.clearInterval(i)
  }, [])
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
  const dies = diesSenseCopia(senseCopiaDesDe, ara)
  const textPendents =
    pendents === 1 ? s.curt.unPendent : pendents > 1 ? formatar(s.curt.pendents, { n: String(pendents) }) : s.curt.pendent
  // Si cal tornar a connectar, és el que la doctora ha de fer: va per davant
  // dels dies sense còpia (que també surten a la pantalla Avui)
  const text = estat === 'cal-connectar'
    ? s.curt['cal-connectar']
    : dies
    ? textSenseCopia(dies)
    : nomesLectura
      ? s.curt.nomesLectura
      : senseConnexio
        ? s.curt.senseConnexio
        : estat === 'al-dia' && (pendent || pendents > 0)
          ? textPendents
          : s.curt[estat]
  // A la píndola, un text curt (amplada fixa: el menú no es mou quan canvia)
  const pc = s.pindola
  const curt = estat === 'cal-connectar'
    ? pc['cal-connectar']
    : dies
    ? pc.senseCopia
    : nomesLectura
      ? pc.nomesLectura
      : senseConnexio
        ? pc.senseConnexio
        : estat === 'al-dia' && (pendent || pendents > 0)
          ? pendents === 1
            ? pc.unPendent
            : pendents > 1
              ? formatar(pc.pendents, { n: String(pendents) })
              : pc.pendent
          : pc[estat]
  // El punt d'estat: verd (al dia), ambre (pujant o pendent), cinabri (cal fer alguna cosa)
  const punt =
    estat === 'al-dia' && !pendent && pendents === 0 && !dies && !nomesLectura
      ? 'be'
      : estat === 'sincronitzant' || (estat === 'al-dia' && !dies && !nomesLectura)
        ? 'pendent'
        : 'malament'
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
        className={`indicador-copia estat-${estat === 'cal-connectar' ? estat : dies ? 'sense-copia' : senseConnexio ? 'sense-connexio' : estat}`}
        title={text}
        aria-label={text}
        aria-expanded={obert}
        data-punt={punt}
        onClick={() => setObert((o) => !o)}
      >
        <svg className="nuvol-copia" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 9.1 4.5 4.5 0 0 0 7 18z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <circle className={`punt-copia ${punt}`} cx="18.5" cy="17.5" r="3.6" />
        </svg>
        <span className="text-copia">{curt}</span>
      </button>
      {obert && (
        <section className="panell-copia" aria-label={s.panell} role="dialog">
          <h2>{s.panell}</h2>
          {dies && <p className="avis-fort">{textSenseCopia(dies)}</p>}
          <p role="status">{missatge}</p>
          {nomesLectura && <p className="avis-fort">{s.nomesLectura}</p>}
          <AvisRellotge />
          {altreCompte && (
            <div className="avis-fort" role="alert">
              <p>{s.altreCompte}</p>
              <Boto variant="discret" onClick={() => void canviarAlCompte(altreCompte)}>
                {s.canviarAlCompte}
              </Boto>
            </div>
          )}
          {provant === 'fet' && <p role="status">{s.copiaAnteriorFeta}</p>}
          {provant === 'cap' && <p role="alert">{s.capCopiaAnterior}</p>}
          <p className="detall">
            {darreraCorrecta ? formatar(s.ultimaSincronia, { quan: quan(darreraCorrecta) }) : s.capCopia}
          </p>
          <p className="detall">{ultimaCopia ? formatar(s.ultimCanviDrive, { quan: quan(ultimaCopia) }) : s.capCanviDrive}</p>
          {estat === 'error' && error && error.motiu !== 'xarxa' && (
            <p className="detall">{formatar(s.codi, { codi: error.codi })}</p>
          )}
          <DetallsTecnics />
          <div className="accions accions-esquerra">
            {nomesLectura || (estat === 'error' && error?.motiu === 'versio') ? (
              <Boto onClick={() => void actualitzarApp()}>{s.actualitzarApp}</Boto>
            ) : estat === 'error' && error?.motiu === 'duplicades' ? (
              <Boto
                onClick={() => {
                  setObert(false)
                  void navigate('/pacients')
                }}
              >
                {s.revisarFitxes}
              </Boto>
            ) : estat === 'error' && error?.motiu === 'clau' ? (
              <Boto
                onClick={() => {
                  setObert(false)
                  void navigate('/ajustos/drive')
                }}
              >
                {s.veureOpcions}
              </Boto>
            ) : estat === 'error' && error?.motiu === 'danyada' ? (
              <Boto
                disabled={provant === 'provant'}
                onClick={() => {
                  setProvant('provant')
                  void provarCopiesAnteriors().then((b) => setProvant(b ? 'fet' : 'cap'))
                }}
              >
                {provant === 'provant' ? s.provantCopies : s.provarCopies}
              </Boto>
            ) : calGoogle ? (
              <Boto
                {...{ [ATRIBUT_CONNECTAR]: '' }}
                onClick={() => void connectar().then(() => setObert(false), () => {})}
              >
                {s.tornarGoogle}
              </Boto>
            ) : estat !== 'sincronitzant' ? (
              <Boto onClick={() => void sincronitzarAra()}>{estat === 'error' ? s.tornarHoAProvar : s.desarAra}</Boto>
            ) : null}
            {!calGoogle && <BotoTornarConnectar />}
            <Boto variant="discret" onClick={() => setObert(false)}>
              {s.tancar}
            </Boto>
          </div>
        </section>
      )}
    </div>
  )
}
