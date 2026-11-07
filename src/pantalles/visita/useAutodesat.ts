// Es desa sol uns moments després de l'últim canvi, només amb el que ha
// canviat respecte de l'última versió desada (així els canvis d'un altre
// dispositiu no es trepitgen), i en sortir de la pantalla es desa el que hi
// hagi pendent. El fa servir la valoració (la sessió té el seu, a PantallaVisita).

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useFormulariBrut } from '../../sincronia/revisio'

const ESPERA = 600

export function useAutodesat<T>(
  /** El que hi ha a la base de dades (canvia quan arriben canvis d'un altre dispositiu) */
  desat: T,
  desar: (dades: T, inicial: T) => Promise<T>,
  actiu = true,
): { dades: T; setDades: Dispatch<SetStateAction<T>>; pendent: boolean; desant: boolean } {
  const [dades, setDadesEstat] = useState<T>(desat)
  const darrera = useRef<T>(desat)
  const [pendent, setPendent] = useState(false)
  const [desant, setDesant] = useState(false)
  useFormulariBrut(pendent)

  // Ha arribat una versió nova i aquí no hi ha res pendent
  useEffect(() => {
    if (pendent) return
    if (JSON.stringify(desat) !== JSON.stringify(darrera.current)) {
      darrera.current = desat
      setDadesEstat(desat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desat])

  const setDades: Dispatch<SetStateAction<T>> = useCallback((u) => {
    setDadesEstat(u)
    setPendent(true)
  }, [])

  const desarRef = useRef(desar)
  // L'últim que s'ha escrit (si s'escriu mentre es desa, encara queda pendent)
  const ultimes = useRef(dades)
  useEffect(() => {
    desarRef.current = desar
    ultimes.current = dades
  })

  useEffect(() => {
    if (!pendent || !actiu) return
    const tmp = window.setTimeout(() => {
      setDesant(true)
      const aDesar = dades
      desarRef
        .current(aDesar, darrera.current)
        .then((d) => {
          darrera.current = d
          setPendent(JSON.stringify(aDesar) !== JSON.stringify(ultimes.current))
        })
        .catch(() => {})
        .finally(() => setDesant(false))
    }, ESPERA)
    return () => window.clearTimeout(tmp)
  }, [dades, pendent, actiu])

  // En sortir, es desa el que hi hagi pendent
  const perDesar = useRef({ dades, pendent, actiu })
  useEffect(() => {
    perDesar.current = { dades, pendent, actiu }
  }, [dades, pendent, actiu])
  useEffect(
    () => () => {
      const p = perDesar.current
      if (p.pendent && p.actiu) void desarRef.current(p.dades, darrera.current).catch(() => {})
    },
    [],
  )

  return { dades, setDades, pendent, desant }
}
