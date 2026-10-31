// Estat de la sessió d'ús: si l'app està bloquejada o oberta.
// La clau mestra només viu aquí, en memòria, i dins del magatzem.
// En bloquejar (o tancar l'app) es perd i cal tornar a escriure la contrasenya.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { crearClauMestra, desbloquejarClauMestra } from '../crypto'
import type { QiDB } from '../db/esquema'
import {
  crearMagatzem,
  guardarClauEmbolcallada,
  llegirClauEmbolcallada,
  type Magatzem,
} from '../db/magatzem'
import { useAutoBloqueig } from './useAutoBloqueig'

export type EstatSessio =
  | { tipus: 'carregant' }
  | { tipus: 'sense-configurar' }
  | { tipus: 'bloquejat' }
  | { tipus: 'desbloquejat'; magatzem: Magatzem }

interface ValorSessio {
  estat: EstatSessio
  crearContrasenya(contrasenya: string): Promise<void>
  desbloquejar(contrasenya: string): Promise<void>
  bloquejar(): void
}

const Context = createContext<ValorSessio | null>(null)

export const DEU_MINUTS = 10 * 60 * 1000

export function ProveidorSessio({
  db,
  children,
  msInactivitat = DEU_MINUTS,
}: {
  db: QiDB
  children: ReactNode
  msInactivitat?: number
}) {
  const [estat, setEstat] = useState<EstatSessio>({ tipus: 'carregant' })

  useEffect(() => {
    let actiu = true
    llegirClauEmbolcallada(db).then((embolcall) => {
      if (actiu) setEstat({ tipus: embolcall ? 'bloquejat' : 'sense-configurar' })
    })
    return () => {
      actiu = false
    }
  }, [db])

  const crearContrasenya = useCallback(
    async (contrasenya: string) => {
      if (await llegirClauEmbolcallada(db)) throw new Error('La contrasenya ja està creada')
      const { embolcall, clau } = await crearClauMestra(contrasenya)
      await guardarClauEmbolcallada(db, embolcall)
      setEstat({ tipus: 'desbloquejat', magatzem: crearMagatzem(db, clau) })
    },
    [db],
  )

  const desbloquejar = useCallback(
    async (contrasenya: string) => {
      const embolcall = await llegirClauEmbolcallada(db)
      if (!embolcall) throw new Error('No hi ha cap contrasenya creada')
      const clau = await desbloquejarClauMestra(embolcall, contrasenya)
      setEstat({ tipus: 'desbloquejat', magatzem: crearMagatzem(db, clau) })
    },
    [db],
  )

  const bloquejar = useCallback(() => {
    setEstat((e) => (e.tipus === 'desbloquejat' ? { tipus: 'bloquejat' } : e))
  }, [])

  useAutoBloqueig(estat.tipus === 'desbloquejat', bloquejar, msInactivitat)

  const valor = useMemo(
    () => ({ estat, crearContrasenya, desbloquejar, bloquejar }),
    [estat, crearContrasenya, desbloquejar, bloquejar],
  )
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useSessio(): ValorSessio {
  const valor = useContext(Context)
  if (!valor) throw new Error('useSessio fora de ProveidorSessio')
  return valor
}

/** Només es pot fer servir dins les pantalles que es veuen amb l'app oberta. */
export function useMagatzem(): Magatzem {
  const { estat } = useSessio()
  if (estat.tipus !== 'desbloquejat') throw new Error('L\'app està bloquejada')
  return estat.magatzem
}
