// «Començar visita» amb el consentiment (etapa 4A): si el pacient no té el
// consentiment d'acupuntura vigent, abans de començar surt un avís amb
// «Signar ara» o «Continuar igualment» (i això queda registrat a la sessió).
// Una visita que ja estava començada es reprèn sense preguntar.

import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Boto } from '../components/Boto'
import { estatDelTipus } from '../domini/consentiment'
import { nomComplet } from '../domini/pacient'
import { araIso } from '../domini/registre'
import type { DadesSessio } from '../domini/sessio'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'

const c = t.consentiments

export function useComencarVisita(): { comencar(citaId: string, minuts?: number): Promise<void>; dialeg: ReactNode } {
  const magatzem = useMagatzem()
  const navegar = useNavigate()
  const [pendent, setPendent] = useState<{ citaId: string; minuts?: number; pacientId: string; nom: string } | null>(null)

  const obrir = async (citaId: string, minuts: number | undefined, sense: boolean) => {
    const s = await magatzem.comencarVisita(citaId, minuts)
    if (sense) {
      const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...dades } = s
      await magatzem.actualitzarSessio(s.id, { ...(dades as DadesSessio), senseConsentiment: araIso() }, dades as DadesSessio)
    }
    void navegar(`/visita/${s.id}`)
  }

  async function comencar(citaId: string, minuts?: number) {
    if (await magatzem.sessioDeCita(citaId)) return obrir(citaId, minuts, false)
    const cita = await magatzem.obtenirCita(citaId)
    if (!cita) return
    const consentiments = await magatzem.consentimentsDe(cita.pacientId)
    if (estatDelTipus(consentiments, 'acupuntura') === 'vigent') return obrir(citaId, minuts, false)
    const pacient = await magatzem.obtenirPacient(cita.pacientId)
    setPendent({ citaId, minuts, pacientId: cita.pacientId, nom: pacient ? nomComplet(pacient) : '' })
  }

  const dialeg = pendent && (
    <div className="fons-dialeg">
      <section className="dialeg dialeg-consentiment" role="alertdialog" aria-modal="true" aria-label={c.faltaTitol}>
        <h2>{c.faltaTitol}</h2>
        <p>{formatar(c.faltaText, { nom: pendent.nom })}</p>
        <p className="detall">{c.continuarRegistre}</p>
        <div className="accions">
          <Boto onClick={() => void navegar(`/pacients/${pendent.pacientId}/consentiments/acupuntura/signar?tornar=/avui`)}>{c.signarAra}</Boto>
          <Boto
            variant="secundari"
            onClick={() => {
              const p = pendent
              setPendent(null)
              void obrir(p.citaId, p.minuts, true)
            }}
          >
            {c.continuarIgualment}
          </Boto>
          <Boto variant="discret" onClick={() => setPendent(null)}>
            {t.app.cancellar}
          </Boto>
        </div>
      </section>
    </div>
  )
  return { comencar, dialeg }
}
