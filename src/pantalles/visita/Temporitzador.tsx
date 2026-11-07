// Temporitzador de retenció de les agulles, a la capçalera de la visita.
//
// - Abans de començar: els minuts (per defecte, 28, destacat en jade), amb + i −
//   de minut en minut, i el botó gran «Agulles posades: començar».
// - En marxa: el compte enrere, calculat a partir de l'hora d'inici (no amb un
//   comptador): si la pantalla de la tauleta s'apaga, en tornar continua bé. Si
//   el navegador ho permet, es demana que la pantalla no s'apagui (Wake Lock).
// - En acabar: la capçalera passa a cinabri, un avís suau i un so curt (si està
//   activat). Res de finestres que bloquegin la pantalla.

import { useEffect, useRef, useState } from 'react'
import { Boto } from '../../components/Boto'
import { formatTemps, tempsRestant, type DadesSessio } from '../../domini/sessio'
import { formatar, t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'

/** Un so curt i suau (sense cap fitxer: es genera amb Web Audio) */
export function soCurt(): void {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const guany = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 660
    guany.gain.setValueAtTime(0.0001, ctx.currentTime)
    guany.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05)
    guany.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
    osc.connect(guany).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 1.3)
    osc.onended = () => void ctx.close()
  } catch {
    // Sense so (navegador sense Web Audio): l'avís visual ja hi és
  }
}

type WakeLock = { release(): Promise<void> }

export function Temporitzador({
  retencio,
  minutsPerDefecte,
  ambSo,
  editable,
  onCanviar,
  onAcabada,
}: {
  retencio: DadesSessio['retencio']
  minutsPerDefecte: number
  ambSo: boolean
  editable: boolean
  onCanviar(r: DadesSessio['retencio']): void
  /** S'ha acabat (o ja ho estava en obrir): la capçalera canvia de color */
  onAcabada(acabada: boolean): void
}) {
  const [ara, setAra] = useState(() => Date.now())
  const restant = tempsRestant(retencio, ara)
  const enMarxa = restant !== null && restant > 0
  const acabada = restant !== null && restant <= 0
  const avisat = useRef<string | null>(null)

  // Només per dibuixar: el temps sempre surt de l'hora d'inici
  useEffect(() => {
    if (!enMarxa) return
    const i = window.setInterval(() => setAra(Date.now()), 500)
    return () => window.clearInterval(i)
  }, [enMarxa])

  // En tornar a la pestanya (la pantalla s'havia apagat), es torna a calcular de seguida
  useEffect(() => {
    const tornar = () => setAra(Date.now())
    document.addEventListener('visibilitychange', tornar)
    return () => document.removeEventListener('visibilitychange', tornar)
  }, [])

  // Mentre dura la retenció, l'app no es bloqueja per inactivitat
  const { suspendreBloqueig } = useSessio()
  const fi = retencio.iniciAt ? Date.parse(retencio.iniciAt) + retencio.minuts * 60_000 : null
  useEffect(() => {
    suspendreBloqueig(enMarxa ? fi : null)
    return () => suspendreBloqueig(null)
  }, [enMarxa, fi, suspendreBloqueig])

  // La pantalla no s'apaga mentre dura la retenció (si el navegador ho permet)
  useEffect(() => {
    if (!enMarxa) return
    let bloqueig: WakeLock | null = null
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLock> } }
    void nav.wakeLock?.request('screen').then(
      (b) => (bloqueig = b),
      () => {},
    )
    return () => void bloqueig?.release().catch(() => {})
  }, [enMarxa])

  useEffect(() => {
    onAcabada(acabada)
    // Un sol so per retenció, i només si s'ha acabat amb la visita oberta
    if (acabada && retencio.iniciAt && avisat.current !== retencio.iniciAt) {
      const ara2 = Date.now()
      const fa = ara2 - (Date.parse(retencio.iniciAt) + retencio.minuts * 60_000)
      if (ambSo && fa < 60_000) soCurt()
      avisat.current = retencio.iniciAt
    }
  }, [acabada, ambSo, onAcabada, retencio.iniciAt, retencio.minuts])

  const v = t.visita
  if (restant === null) {
    const perDefecte = retencio.minuts === minutsPerDefecte
    return (
      <div className="temporitzador" aria-label={v.retencio}>
        <div className="minuts-retencio">
          <Boto
            variant="discret"
            aria-label={v.menysMinut}
            disabled={!editable || retencio.minuts <= 1}
            onClick={() => onCanviar({ ...retencio, minuts: retencio.minuts - 1 })}
          >
            −
          </Boto>
          <output className={perDefecte ? 'per-defecte' : ''} aria-label={v.retencio}>
            {formatar(v.minuts, { n: String(retencio.minuts) })}
          </output>
          <Boto
            variant="discret"
            aria-label={v.mesMinut}
            disabled={!editable || retencio.minuts >= 120}
            onClick={() => onCanviar({ ...retencio, minuts: retencio.minuts + 1 })}
          >
            +
          </Boto>
        </div>
        <Boto className="boto-gran" disabled={!editable} onClick={() => onCanviar({ ...retencio, iniciAt: new Date().toISOString() })}>
          {v.comencarRetencio}
        </Boto>
      </div>
    )
  }
  return (
    <div className={`temporitzador${acabada ? ' acabada' : ''}`} role="timer" aria-label={v.retencio}>
      {acabada ? (
        <strong role="status">{v.acabada}</strong>
      ) : (
        <span>{formatar(v.queda, { temps: formatTemps(restant) })}</span>
      )}
    </div>
  )
}
