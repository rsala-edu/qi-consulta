// Requadre de signatura amb el dit (o el ratolí): traç suau, «Tornar a
// signar», i el resultat en PNG (data URL). Es considera signat quan hi ha un
// traç prou llarg (un toc sol no compta).

import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { t } from '../i18n/t'

const LLARGADA_MINIMA = 40

export function Signatura({ etiqueta, onCanviar }: { etiqueta: string; onCanviar(png: string | null): void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const dibuixant = useRef<{ x: number; y: number } | null>(null)
  const llargada = useRef(0)
  const [buida, setBuida] = useState(true)

  // Resolució real (nítid a la tauleta) i tinta segons el tema
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const r = c.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(r.width * dpr)
    c.height = Math.round(r.height * dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // La signatura es desa sempre en tinta fosca (el PDF és blanc)
    ctx.strokeStyle = '#1f2421'
  }, [])

  const punt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const baixar = (e: PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dibuixant.current = punt(e)
  }
  const moure = (e: PointerEvent<HTMLCanvasElement>) => {
    const abans = dibuixant.current
    const ctx = canvas.current?.getContext('2d')
    if (!abans || !ctx) return
    const ara = punt(e)
    ctx.beginPath()
    ctx.moveTo(abans.x, abans.y)
    ctx.lineTo(ara.x, ara.y)
    ctx.stroke()
    llargada.current += Math.hypot(ara.x - abans.x, ara.y - abans.y)
    dibuixant.current = ara
  }
  const aixecar = () => {
    if (!dibuixant.current) return
    dibuixant.current = null
    if (llargada.current >= LLARGADA_MINIMA) {
      setBuida(false)
      onCanviar(canvas.current!.toDataURL('image/png'))
    }
  }
  const esborrar = () => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.restore()
    llargada.current = 0
    setBuida(true)
    onCanviar(null)
  }

  return (
    <div className="signatura">
      <span className="etiqueta-camp">{etiqueta}</span>
      <canvas
        ref={canvas}
        className="requadre-signatura"
        role="img"
        aria-label={`${etiqueta}${buida ? ` · ${t.consentiments.senseSignar}` : ` · ${t.consentiments.signat}`}`}
        data-signat={buida ? 'no' : 'si'}
        onPointerDown={baixar}
        onPointerMove={moure}
        onPointerUp={aixecar}
        onPointerCancel={aixecar}
      />
      <div className="accions accions-esquerra">
        <span className="detall">{buida ? t.consentiments.signaAqui : t.consentiments.signat}</span>
        <button type="button" className="boto boto-discret" onClick={esborrar} disabled={buida}>
          {t.consentiments.tornarASignar}
        </button>
      </div>
    </div>
  )
}
