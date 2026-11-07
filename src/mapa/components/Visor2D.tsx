// Mapa del cos en 2D (SVG), sense WebGL: quatre vistes (davant, darrere,
// esquerra i dreta) amb els punts projectats des del model 3D. Els mateixos
// marcadors, colors i tocs que el visor 3D; «anar a un punt» tria la vista
// des d'on es veu millor i hi amplia.

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import type { BufferGeometry } from 'three'
import { COLOR_ANELL, COLOR_VORA, aspecteMarcador } from '../aspecteMarcador'
import { t } from '../../i18n/t'
import { textEtiqueta } from '../etiquetaPunt'
import { colocarEtiquetes } from '../etiquetes'
import { esVeu, millorVista, projectar, silueta, type Punt2D } from '../projeccio2d'
import type { Vista } from '../camera'
import type { ControlVisor, MarcadorVisor } from './Visor3D'

interface Props {
  geometria: BufferGeometry
  marcadors: readonly MarcadorVisor[]
  /** Hi ha un meridià filtrat: tots els punts porten el codi */
  etiquetesSempre?: boolean
  onTocarMarcador?(id: string): void
  ref?: Ref<ControlVisor>
}

/** Radi mínim de toc, en píxels de pantalla */
const RADI_TOC_PX = 16
/** Alçada visible en ampliar cap a un punt (metres) */
const ALCADA_AMPLIADA = 0.55
const MARGE = 0.04

export function Visor2D({ geometria, marcadors, etiquetesSempre = false, onTocarMarcador, ref }: Props) {
  const [vista, setVista] = useState<Vista>('davant')
  /** Centre i alçada visible quan s'ha ampliat cap a un punt (null: tot el cos) */
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const [mida, setMida] = useState({ w: 400, h: 600 })

  useEffect(() => {
    const el = svg.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const o = new ResizeObserver(([e]) => e && setMida({ w: Math.max(1, e.contentRect.width), h: Math.max(1, e.contentRect.height) }))
    o.observe(el)
    return () => o.disconnect()
  }, [])

  // Una silueta per vista (es calcula només quan es fa servir)
  const siluetes = useRef(new Map<Vista, ReturnType<typeof silueta>>())
  const forma = useMemo(() => {
    let s = siluetes.current.get(vista)
    if (!s) {
      s = silueta(geometria, vista)
      siluetes.current.set(vista, s)
    }
    return s
  }, [geometria, vista])
  useEffect(() => siluetes.current.clear(), [geometria])

  useImperativeHandle(ref, () => ({
    anarA(punt, normal) {
      const v = millorVista(normal)
      setVista(v)
      setZoom(projectar(punt, v))
    },
    vista(v) {
      setVista(v)
      setZoom(null)
    },
    restablir() {
      setZoom(null)
    },
  }))

  const [x, y, w, h] = forma.caixa
  const caixa: [number, number, number, number] = zoom
    ? [zoom.x - ALCADA_AMPLIADA * 0.35, zoom.y - ALCADA_AMPLIADA / 2, ALCADA_AMPLIADA * 0.7, ALCADA_AMPLIADA]
    : [x - MARGE, y - MARGE, w + MARGE * 2, h + MARGE * 2]
  /** Metres per píxel (l'SVG s'ajusta per l'alçada o per l'amplada, la que limiti) */
  const mpp = Math.max(caixa[3] / mida.h, caixa[2] / mida.w)
  const ampliat = zoom !== null

  const visibles = useMemo(
    () =>
      marcadors
        .filter((m) => esVeu(m.normal, vista))
        .map((m) => ({ m, p: projectar(m.punt, vista) }))
        // Els marcats i el destacat, al damunt
        .sort((a, b) => Number(!!a.m.color || !!a.m.destacat) - Number(!!b.m.color || !!b.m.destacat)),
    [marcadors, vista],
  )

  // Etiquetes en píxels, col·locades sense trepitjar-se (com al 3D)
  const etiquetes = useMemo(() => {
    const ox = (mida.w - caixa[2] / mpp) / 2
    const oy = (mida.h - caixa[3] / mpp) / 2
    const entrades = visibles
      .filter(({ m }) => ampliat || etiquetesSempre || m.color || m.destacat)
      .map(({ m, p }) => {
        const text = textEtiqueta(m.etiquetes, ampliat ? 'pinyin' : 'codi')
        const a = aspecteMarcador(m)
        return {
          id: m.id,
          x: ox + (p.x - caixa[0]) / mpp,
          y: oy + (p.y - caixa[1]) / mpp,
          text: text?.text ?? '',
          curt: text?.curt,
          radi: Math.max(3, a.radi / mpp),
        }
      })
      // Primer el destacat i els marcats
      .sort((x, y) => Number(perId(y.id)) - Number(perId(x.id)))
    function perId(id: string) {
      const m = marcadors.find((q) => q.id === id)
      return !!m?.destacat || !!m?.color
    }
    return colocarEtiquetes(entrades.slice(0, 120), mida.w, mida.h)
  }, [visibles, ampliat, etiquetesSempre, mida, mpp, caixa, marcadors])

  return (
    <div className="visor2d" data-testid="visor2d" data-vista={vista} data-marcadors={visibles.length}>
      <svg
        ref={svg}
        viewBox={caixa.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${t.mapa.mapa2d} · ${t.mapa.vista[vista]}`}
      >
        <path className="silueta" d={forma.cami} />
        {visibles.map(({ m, p }) => (
          <Marcador key={m.id} m={m} p={p} mpp={mpp} onTocar={onTocarMarcador} />
        ))}
      </svg>
      <div className="visor3d-etiquetes" aria-hidden="true">
        {etiquetes.map((e) => (
          <span key={e.id} className="etiqueta-punt etiqueta-2d" style={{ transform: `translate(${e.esquerra}px, ${e.dalt}px)` }}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  )
}

function Marcador({
  m,
  p,
  mpp,
  onTocar,
}: {
  m: MarcadorVisor
  p: Punt2D
  mpp: number
  onTocar?(id: string): void
}) {
  const a = aspecteMarcador(m)
  // Mida mínima a la pantalla (amb el cos sencer, els punts serien massa petits)
  const escala = Math.max(1, (3 * mpp) / a.radi)
  return (
    <g className="marcador-2d" data-id={m.id} onClick={() => onTocar?.(m.id)}>
      <circle cx={p.x} cy={p.y} r={Math.max(RADI_TOC_PX * mpp, a.radi * escala)} fill="transparent" />
      {a.anell && <circle cx={p.x} cy={p.y} r={a.anell[1] * escala} fill={COLOR_ANELL} />}
      {a.vora && <circle cx={p.x} cy={p.y} r={a.vora * escala} fill={COLOR_VORA} />}
      <circle cx={p.x} cy={p.y} r={a.radi * escala} fill={a.color} />
    </g>
  )
}
