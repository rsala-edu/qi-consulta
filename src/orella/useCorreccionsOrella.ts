// Posicions dels punts de l'orella corregides per la doctora (al dispositiu i
// a la còpia de Drive).

import { useCallback, useEffect, useRef, useState } from 'react'
import { desarCorreccioOrella, llegirCorreccionsOrella, treureCorreccioOrella } from '../db/calibratgeOrella'
import { useSessio } from '../sessio/ContextSessio'

export interface CorreccionsOrella {
  correccions: ReadonlyMap<string, { x: number; y: number }>
  /** Amb `immediat = false` (arrossegar) espera una mica abans de desar */
  desar(codi: string, x: number, y: number, immediat?: boolean): void
  treure(codi: string): Promise<void>
}

export function useCorreccionsOrella(): CorreccionsOrella {
  const { db } = useSessio()
  const [correccions, setCorreccions] = useState<ReadonlyMap<string, { x: number; y: number }>>(new Map())
  const pendents = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  useEffect(() => {
    let actiu = true
    void llegirCorreccionsOrella(db).then((m) => actiu && setCorreccions(m))
    return () => {
      actiu = false
    }
  }, [db])

  useEffect(() => {
    const p = pendents.current
    return () => p.forEach((t) => clearTimeout(t))
  }, [])

  const desar = useCallback(
    (codi: string, x: number, y: number, immediat = true) => {
      setCorreccions((m) => new Map(m).set(codi, { x, y }))
      clearTimeout(pendents.current.get(codi))
      const fer = () => void desarCorreccioOrella(db, codi, x, y)
      if (immediat) fer()
      else pendents.current.set(codi, setTimeout(fer, 250))
    },
    [db],
  )

  const treure = useCallback(
    async (codi: string) => {
      clearTimeout(pendents.current.get(codi))
      await treureCorreccioOrella(db, codi)
      setCorreccions((m) => {
        const n = new Map(m)
        n.delete(codi)
        return n
      })
    },
    [db],
  )

  return { correccions, desar, treure }
}
