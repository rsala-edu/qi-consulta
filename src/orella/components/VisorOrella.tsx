// Dibuix interactiu de l'orella: zones de l'estàndard, punts, zoom (roda cap
// al cursor, dos dits a la tauleta), desplaçament arrossegant, toc per triar
// un punt i, en mode correcció, toc o arrossegament per moure'l.

import { useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from 'react'
import { t } from '../../i18n/t'
import { colocarEtiquetes, type EtiquetaColocada } from '../../mapa/etiquetes'
import { COLOR_ANELL, COLOR_VORA, RADI_MARCAT, aspecteMarcador } from '../../mapa/aspecteMarcador'
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
  /** Les línies i els noms de les zones (amagats per defecte: botó «Mostrar zones») */
  zones?: boolean
  ref?: Ref<ControlOrella>
}

/** Mides dels marcadors a la pantalla (px), en la proporció del cos (aspecteMarcador) */
const PX_PER_RADI = 7 / RADI_MARCAT
const MOVIMENT_MAXIM_TOC = 8
const RADI_SELECCIO = 22
/** La pell, del mateix to que el cos (Visor3D) */
const COLOR_PELL = '#e9d8c8'
const COLOR_LINIA = '#9c8270'
/** Relleu: la conca, el més fons; l'escafa i la fossa, una mica; l'hèlix i l'antihèlix, clars */
const FONS_ZONA: Record<string, string> = { CO: 'conca', SF: 'clot', TF: 'clot' }

export function VisorOrella({ ref, costat, punts, modeToc, onTocarPunt, onTocarPosicio, arrossegable, onArrossegar, zones = false }: Props) {
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

  // Etiquetes: amb l'orella sencera, només les dels punts marcats i del
  // seleccionat (i els noms de les zones, si es mostren); en ampliar, totes
  const etiquetes: EtiquetaColocada[] = useMemo(() => {
    const sencera = vista.escala < 1.6
    const llarga = vista.escala >= 3
    const entrades = enPantalla
      .filter((p) => !sencera || p.color || p.destacat)
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
          {/* Volum: la llum ve de dalt a l'esquerra, com al cos */}
          <linearGradient id={`${id}-pell`} x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="#f0e2d5" />
            <stop offset="1" stopColor="#dfc9b6" />
          </linearGradient>
          <linearGradient id={`${id}-relleu`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#f6ebe1" />
            <stop offset="1" stopColor={COLOR_PELL} />
          </linearGradient>
          <radialGradient id={`${id}-clot`} cx="0.5" cy="0.5" r="0.7">
            <stop offset="0" stopColor="#d6bea9" />
            <stop offset="1" stopColor="#e2cdbb" />
          </radialGradient>
          <radialGradient id={`${id}-conca`} cx="0.45" cy="0.55" r="0.65">
            <stop offset="0" stopColor="#c3a690" />
            <stop offset="0.7" stopColor="#d3baa5" />
            <stop offset="1" stopColor="#dfc8b5" />
          </radialGradient>
          <filter id={`${id}-ombra`} x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="3" dy="5" stdDeviation="6" floodColor="#3b2a20" floodOpacity="0.22" />
          </filter>
        </defs>
        <g transform={mirall}>
          <path d={camiArrodonit(CONTORN)} fill={`url(#${id}-pell)`} stroke="#b89c88" strokeWidth={0.8} filter={`url(#${id}-ombra)`} />
          {ZONES_ORELLA.map((z) =>
            POLIGONS[z].map((pol, i) => (
              <path
                key={`${z}${i}`}
                data-zona={z}
                d={camiArrodonit(pol)}
                fill={`url(#${id}-${FONS_ZONA[z] ?? (RELLEU[z] ? 'relleu' : 'clot')})`}
                stroke={zones ? '#b49a86' : '#c8ae9a'}
                strokeOpacity={zones ? 1 : 0.55}
                strokeWidth={zones ? 0.8 : 0.6}
              />
            )),
          )}
          {zones &&
            ZONES_ORELLA.map((z) => (
              <g key={z} clipPath={`url(#${id}-${z})`}>
                {SUBDIVISIONS[z].map((l, i) => (
                  <path key={i} d={camiRecte(l)} stroke={COLOR_LINIA} strokeWidth={0.7} strokeDasharray="3 2" fill="none" />
                ))}
              </g>
            ))}
        </g>
        {zones &&
          vista.escala < 1.6 &&
          ZONES_ORELLA.map((z) => {
            const { text, ancora } = NOM_ZONA[z]
            return (
              <line
                key={z}
                x1={mirallX(text[0], costat)}
                y1={text[1]}
                x2={mirallX(ancora[0], costat)}
                y2={ancora[1]}
                stroke="var(--tinta-etiqueta-zona)"
                strokeOpacity={0.7}
                strokeWidth={0.6}
              />
            )
          })}
        {/* Els punts, com al cos: disc de color, vora blanca i, el seleccionat, anell de tinta */}
        {enPantalla.map((p) => {
          const a = aspecteMarcador({ color: p.color, destacat: p.destacat })
          const r = (px: number) => px * PX_PER_RADI * u
          return (
            <g key={p.id} data-punt={p.id}>
              {a.anell && <circle cx={p.dx} cy={p.dy} r={r(a.anell[1])} fill={COLOR_ANELL} />}
              {a.vora && <circle cx={p.dx} cy={p.dy} r={r(a.vora)} fill={COLOR_VORA} />}
              <circle cx={p.dx} cy={p.dy} r={r(a.radi)} fill={a.color} />
            </g>
          )
        })}
      </svg>
      <div className="visor3d-etiquetes" aria-hidden="true">
        {zones &&
          vista.escala < 1.6 &&
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
