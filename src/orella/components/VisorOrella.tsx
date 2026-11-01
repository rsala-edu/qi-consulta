// Dibuix interactiu de l'orella: zones de l'estàndard, punts, zoom (roda cap
// al cursor, dos dits a la tauleta), desplaçament arrossegant, toc per triar
// un punt i, en mode correcció, toc o arrossegament per moure'l.

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { t } from '../../i18n/t'
import { colocarEtiquetes, type EtiquetaColocada } from '../../mapa/etiquetes'
import { COLOR_ANELL, COLOR_NEUTRE, COLOR_VORA } from '../../mapa/aspecteMarcador'
import { NOMS_ZONES } from '../cataleg'
import { CONTORN, NOM_ZONA, POLIGONS, RELLEU, SUBDIVISIONS, ZONES_ORELLA, camiArrodonit, camiRecte } from '../dibuix'
import {
  ampliar,
  aPantalla,
  centrar,
  desDePantalla,
  desplacar,
  mirallX,
  unitatsPerPixel,
  viewBox,
  VISTA_INICIAL,
  type CostatOrella,
  type Mida,
  type Vista,
} from '../vista'

export interface PuntDibuix {
  id: string
  /** Posició sobre el dibuix de l'orella esquerra */
  x: number
  y: number
  /** Color de la tècnica, si està marcat */
  color?: string
  destacat?: boolean
  etiqueta: string
  etiquetaLlarga: string
}

export interface ControlOrella {
  ampliar(): void
  reduir(): void
  restablir(): void
  /** Amplia i centra un punt del dibuix (coordenades de l'orella esquerra) */
  anarA(x: number, y: number): void
}

interface Props {
  costat: CostatOrella
  punts: readonly PuntDibuix[]
  /** Què fa un toc: triar un punt o posar-hi el punt que es corregeix */
  modeToc: 'punt' | 'posicio'
  onTocarPunt?(id: string): void
  onTocarPosicio?(p: { x: number; y: number }): void
  /** Id del punt que es pot arrossegar (correcció) */
  arrossegable?: string | null
  onArrossegar?(p: { x: number; y: number }): void
  ref?: Ref<ControlOrella>
}

/** Mides dels marcadors a la pantalla (px), com al cos */
const RADI = { neutre: 4, marcat: 6.5, vora: 1.6, anell: 11, gruixAnell: 3 }
const MOVIMENT_MAXIM_TOC = 8
const RADI_SELECCIO = 22
const COLOR_PELL = '#ead9c9'
const COLOR_RELLEU = '#f1e5d8'
const COLOR_CLOT = '#dcc6b3'
const COLOR_LINIA = '#9c8270'

export function VisorOrella({ ref, costat, punts, modeToc, onTocarPunt, onTocarPosicio, arrossegable, onArrossegar }: Props) {
  const contenidor = useRef<HTMLDivElement>(null)
  const [mida, setMida] = useState<Mida>({ amplada: 600, alcada: 800 })
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL)
  const id = useId().replace(/:/g, '')
  const vistaRef = useRef(vista)
  const midaRef = useRef(mida)

  useImperativeHandle(ref, () => ({
    ampliar: () => setVista((v) => ampliar(v, midaRef.current, 1.5)),
    reduir: () => setVista((v) => ampliar(v, midaRef.current, 1 / 1.5)),
    restablir: () => setVista(VISTA_INICIAL),
    anarA: (x, y) => setVista((v) => centrar(v, mirallX(x, costat), y)),
  }))

  useEffect(() => {
    const el = contenidor.current
    if (!el) return
    const mesurar = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setMida({ amplada: r.width, alcada: r.height })
    }
    mesurar()
    const obs = new ResizeObserver(mesurar)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Punts en coordenades de pantalla del dibuix (amb el mirall de la dreta)
  const enPantalla = useMemo(() => punts.map((p) => ({ ...p, dx: mirallX(p.x, costat), dy: p.y })), [punts, costat])
  const enPantallaRef = useRef(enPantalla)

  // Gestos: roda, un dit (desplaçar o arrossegar el punt) i dos dits (zoom).
  // Els gestors llegeixen l'estat i les props d'ara a través de refs.
  const props = useRef({ modeToc, onTocarPunt, onTocarPosicio, arrossegable, onArrossegar, costat })
  useLayoutEffect(() => {
    vistaRef.current = vista
    midaRef.current = mida
    enPantallaRef.current = enPantalla
    props.current = { modeToc, onTocarPunt, onTocarPosicio, arrossegable, onArrossegar, costat }
  })

  useEffect(() => {
    const el = contenidor.current
    if (!el) return
    const dits = new Map<number, { x: number; y: number }>()
    let inici: { x: number; y: number } | null = null
    let mogut = false
    let arrossegant = false
    let distanciaDits = 0

    const local = (e: PointerEvent | WheelEvent) => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const aDibuix = (px: number, py: number) => {
      const d = desDePantalla(vistaRef.current, midaRef.current, px, py)
      return { x: mirallX(d.x, props.current.costat), y: d.y }
    }
    const mesProper = (px: number, py: number) => {
      let millor: { id: string; d: number } | null = null
      for (const p of enPantallaRef.current) {
        const s = aPantalla(vistaRef.current, midaRef.current, p.dx, p.dy)
        const d = Math.hypot(s.x - px, s.y - py)
        if (d <= RADI_SELECCIO && (!millor || d < millor.d)) millor = { id: p.id, d }
      }
      return millor?.id ?? null
    }

    const roda = (e: WheelEvent) => {
      e.preventDefault()
      const p = local(e)
      setVista((v) => ampliar(v, midaRef.current, Math.exp(-e.deltaY * 0.0015), p.x, p.y))
    }
    const baixar = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId)
      const p = local(e)
      dits.set(e.pointerId, p)
      if (dits.size === 1) {
        inici = p
        mogut = false
        const tocat = mesProper(p.x, p.y)
        arrossegant = props.current.arrossegable != null && tocat === props.current.arrossegable
      } else if (dits.size === 2) {
        const [a, b] = [...dits.values()]
        distanciaDits = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        mogut = true
        arrossegant = false
      }
    }
    const moure = (e: PointerEvent) => {
      const abans = dits.get(e.pointerId)
      if (!abans) return
      const p = local(e)
      dits.set(e.pointerId, p)
      if (inici && Math.hypot(p.x - inici.x, p.y - inici.y) > MOVIMENT_MAXIM_TOC) mogut = true
      if (dits.size === 2) {
        const [a, b] = [...dits.values()]
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y)
        if (distanciaDits > 0) setVista((v) => ampliar(v, midaRef.current, d / distanciaDits, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2))
        distanciaDits = d
        return
      }
      if (!mogut) return
      if (arrossegant) props.current.onArrossegar?.(aDibuix(p.x, p.y))
      else setVista((v) => desplacar(v, midaRef.current, p.x - abans.x, p.y - abans.y))
    }
    const aixecar = (e: PointerEvent) => {
      const p = local(e)
      const unSolDit = dits.size === 1
      dits.delete(e.pointerId)
      if (!unSolDit || mogut) return
      if (props.current.modeToc === 'posicio') props.current.onTocarPosicio?.(aDibuix(p.x, p.y))
      else {
        const tocat = mesProper(p.x, p.y)
        if (tocat) props.current.onTocarPunt?.(tocat)
      }
    }
    const cancellar = (e: PointerEvent) => dits.delete(e.pointerId)

    el.addEventListener('wheel', roda, { passive: false })
    el.addEventListener('pointerdown', baixar)
    el.addEventListener('pointermove', moure)
    el.addEventListener('pointerup', aixecar)
    el.addEventListener('pointercancel', cancellar)
    return () => {
      el.removeEventListener('wheel', roda)
      el.removeEventListener('pointerdown', baixar)
      el.removeEventListener('pointermove', moure)
      el.removeEventListener('pointerup', aixecar)
      el.removeEventListener('pointercancel', cancellar)
    }
  }, [])

  const u = unitatsPerPixel(vista, mida)
  const mirall = costat === 'D' ? 'translate(340,0) scale(-1,1)' : undefined

  // Etiquetes: amb l'orella sencera, els noms de les zones; en ampliar, els codis
  const etiquetes: EtiquetaColocada[] = useMemo(() => {
    if (vista.escala < 1.6) return []
    const llarga = vista.escala >= 3
    const entrades = enPantalla
      .map((p) => ({ p, s: aPantalla(vista, mida, p.dx, p.dy) }))
      .filter(({ s }) => s.x >= 0 && s.y >= 0 && s.x <= mida.amplada && s.y <= mida.alcada)
      .sort((a, b) => Number(Boolean(b.p.destacat)) - Number(Boolean(a.p.destacat)) || Number(Boolean(b.p.color)) - Number(Boolean(a.p.color)))
      .map(({ p, s }) => ({ id: p.id, x: s.x, y: s.y, text: llarga ? p.etiquetaLlarga : p.etiqueta, curt: p.etiqueta }))
    return colocarEtiquetes(entrades, mida.amplada, mida.alcada)
  }, [enPantalla, vista, mida])

  return (
    <div
      ref={contenidor}
      className="visor-orella"
      data-testid="visor-orella"
      data-costat={costat}
      data-escala={vista.escala.toFixed(2)}
      data-punts={punts.length}
    >
      <svg
        viewBox={viewBox(vista, mida)}
        width="100%"
        height="100%"
        role="img"
        aria-label={costat === 'E' ? t.orella.esquerra : t.orella.dreta}
      >
        <defs>
          {ZONES_ORELLA.map((z) => (
            <clipPath key={z} id={`${id}-${z}`}>
              {POLIGONS[z].map((pol, i) => (
                <path key={i} d={camiArrodonit(pol)} />
              ))}
            </clipPath>
          ))}
        </defs>
        <g transform={mirall}>
          <path d={camiArrodonit(CONTORN)} fill={COLOR_PELL} stroke="#8c7363" strokeWidth={1.2} />
          {ZONES_ORELLA.map((z) =>
            POLIGONS[z].map((pol, i) => (
              <path
                key={`${z}${i}`}
                data-zona={z}
                d={camiArrodonit(pol)}
                fill={RELLEU[z] ? COLOR_RELLEU : COLOR_CLOT}
                stroke="#b49a86"
                strokeWidth={0.8}
              />
            )),
          )}
          {ZONES_ORELLA.map((z) => (
            <g key={z} clipPath={`url(#${id}-${z})`}>
              {SUBDIVISIONS[z].map((l, i) => (
                <path key={i} d={camiRecte(l)} stroke={COLOR_LINIA} strokeWidth={0.7} strokeDasharray="3 2" fill="none" />
              ))}
            </g>
          ))}
        </g>
        {vista.escala < 1.6 &&
          ZONES_ORELLA.map((z) => {
            const { text, ancora } = NOM_ZONA[z]
            return (
              <line
                key={z}
                x1={mirallX(text[0], costat)}
                y1={text[1]}
                x2={mirallX(ancora[0], costat)}
                y2={ancora[1]}
                stroke={COLOR_LINIA}
                strokeWidth={0.6}
              />
            )
          })}
        {enPantalla.map((p) => {
          const marcat = p.color !== undefined
          const r = (marcat || p.destacat ? RADI.marcat : RADI.neutre) * u
          return (
            <g key={p.id} data-punt={p.id}>
              {p.destacat && (
                <circle cx={p.dx} cy={p.dy} r={RADI.anell * u} fill="none" stroke={COLOR_ANELL} strokeWidth={RADI.gruixAnell * u} />
              )}
              {(marcat || p.destacat) && <circle cx={p.dx} cy={p.dy} r={r + RADI.vora * u} fill={COLOR_VORA} />}
              <circle cx={p.dx} cy={p.dy} r={r} fill={p.color ?? COLOR_NEUTRE} />
            </g>
          )
        })}
      </svg>
      <div className="visor3d-etiquetes" aria-hidden="true">
        {vista.escala < 1.6 &&
          ZONES_ORELLA.map((z) => {
            const { text, costat: lloc } = NOM_ZONA[z]
            const s = aPantalla(vista, mida, mirallX(text[0], costat), text[1])
            // A l'orella dreta (mirall), el text va a l'altre costat de la línia
            const alineacio = lloc === 'sota' ? 'centre' : (lloc === 'esquerra') === (costat === 'E') ? 'dreta' : 'esquerra'
            return (
              <span
                key={z}
                className={`etiqueta-zona etiqueta-zona-${alineacio}`}
                style={{ transform: `translate(${s.x}px, ${s.y}px)` }}
              >
                {NOMS_ZONES[z]}
              </span>
            )
          })}
        {etiquetes.map((e) => (
          <span key={e.id} className="etiqueta-punt" style={{ transform: `translate(${e.esquerra}px, ${e.dalt}px)` }}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  )
}
