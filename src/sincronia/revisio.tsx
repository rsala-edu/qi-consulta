// Les pantalles obertes es refresquen soles quan la sincronia porta canvis
// d'un altre dispositiu (useCarrega torna a carregar quan canvia la «vista»).
//
// Si hi ha un formulari a mig fer (amb canvis sense desar), no es toca res:
// surt la franja «Hi ha canvis d'un altre dispositiu · Veure'ls», i la vista
// només s'actualitza quan la doctora ho tria (o quan ja no hi ha cap
// formulari a mig fer).

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

interface ValorRevisio {
  /** Quantes vegades la sincronia ha portat canvis d'un altre dispositiu (sense esperar els formularis) */
  revisio: number
  /** Número de la versió de les dades que mostren les pantalles */
  vista: number
  /** Han arribat canvis que no es mostren perquè hi ha un formulari a mig fer */
  canvisPerVeure: boolean
  /** Mostrar ara els canvis (es tornen a carregar les pantalles) */
  veure(): void
  /** Un formulari diu si té canvis sense desar */
  marcarBrut(id: string, brut: boolean): void
}

const Context = createContext<ValorRevisio | null>(null)

/** `revisio`: puja cada cop que la sincronia aplica canvis d'un altre dispositiu */
export function ProveidorRevisio({ revisio, children }: { revisio: number; children: ReactNode }) {
  const [vista, setVista] = useState(revisio)
  const bruts = useRef(new Set<string>())
  const [nBruts, setNBruts] = useState(0)

  // Canvis nous: es mostren de seguida si no hi ha cap formulari a mig fer
  useEffect(() => {
    if (revisio !== vista && nBruts === 0) setVista(revisio)
  }, [revisio, vista, nBruts])

  const veure = useCallback(() => setVista(revisio), [revisio])
  const marcarBrut = useCallback((id: string, brut: boolean) => {
    if (brut) bruts.current.add(id)
    else bruts.current.delete(id)
    setNBruts(bruts.current.size)
  }, [])

  const valor = useMemo(
    () => ({ revisio, vista, canvisPerVeure: revisio !== vista, veure, marcarBrut }),
    [vista, revisio, veure, marcarBrut],
  )
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

/** La versió de les dades que mostren les pantalles (0 fora del proveïdor: proves) */
export function useVistaDades(): number {
  return useContext(Context)?.vista ?? 0
}

/** Puja cada cop que arriben canvis d'un altre dispositiu (encara que no es mostrin) */
export function useRevisioSincronia(): number {
  return useContext(Context)?.revisio ?? 0
}

export function useCanvisPerVeure(): { canvisPerVeure: boolean; veure(): void } {
  const v = useContext(Context)
  return { canvisPerVeure: v?.canvisPerVeure ?? false, veure: v?.veure ?? (() => {}) }
}

/** Un formulari amb canvis sense desar: mentre ho estigui, les pantalles no es refresquen soles */
export function useFormulariBrut(brut: boolean): void {
  const id = useId()
  const v = useContext(Context)
  const marcar = v?.marcarBrut
  useEffect(() => {
    marcar?.(id, brut)
    return () => marcar?.(id, false)
  }, [marcar, id, brut])
}
