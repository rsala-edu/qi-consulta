// Temporitzador de retenció de les agulles, a la capçalera de la visita (el so,
// la pantalla de bloqueig i que la pantalla no s'apagui són a visita/retencio.tsx).
//
// - Abans de començar: els minuts (per defecte, 28, destacat en jade), amb + i −
//   de minut en minut, i el botó gran «Agulles posades: començar».
// - En marxa: el compte enrere, calculat a partir de l'hora d'inici (no amb un
//   comptador): si la pantalla de la tauleta s'apaga, en tornar continua bé. Si
//   el navegador ho permet, es demana que la pantalla no s'apagui (Wake Lock).
// - En acabar: la capçalera passa a cinabri, un avís suau i un so curt (si està
//   activat). Res de finestres que bloquegin la pantalla.

import { useEffect, useState } from 'react'
import { Boto } from '../../components/Boto'
import { formatTemps, tempsRestant, type DadesSessio } from '../../domini/sessio'
import { formatar, t } from '../../i18n/t'
import { useRetencio } from '../../visita/retencio'

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

export function Temporitzador({
  sessioId,
  retencio,
  minutsPerDefecte,
  editable,
  onCanviar,
  onAcabada,
}: {
  sessioId: string
  retencio: DadesSessio['retencio']
  minutsPerDefecte: number
  editable: boolean
  onCanviar(r: DadesSessio['retencio']): void
  /** S'ha acabat (o ja ho estava en obrir): la capçalera canvia de color */
  onAcabada(acabada: boolean): void
}) {
  const [ara, setAra] = useState(() => Date.now())
  const restant = tempsRestant(retencio, ara)
  const enMarxa = restant !== null && restant > 0
  const acabada = restant !== null && restant <= 0

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

  // La retenció en marxa es registra per a tota l'app (visita/retencio.tsx):
  // la pantalla de bloqueig la mostra i el so sona sigui on sigui l'app
  const { registrar, marcarVista } = useRetencio()
  useEffect(() => {
    if (retencio.iniciAt) registrar({ iniciAt: retencio.iniciAt, minuts: retencio.minuts, sessioId })
  }, [registrar, retencio.iniciAt, retencio.minuts, sessioId])

  useEffect(() => {
    onAcabada(acabada)
    // Es veu a la visita: ja no cal la franja de «ha acabat»
    if (acabada) marcarVista()
  }, [acabada, onAcabada, marcarVista])

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
