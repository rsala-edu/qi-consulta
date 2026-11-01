// Posicions corregides o col·locades en aquest dispositiu, aplicades sobre el
// catàleg del projecte. Les fan servir el calibratge (Ajustos) i el mapa.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  desarCalibracio,
  descartarCalibratge,
  esborrarCalibracio,
  llistarCalibratge,
  type Calibracio,
} from '../db/calibratge'
import { ambCalibratge, cataleg } from '../punts/cataleg'
import type { Cataleg, CostatPosicio, Posicio3D } from '../punts/esquema'
import { useSessio } from '../sessio/ContextSessio'

export interface Calibracions {
  calibracions: Calibracio[]
  /** El catàleg amb les correccions locals aplicades */
  efectiu: Cataleg
  /**
   * Desa una posició (o l'esborra amb null). Amb `immediat = false` espera una
   * mica (arrossegar). `index`: el subpunt, per als codis que en tenen.
   */
  desar(codi: string, costat: CostatPosicio, posicio: Posicio3D | null, immediat?: boolean, index?: number): void
  /** Torna a la posició del catàleg (treu la correcció local) */
  restablir(codi: string, costat: CostatPosicio, index?: number): Promise<void>
  descartarTot(): Promise<void>
}

export function useCalibracions(topologia: string): Calibracions {
  const { db } = useSessio()
  const [calibracions, setCalibracions] = useState<Calibracio[]>([])
  const pendents = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    let actiu = true
    void llistarCalibratge(db, topologia).then((l) => actiu && setCalibracions(l))
    return () => {
      actiu = false
    }
  }, [db, topologia])

  useEffect(() => {
    const p = pendents.current
    return () => p.forEach((t) => clearTimeout(t))
  }, [])

  const desar = useCallback(
    (codi: string, costat: CostatPosicio, posicio: Posicio3D | null, immediat = true, index = 0) => {
      setCalibracions((l) => [
        ...l.filter((k) => !(k.codi === codi && k.costat === costat && (k.index ?? 0) === index)),
        { codi, topologia, costat, ...(index > 0 ? { index } : {}), posicio },
      ])
      const clau = `${codi}|${costat}|${index}`
      clearTimeout(pendents.current.get(clau))
      const fer = () => void desarCalibracio(db, topologia, codi, costat, posicio, index)
      if (immediat) fer()
      else pendents.current.set(clau, setTimeout(fer, 250))
    },
    [db, topologia],
  )

  const restablir = useCallback(
    async (codi: string, costat: CostatPosicio, index = 0) => {
      clearTimeout(pendents.current.get(`${codi}|${costat}|${index}`))
      await esborrarCalibracio(db, topologia, codi, costat, index)
      setCalibracions((l) => l.filter((k) => !(k.codi === codi && k.costat === costat && (k.index ?? 0) === index)))
    },
    [db, topologia],
  )

  const descartarTot = useCallback(async () => {
    await descartarCalibratge(db, topologia)
    setCalibracions([])
  }, [db, topologia])

  const efectiu = useMemo(() => ambCalibratge(cataleg, calibracions), [calibracions])
  return { calibracions, efectiu, desar, restablir, descartarTot }
}
