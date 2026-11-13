// Actualitzacions de l'app (service worker). Abans, el navegador només
// buscava una versió nova en carregar la pàgina, i la pàgina oberta continuava
// amb la vella fins que es tornava a carregar (docs/sincronia.md, 7).
//
// Ara:
// - el service worker es registra amb `updateViaCache: 'none'` (el navegador
//   no fa servir la memòria cau per a sw.js), i es busca una versió nova en
//   obrir l'app, en tornar a la pestanya i cada 30 minuts;
// - també es mira version.json (sense memòria cau), que diu quina versió hi ha
//   publicada;
// - quan n'hi ha una de nova: franja «Hi ha una versió nova · Actualitzar». Si
//   l'app està bloquejada (o encara no s'ha obert), s'actualitza sola. Les dades
//   són a IndexedDB i el que no s'ha pujat és a la cua: no es perd res.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const CADA = 30 * 60_000
export const VERSIO_APP = import.meta.env.VITE_VERSIO_APP ?? 'dev'

const base = () => import.meta.env.BASE_URL

let registre: ServiceWorkerRegistration | null = null

/** Busca una versió nova (del service worker i de version.json). Torna la versió publicada, si se sap */
export async function buscarVersioNova(): Promise<string | null> {
  try {
    await registre?.update()
  } catch {
    // Sense connexió: es tornarà a provar
  }
  try {
    const r = await fetch(`${base()}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    return ((await r.json()) as { versio?: string }).versio ?? null
  } catch {
    return null
  }
}

/** Passa a la versió nova (si n'hi ha una d'esperant) i torna a carregar */
export function actualitzarAra(): void {
  const esperant = registre?.waiting
  if (!esperant || !navigator.serviceWorker) {
    window.location.reload()
    return
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
  esperant.postMessage({ type: 'SKIP_WAITING' })
}

interface ValorActualitzacio {
  /** Hi ha una versió nova a punt */
  versioNova: boolean
  /** La versió publicada (version.json), si se sap */
  versioPublicada: string | null
  actualitzar(): void
  buscar(): Promise<void>
}

const Context = createContext<ValorActualitzacio | null>(null)

export function ProveidorActualitzacio({ children }: { children: ReactNode }) {
  const [versioNova, setVersioNova] = useState(false)
  const [versioPublicada, setVersioPublicada] = useState<string | null>(null)

  const buscar = useCallback(async () => {
    const v = await buscarVersioNova()
    if (v) setVersioPublicada(v)
    if (registre?.waiting && navigator.serviceWorker?.controller) setVersioNova(true)
  }, [])

  useEffect(() => {
    // (ni en desenvolupament ni al build de les proves E2E: vite build --mode proves)
    if (import.meta.env.DEV || import.meta.env.MODE === 'proves' || !('serviceWorker' in navigator)) return
    let actiu = true
    const vigilar = (r: ServiceWorkerRegistration) => {
      const esperant = () => {
        // Només si ja hi havia una versió funcionant (no el primer cop)
        if (actiu && r.waiting && navigator.serviceWorker.controller) setVersioNova(true)
      }
      esperant()
      r.addEventListener('updatefound', () => {
        const nou = r.installing
        nou?.addEventListener('statechange', () => {
          if (nou.state === 'installed') esperant()
        })
      })
    }
    void navigator.serviceWorker
      .register(`${base()}sw.js`, { scope: base(), updateViaCache: 'none' })
      .then((r) => {
        registre = r
        vigilar(r)
        void buscar()
      })
      .catch(() => {})
    const tornar = () => {
      if (document.visibilityState === 'visible') void buscar()
    }
    document.addEventListener('visibilitychange', tornar)
    const interval = window.setInterval(() => void buscar(), CADA)
    return () => {
      actiu = false
      document.removeEventListener('visibilitychange', tornar)
      window.clearInterval(interval)
    }
  }, [buscar])

  const valor = useMemo(() => ({ versioNova, versioPublicada, actualitzar: actualitzarAra, buscar }), [versioNova, versioPublicada, buscar])
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useActualitzacio(): ValorActualitzacio {
  return (
    useContext(Context) ?? { versioNova: false, versioPublicada: null, actualitzar: actualitzarAra, buscar: async () => {} }
  )
}
