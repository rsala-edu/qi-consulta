// Visor del cos en 3D.
// - Gir només sobre l'eix vertical (angle polar fix), zoom amb dos dits o
//   la roda, desplaçament amb dos dits o el botó dret.
// - Botons de vista ràpida: Davant, Darrere, Esquerra, Dreta.
// - Marcadors de punts sobre la pell, amb etiquetes segons el zoom.
// - Toc (sense arrossegar) sobre la pell o sobre un marcador.
// Només es redibuixa quan canvia alguna cosa (frameloop="demand"), per
// estalviar bateria a la tauleta.

import { CameraControls, Line } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import CameraControlsImpl from 'camera-controls'
import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
  type RefObject,
} from 'react'
import { Box3, Group, Mesh, Raycaster, Vector2, Vector3, type BufferGeometry } from 'three'
import { t } from '../../i18n/t'
import { azimutMesProper, CAMERA, nivellEtiquetes, VISTES, vistaCapAlPunt, type Vista } from '../camera'
import { colocarEtiquetes, type EtiquetaColocada } from '../etiquetes'
import { mesProperAlToc, projectarVisibles, type ProjeccioPantalla } from '../seleccio'

export interface MarcadorVisor {
  id: string
  punt: Vector3
  normal: Vector3
  /** Color del marcador; si és undefined, color neutre (no marcat) */
  color?: string
  /** Text a zoom mitjà (codi) */
  etiqueta: string
  /** Text a molt zoom (codi i pinyin) */
  etiquetaLlarga: string
  destacat?: boolean
}

export interface TocPell {
  triangle: number
  punt: Vector3
}

export interface ControlVisor {
  anarA(punt: Vector3, normal: Vector3): void
  vista(v: Vista): void
  restablir(): void
}

interface Props {
  geometria: BufferGeometry
  marcadors: readonly MarcadorVisor[]
  /** Recorreguts de meridià per ressaltar (llistes de punts en ordre) */
  recorreguts?: readonly Vector3[][]
  /** Què fa un toc: col·locar sobre la pell o triar un marcador */
  modeToc: 'pell' | 'marcador'
  onTocarPell?(toc: TocPell): void
  onTocarMarcador?(id: string): void
  /** Id del marcador que es pot arrossegar sobre la pell (calibratge) */
  arrossegable?: string | null
  onArrossegar?(toc: TocPell): void
  ref?: Ref<ControlVisor>
}

const COLOR_PELL = '#e9d8c8'
/** Punts: vermell cinabri; el destacat, més fosc (i més gran) */
const COLOR_NEUTRE = '#b5432f'
const COLOR_DESTACAT = '#7e2a1c'
/** Recorregut del meridià: jade, suau, perquè els punts destaquin */
const COLOR_RECORREGUT = '#2f5d50'
const MOVIMENT_MAXIM_TOC = 8 // px
const RADI_SELECCIO = 28 // px

type ProjeccioMarcador = ProjeccioPantalla<string>

export function Visor3D({ ref, ...props }: Props) {
  const control = useRef<ControlVisor | null>(null)
  const [etiquetes, setEtiquetes] = useState<Etiqueta[]>([])

  useImperativeHandle(ref, () => ({
    anarA: (p, n) => control.current?.anarA(p, n),
    vista: (v) => control.current?.vista(v),
    restablir: () => control.current?.restablir(),
  }))

  return (
    <div className="visor3d" data-testid="visor3d" data-marcadors={props.marcadors.length} data-moviment="no">
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: CAMERA.fov, near: 0.02, far: 50, position: [0, CAMERA.alcadaInicial, CAMERA.distanciaInicial] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        fallback={<p className="avis">{t.mapa.senseWebgl}</p>}
      >
        <Escena {...props} control={control} onEtiquetes={setEtiquetes} />
      </Canvas>
      <div className="visor3d-etiquetes" aria-hidden="true">
        {etiquetes.map((e) => (
          <span key={e.id} className="etiqueta-punt" style={{ transform: `translate(${e.esquerra}px, ${e.dalt}px)` }}>
            {e.text}
          </span>
        ))}
      </div>
      <div className="visor3d-vistes" role="toolbar" aria-label={t.mapa.vistes}>
        {(Object.keys(VISTES) as Vista[]).map((v) => (
          <button key={v} type="button" className="boto boto-discret" onClick={() => control.current?.vista(v)}>
            {t.mapa.vista[v]}
          </button>
        ))}
        <button type="button" className="boto boto-discret" onClick={() => control.current?.restablir()}>
          {t.mapa.totElCos}
        </button>
      </div>
    </div>
  )
}

type Etiqueta = EtiquetaColocada

// memo: l'escena no s'ha de tornar a pintar quan només canvien les etiquetes
// (si no, cada fotograma provocaria un altre fotograma).
const Escena = memo(function Escena({
  geometria,
  marcadors,
  recorreguts = [],
  modeToc,
  onTocarPell,
  onTocarMarcador,
  arrossegable,
  onArrossegar,
  control,
  onEtiquetes,
}: Omit<Props, 'ref'> & {
  control: RefObject<ControlVisor | null>
  onEtiquetes(e: Etiqueta[]): void
}) {
  const controls = useRef<CameraControlsImpl>(null)
  const malla = useRef<Mesh>(null)
  const grupMarcadors = useRef<Group>(null)
  const { camera, size, invalidate } = useThree()

  // Configuració dels controls: gir horitzontal, zoom i desplaçament
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const A = CameraControlsImpl.ACTION
    c.minPolarAngle = CAMERA.polar
    c.maxPolarAngle = CAMERA.polar
    c.minDistance = CAMERA.distanciaMinima
    c.maxDistance = CAMERA.distanciaMaxima
    c.dollyToCursor = true
    c.smoothTime = 0.2
    c.draggingSmoothTime = 0.08
    c.mouseButtons.left = A.ROTATE
    c.mouseButtons.right = A.TRUCK
    c.mouseButtons.middle = A.DOLLY
    c.mouseButtons.wheel = A.DOLLY
    c.touches.one = A.TOUCH_ROTATE
    c.touches.two = A.TOUCH_DOLLY_TRUCK
    c.touches.three = A.NONE
    c.setBoundary(new Box3(new Vector3(...CAMERA.limits.min), new Vector3(...CAMERA.limits.max)))
    void c.setLookAt(0, CAMERA.alcadaInicial, CAMERA.distanciaInicial, 0, CAMERA.alcadaInicial, 0, false)
  }, [])

  // data-moviment al contenidor: «si» mentre la càmera es mou, «no» quan s'atura.
  // Ho fan servir les proves (i no provoca cap render de React).
  const glEl = useThree((s) => s.gl.domElement)
  useEffect(() => {
    const c = controls.current
    const visor = glEl.closest<HTMLElement>('.visor3d')
    if (!c || !visor) return
    const moure = () => (visor.dataset.moviment = 'si')
    const aturar = () => (visor.dataset.moviment = 'no')
    c.addEventListener('transitionstart', moure)
    c.addEventListener('controlstart', moure)
    c.addEventListener('sleep', aturar)
    return () => {
      c.removeEventListener('transitionstart', moure)
      c.removeEventListener('controlstart', moure)
      c.removeEventListener('sleep', aturar)
    }
  }, [glEl])

  useImperativeHandle(control, () => ({
    anarA(punt, normal) {
      const c = controls.current
      if (!c) return
      const { camera: cam, objectiu } = vistaCapAlPunt(punt, normal, c.azimuthAngle)
      void c.setLookAt(cam.x, cam.y, cam.z, objectiu.x, objectiu.y, objectiu.z, true)
    },
    vista(v) {
      const c = controls.current
      if (c) void c.rotateAzimuthTo(azimutMesProper(c.azimuthAngle, VISTES[v]), true)
    },
    restablir() {
      const c = controls.current
      if (!c) return
      const a = c.azimuthAngle
      const d = CAMERA.distanciaInicial
      const h = CAMERA.alcadaInicial
      void c.setLookAt(Math.sin(a) * d, h, Math.cos(a) * d, 0, h, 0, true)
    },
  }))

  // --- Etiquetes i mida dels marcadors segons la distància ---
  const projectar = useCallback(
    (): ProjeccioMarcador[] =>
      projectarVisibles(
        marcadors.map((m) => ({ dada: m.id, punt: m.punt, normal: m.normal })),
        camera,
        size.width,
        size.height,
      ),
    [marcadors, camera, size],
  )

  const ultimes = useRef('')
  const actualitzarEtiquetes = useCallback(() => {
    const c = controls.current
    const nivell = nivellEtiquetes(c ? c.distance : CAMERA.distanciaInicial)
    const perId = new Map(marcadors.map((m) => [m.id, m]))
    // Primer el punt destacat, després els més propers a la càmera
    const ordenades =
      nivell === 'cap'
        ? []
        : projectar()
            .sort(
              (a, b) =>
                Number(perId.get(b.dada)?.destacat ?? false) - Number(perId.get(a.dada)?.destacat ?? false) ||
                a.profunditat - b.profunditat,
            )
            .slice(0, 80)
            .map((p) => {
              const m = perId.get(p.dada)!
              return { id: p.dada, x: p.x, y: p.y, text: nivell === 'codi' ? m.etiqueta : m.etiquetaLlarga, curt: m.etiqueta }
            })
    const noves = colocarEtiquetes(ordenades, size.width, size.height)
    const clau = JSON.stringify(noves)
    if (clau === ultimes.current) return
    ultimes.current = clau
    onEtiquetes(noves)
  }, [marcadors, projectar, onEtiquetes, size])

  // Es recalcula després de cada fotograma dibuixat (només n'hi ha quan canvia res)
  const pendent = useRef(false)
  useFrame(() => {
    const c = controls.current
    const d = c ? c.distance : CAMERA.distanciaInicial
    const escala = Math.min(1.6, Math.max(0.45, d / 2.2))
    grupMarcadors.current?.children.forEach((o) => o.scale.setScalar(escala))
    if (!pendent.current) {
      pendent.current = true
      requestAnimationFrame(() => {
        pendent.current = false
        actualitzarEtiquetes()
      })
    }
  })

  useEffect(() => {
    invalidate()
  }, [marcadors, recorreguts, invalidate])

  // Una mica separats de la pell perquè no hi quedin enganxats
  const posicionsMarcadors = useMemo(
    () => marcadors.map((m) => ({ m, posicio: m.punt.clone().addScaledVector(m.normal, 0.003) })),
    [marcadors],
  )

  // --- Tocs i arrossegament ---
  const raycaster = useMemo(() => new Raycaster(), [])
  const tocarPell = useCallback(
    (x: number, y: number, element: HTMLElement): TocPell | null => {
      if (!malla.current) return null
      const r = element.getBoundingClientRect()
      raycaster.setFromCamera(new Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera)
      const [hit] = raycaster.intersectObject(malla.current, false)
      if (!hit || hit.faceIndex == null) return null
      return { triangle: hit.faceIndex, punt: hit.point.clone() }
    },
    [camera, raycaster],
  )

  const gl = useThree((s) => s.gl)
  const callbacks = useRef({ modeToc, onTocarPell, onTocarMarcador, arrossegable, onArrossegar, projectar, tocarPell })
  useEffect(() => {
    callbacks.current = { modeToc, onTocarPell, onTocarMarcador, arrossegable, onArrossegar, projectar, tocarPell }
  })

  useEffect(() => {
    const canvas = gl.domElement
    const contenidor = canvas.parentElement ?? canvas
    const punters = new Map<number, { x: number; y: number }>()
    let gest: { x: number; y: number; multitoc: boolean; arrossegant: boolean } | null = null

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const baixar = (e: PointerEvent) => {
      punters.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (punters.size > 1) {
        if (gest) gest.multitoc = true
        return
      }
      gest = { x: e.clientX, y: e.clientY, multitoc: false, arrossegant: false }
      const cb = callbacks.current
      if (cb.arrossegable && e.button === 0) {
        const { x, y } = local(e)
        // Només es mira el punt arrossegable: si n'hi ha un altre al damunt
        // (p. ex. el simètric d'un punt de la línia mitja), no ha de guanyar
        const propi = cb.projectar().filter((p) => p.dada === cb.arrossegable)
        if (mesProperAlToc(propi, x, y, RADI_SELECCIO)) {
          gest.arrossegant = true
          if (controls.current) controls.current.enabled = false
          canvas.setPointerCapture?.(e.pointerId)
        }
      }
    }

    const moure = (e: PointerEvent) => {
      if (!gest?.arrossegant || !punters.has(e.pointerId)) return
      const toc = callbacks.current.tocarPell(e.clientX, e.clientY, canvas)
      if (toc) callbacks.current.onArrossegar?.(toc)
    }

    const aixecar = (e: PointerEvent) => {
      punters.delete(e.pointerId)
      const g = gest
      if (!g || punters.size > 0) return
      gest = null
      if (g.arrossegant) {
        if (controls.current) controls.current.enabled = true
        return
      }
      const mogut = Math.hypot(e.clientX - g.x, e.clientY - g.y)
      if (g.multitoc || mogut > MOVIMENT_MAXIM_TOC || e.button !== 0) return
      const cb = callbacks.current
      if (cb.modeToc === 'marcador') {
        const { x, y } = local(e)
        const id = mesProperAlToc(cb.projectar(), x, y, RADI_SELECCIO)
        if (id) cb.onTocarMarcador?.(id)
      } else {
        const toc = cb.tocarPell(e.clientX, e.clientY, canvas)
        if (toc) cb.onTocarPell?.(toc)
      }
    }

    const cancellar = (e: PointerEvent) => {
      punters.delete(e.pointerId)
      if (gest?.arrossegant && controls.current) controls.current.enabled = true
      gest = null
    }

    // En fase de captura sobre el contenidor: s'executa abans que els controls
    // de càmera, així es poden desactivar en començar a arrossegar un punt.
    contenidor.addEventListener('pointerdown', baixar, { capture: true })
    window.addEventListener('pointermove', moure)
    window.addEventListener('pointerup', aixecar)
    window.addEventListener('pointercancel', cancellar)
    return () => {
      contenidor.removeEventListener('pointerdown', baixar, { capture: true })
      window.removeEventListener('pointermove', moure)
      window.removeEventListener('pointerup', aixecar)
      window.removeEventListener('pointercancel', cancellar)
    }
  }, [gl])

  return (
    <>
      <CameraControls ref={controls} makeDefault />
      <hemisphereLight args={['#ffffff', '#b9ae9f', 1.6]} />
      <directionalLight position={[1.5, 3, 4]} intensity={1.6} />
      <directionalLight position={[-2, 2, -3]} intensity={0.8} />

      <mesh ref={malla} geometry={geometria}>
        <meshStandardMaterial color={COLOR_PELL} roughness={0.85} metalness={0} />
      </mesh>

      <group ref={grupMarcadors}>
        {posicionsMarcadors.map(({ m, posicio }) => (
          <mesh key={m.id} position={posicio}>
            <sphereGeometry args={[m.destacat ? 0.014 : m.color ? 0.011 : 0.007, 16, 12]} />
            <meshBasicMaterial color={m.destacat ? COLOR_DESTACAT : (m.color ?? COLOR_NEUTRE)} />
          </mesh>
        ))}
      </group>

      {recorreguts
        .filter((r) => r.length > 1)
        .map((r, i) => (
          <Line key={i} points={r} color={COLOR_RECORREGUT} lineWidth={2} transparent opacity={0.5} />
        ))}
    </>
  )
})
