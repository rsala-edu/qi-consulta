// Visor del cos en 3D.
// - Gir només sobre l'eix vertical (angle polar fix), zoom amb dos dits o
//   la roda, desplaçament amb dos dits o el botó dret.
// - Botons de vista ràpida: Davant, Darrere, Esquerra, Dreta.
// - Marcadors de punts sobre la pell, amb etiquetes segons el zoom.
// - Toc (sense arrossegar) sobre la pell o sobre un marcador.
// Només es redibuixa quan canvia alguna cosa (frameloop="demand"), per
// estalviar bateria a la tauleta.

import { Billboard, CameraControls, Line } from '@react-three/drei'
import { COLOR_ANELL, COLOR_VORA, aspecteMarcador } from '../aspecteMarcador'
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
import { LimitError } from '../../components/LimitError'
import { t } from '../../i18n/t'
import { azimutMesProper, CAMERA, nivellEtiquetes, VISTES, vistaCapAlPunt, type Vista } from '../camera'
import { colocarEtiquetes, type EtiquetaColocada } from '../etiquetes'
import { textEtiqueta, type EtiquetesPerNivell } from '../etiquetaPunt'
import { mesProperAlToc, projectarVisibles, type ProjeccioPantalla } from '../seleccio'

export interface MarcadorVisor {
  id: string
  punt: Vector3
  normal: Vector3
  /** Color del marcador; si és undefined, color neutre (no marcat) */
  color?: string
  /** Text de l'etiqueta per a cada nivell de zoom (null: sense etiqueta) */
  etiquetes: EtiquetesPerNivell
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
  /**
   * Hi ha un meridià filtrat: les etiquetes es veuen també amb el cos sencer.
   * Si no, només en ampliar (si no, s'amunteguen i tapen els punts).
   */
  etiquetesSempre?: boolean
  /** Id del marcador que es pot arrossegar sobre la pell (calibratge) */
  arrossegable?: string | null
  onArrossegar?(toc: TocPell): void
  ref?: Ref<ControlVisor>
}

const COLOR_PELL = '#e9d8c8'
/** Recorregut del meridià: jade, suau, perquè els punts destaquin */
const COLOR_RECORREGUT = '#2f5d50'
const MOVIMENT_MAXIM_TOC = 8 // px
const RADI_SELECCIO = 28 // px

/**
 * La càmera només gira al voltant de l'eix vertical: l'angle polar queda fix
 * (horitzontal; des de dalt en anar a un punt del peu).
 */
function fixarPolar(c: CameraControlsImpl, polar: number) {
  c.minPolarAngle = polar
  c.maxPolarAngle = polar
}

/** Els marcadors creixen una mica amb la distància perquè es continuïn veient */
const escalaMarcadors = (distancia: number) => Math.min(1.6, Math.max(0.45, distancia / 2.2))

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
      {/* Sense WebGL (o si l'escena peta) només cau el cos: la resta del mapa continua */}
      <LimitError codi="UI-COS3D" alternativa={<ErrorCos3D />}>
      <Canvas
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: CAMERA.fov, near: 0.02, far: 50, position: [0, CAMERA.alcadaInicial, CAMERA.distanciaInicial] }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
        fallback={<p className="avis">{t.mapa.senseWebgl}</p>}
      >
        <Escena {...props} control={control} onEtiquetes={setEtiquetes} />
      </Canvas>
      </LimitError>
      <div className="visor3d-etiquetes" aria-hidden="true">
        {etiquetes.map((e) => (
          <span key={e.id} className="etiqueta-punt" style={{ transform: `translate(${e.esquerra}px, ${e.dalt}px)` }}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Al lloc del cos, quan no es pot dibuixar (sense WebGL o el model no carrega) */
export function ErrorCos3D() {
  return (
    <div className="visor3d-error" role="alert">
      <p>{t.errorPantalla.cos3D}</p>
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
  etiquetesSempre = false,
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
    fixarPolar(c, CAMERA.polar)
    c.minDistance = CAMERA.distanciaMinima
    c.maxDistance = CAMERA.distanciaMaxima
    c.dollyToCursor = true
    c.smoothTime = 0.2
    c.draggingSmoothTime = 0.08
    // Navegació de torn: el botó esquerre i un dit els gestiona el visor
    // (horitzontal = girar el cos; vertical = pujar-lo i baixar-lo). La roda
    // i dos dits amplien cap al cursor o cap al centre dels dits.
    c.mouseButtons.left = A.NONE
    c.mouseButtons.right = A.TRUCK
    c.mouseButtons.middle = A.DOLLY
    c.mouseButtons.wheel = A.DOLLY
    c.touches.one = A.NONE
    c.touches.two = A.TOUCH_DOLLY
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
    // En aturar-se, també l'estat de la càmera (gir, alçada del punt de mira i
    // distància), perquè les proves puguin comprovar la navegació
    const objectiu = new Vector3()
    const aturar = () => {
      c.getTarget(objectiu)
      visor.dataset.azimut = c.azimuthAngle.toFixed(3)
      visor.dataset.alcada = objectiu.y.toFixed(3)
      visor.dataset.distancia = c.distance.toFixed(3)
      visor.dataset.polar = c.polarAngle.toFixed(3)
      visor.dataset.moviment = 'no'
    }
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
      const { camera: cam, objectiu, polar } = vistaCapAlPunt(punt, normal, c.azimuthAngle)
      fixarPolar(c, polar)
      void c.setLookAt(cam.x, cam.y, cam.z, objectiu.x, objectiu.y, objectiu.z, true)
    },
    vista(v) {
      const c = controls.current
      if (!c) return
      fixarPolar(c, CAMERA.polar)
      void c.rotateTo(azimutMesProper(c.azimuthAngle, VISTES[v]), CAMERA.polar, true)
    },
    restablir() {
      const c = controls.current
      if (!c) return
      fixarPolar(c, CAMERA.polar)
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
    const distancia = c ? c.distance : CAMERA.distanciaInicial
    const nivell = nivellEtiquetes(distancia, etiquetesSempre)
    const pixelsPerMetre = size.height / (2 * Math.tan((CAMERA.fov * Math.PI) / 360))
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
              const text = textEtiqueta(m.etiquetes, nivell)
              // Mida del marcador a la pantalla, perquè cap etiqueta el tapi
              const a = aspecteMarcador(m)
              const radiMon = (a.anell?.[1] ?? a.vora ?? a.radi) * escalaMarcadors(distancia)
              const radi = (radiMon * pixelsPerMetre) / p.profunditat
              // Sense text, el punt continua ocupant lloc
              return { id: p.dada, x: p.x, y: p.y, text: text?.text ?? '', curt: text?.curt, radi }
            })
    const noves = colocarEtiquetes(ordenades, size.width, size.height)
    const clau = JSON.stringify(noves)
    if (clau === ultimes.current) return
    ultimes.current = clau
    onEtiquetes(noves)
  }, [marcadors, projectar, onEtiquetes, size, etiquetesSempre])

  // Es recalcula després de cada fotograma dibuixat (només n'hi ha quan canvia res)
  const pendent = useRef(false)
  useFrame(() => {
    const c = controls.current
    const escala = escalaMarcadors(c ? c.distance : CAMERA.distanciaInicial)
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
    let gest: {
      x: number
      y: number
      /** Última posició, per al torn */
      ux: number
      uy: number
      multitoc: boolean
      arrossegant: boolean
      /** Gest de torn (un sol dit o el botó esquerre) */
      torn: boolean
      girant: boolean
    } | null = null
    const visor = contenidor.closest<HTMLElement>('.visor3d')

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
      gest = {
        x: e.clientX,
        y: e.clientY,
        ux: e.clientX,
        uy: e.clientY,
        multitoc: false,
        arrossegant: false,
        torn: e.button === 0,
        girant: false,
      }
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
      if (!gest || !punters.has(e.pointerId)) return
      punters.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (gest.arrossegant) {
        const toc = callbacks.current.tocarPell(e.clientX, e.clientY, canvas)
        if (toc) callbacks.current.onArrossegar?.(toc)
        return
      }
      // Torn: horitzontal = girar el cos; vertical = pujar-lo o baixar-lo
      const c = controls.current
      if (!gest.torn || gest.multitoc || punters.size > 1 || !c || !c.enabled) return
      if (!gest.girant && Math.hypot(e.clientX - gest.x, e.clientY - gest.y) <= MOVIMENT_MAXIM_TOC) return
      if (!gest.girant) {
        gest.girant = true
        if (visor) visor.dataset.moviment = 'si'
      }
      const dx = e.clientX - gest.ux
      const dy = e.clientY - gest.uy
      gest.ux = e.clientX
      gest.uy = e.clientY
      const alt = canvas.clientHeight || 1
      const metresPerPixel = (2 * c.distance * Math.tan(((CAMERA.fov / 2) * Math.PI) / 180)) / alt
      void c.rotate((-dx * Math.PI * 1.4) / alt, 0, true)
      void c.truck(0, -dy * metresPerPixel, true)
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
        {posicionsMarcadors.map(({ m, posicio }) => {
          // Discos que sempre miren a la càmera; el seleccionat, amb un anell fosc per fora
          const a = aspecteMarcador(m)
          return (
            <Billboard key={m.id} position={posicio}>
              {a.anell && (
                <mesh position={[0, 0, -0.0004]}>
                  <ringGeometry args={[a.anell[0], a.anell[1], 32]} />
                  <meshBasicMaterial color={COLOR_ANELL} />
                </mesh>
              )}
              {a.vora && (
                <mesh>
                  <circleGeometry args={[a.vora, 24]} />
                  <meshBasicMaterial color={COLOR_VORA} />
                </mesh>
              )}
              <mesh position={[0, 0, 0.0004]}>
                <circleGeometry args={[a.radi, 24]} />
                <meshBasicMaterial color={a.color} />
              </mesh>
            </Billboard>
          )
        })}
      </group>

      {recorreguts
        .filter((r) => r.length > 1)
        .map((r, i) => (
          <Line key={i} points={r} color={COLOR_RECORREGUT} lineWidth={2} transparent opacity={0.5} />
        ))}
    </>
  )
})
