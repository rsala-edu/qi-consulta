import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { INTERVAL_ESBORRANY } from '../domini/esborrany'
import { useEsborranys } from './ContextEsborranys'

export interface OpcionsEsborrany {
  /** Identifica el formulari. Només UUID i noms fixos: va en clar a IndexedDB. */
  clau: string
  /** Text que es mostra en oferir la recuperació (va xifrat). */
  descripcio: string
}

export interface ControlEsborrany {
  /** Cert si el formulari mostra un esborrany recuperat */
  recuperat: boolean
  /** Cridar just abans de desar el formulari */
  abansDeDesar(): void
  /** Cridar després de desar: true si s'ha desat, false si ha fallat */
  despresDeDesar(desat: boolean): Promise<void>
}

/**
 * Desa cada 5 segons un esborrany xifrat del formulari si té canvis sense
 * desar, i també en desmuntar-se (per exemple, quan l'app es bloqueja).
 */
export function useEsborrany<T extends FieldValues>(
  form: UseFormReturn<T>,
  { clau, descripcio }: OpcionsEsborrany,
): ControlEsborrany {
  const { desar, esborrar, recuperant, consumir } = useEsborranys()
  const ruta = useLocation().pathname
  const [recuperat, setRecuperat] = useState(false)

  // Valors actuals per a l'interval i la neteja, sense reiniciar-los
  const actual = useRef({ clau, descripcio, ruta, desar, esborrar })
  useEffect(() => {
    actual.current = { clau, descripcio, ruta, desar, esborrar }
  })
  const estat = useRef({ ultimDesat: null as string | null, enviant: false, enCurs: false })

  const guardar = useCallback(async () => {
    const e = estat.current
    if (e.enviant || e.enCurs) return
    const { clau, descripcio, ruta, desar, esborrar } = actual.current
    const valors = form.getValues()
    const json = JSON.stringify(valors)
    const ambCanvis = json !== JSON.stringify(form.formState.defaultValues)
    e.enCurs = true
    try {
      if (ambCanvis && json !== e.ultimDesat) {
        await desar(clau, { ruta, descripcio, valors })
        e.ultimDesat = json
      } else if (!ambCanvis && e.ultimDesat !== null) {
        // Ha desfet els canvis: l'esborrany ja no cal
        await esborrar(clau)
        e.ultimDesat = null
      }
    } catch {
      // Si falla, es tornarà a provar al pròxim interval
    } finally {
      e.enCurs = false
    }
  }, [form])

  useEffect(() => {
    const id = window.setInterval(() => void guardar(), INTERVAL_ESBORRANY)
    return () => {
      window.clearInterval(id)
      void guardar()
    }
  }, [guardar])

  // Recuperació: posa els valors de l'esborrany sense canviar els valors
  // desats, de manera que el formulari queda «amb canvis» fins que es desi.
  useEffect(() => {
    if (!recuperant || recuperant.clau !== clau) return
    form.reset(recuperant.valors as T, { keepDefaultValues: true })
    estat.current.ultimDesat = JSON.stringify(recuperant.valors)
    setRecuperat(true)
    consumir()
  }, [recuperant, clau, form, consumir])

  const abansDeDesar = useCallback(() => {
    estat.current.enviant = true
  }, [])

  const despresDeDesar = useCallback(async (desat: boolean) => {
    const e = estat.current
    if (desat) {
      setRecuperat(false)
      e.ultimDesat = null
      try {
        await actual.current.esborrar(actual.current.clau)
      } catch {
        // si no es pot esborrar, es tornarà a oferir; no és greu
      }
    }
    e.enviant = false
  }, [])

  return { recuperat, abansDeDesar, despresDeDesar }
}
