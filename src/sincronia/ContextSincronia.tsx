// Sincronia automàtica amb Google Drive mentre l'app és oberta: uns segons
// després de cada canvi, cada cinc minuts (per rebre els canvis de l'altre
// dispositiu) i en connectar-se. Si el permís de Google ha caducat, ho diu i
// un toc el renova.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { guardarEstatGoogle, llegirEstatGoogle } from '../db/magatzem'
import { useClauMestra, useSessio } from '../sessio/ContextSessio'
import { TAULES } from './copia'
import { driveGoogle, ErrorAutoritzacio } from './drive'
import { googleConfigurat, oblidarPermis, quanCanviiElPermis, tokenGoogle } from './google'
import { sincronitzar } from './sincronitzar'

export type EstatSincronia =
  /** Google no està configurat en aquesta versió (proves locals) */
  | 'sense-google'
  /** Cal connectar (o tornar a connectar) amb Google */
  | 'cal-connectar'
  | 'sincronitzant'
  | 'al-dia'
  | 'error'

interface ValorSincronia {
  estat: EstatSincronia
  /** Data de l'última còpia a Drive */
  ultimaCopia: string | null
  /** Hi ha canvis locals que encara no són a Drive */
  pendent: boolean
  /** S'ha de cridar des d'un toc */
  connectar(): Promise<void>
  sincronitzarAra(): Promise<void>
}

const Context = createContext<ValorSincronia | null>(null)

export const ESPERA_DESPRES_DE_DESAR = 5_000
const CADA = 5 * 60_000

export function ProveidorSincronia({ children }: { children: ReactNode }) {
  const { db, connectarGoogle } = useSessio()
  const clau = useClauMestra()
  const [estat, setEstat] = useState<EstatSincronia>(googleConfigurat() ? 'cal-connectar' : 'sense-google')
  const [ultimaCopia, setUltimaCopia] = useState<string | null>(null)
  const [pendent, setPendent] = useState(false)
  const enCurs = useRef(false)
  const pendentRef = useRef(false)
  const temporitzador = useRef<number | undefined>(undefined)

  const sincronitzarAra = useCallback(async () => {
    if (!googleConfigurat()) return
    if (!tokenGoogle()) {
      setEstat('cal-connectar')
      return
    }
    if (enCurs.current) {
      pendentRef.current = true
      return
    }
    enCurs.current = true
    try {
      // Si hi ha hagut canvis mentre es pujava, es torna a fer
      do {
        pendentRef.current = false
        setEstat('sincronitzant')
        const r = await sincronitzar(db, clau, driveGoogle(tokenGoogle))
        const anterior = await llegirEstatGoogle(db)
        await guardarEstatGoogle(db, { connectatAt: anterior?.connectatAt ?? new Date().toISOString(), ultimaCopia: r.copiaAt })
        setUltimaCopia(r.copiaAt)
        setEstat('al-dia')
      } while (pendentRef.current && tokenGoogle())
      setPendent(false)
    } catch (e) {
      if (e instanceof ErrorAutoritzacio) {
        oblidarPermis()
        setEstat('cal-connectar')
      } else setEstat('error')
    } finally {
      enCurs.current = false
    }
  }, [db, clau])

  // En obrir: l'última còpia coneguda i, si ja hi ha permís, sincronitzar
  useEffect(() => {
    let actiu = true
    void llegirEstatGoogle(db).then((g) => {
      if (!actiu) return
      setUltimaCopia(g?.ultimaCopia ?? null)
      if (tokenGoogle()) void sincronitzarAra()
    })
    const desfer = quanCanviiElPermis(() => {
      if (tokenGoogle()) void sincronitzarAra()
    })
    return () => {
      actiu = false
      desfer()
    }
  }, [db, sincronitzarAra])

  // Cada canvi a les taules que se sincronitzen es puja uns segons després
  useEffect(() => {
    const canvi = () => {
      if (enCurs.current) return
      pendentRef.current = true
      window.setTimeout(() => setPendent(true))
      window.clearTimeout(temporitzador.current)
      temporitzador.current = window.setTimeout(() => void sincronitzarAra(), ESPERA_DESPRES_DE_DESAR)
    }
    const taules = [...TAULES.map((t) => db.table(t.nom)), db.esborrats]
    for (const t of taules) {
      t.hook('creating', canvi)
      t.hook('updating', canvi)
      t.hook('deleting', canvi)
    }
    const interval = window.setInterval(() => void sincronitzarAra(), CADA)
    return () => {
      for (const t of taules) {
        t.hook('creating').unsubscribe(canvi)
        t.hook('updating').unsubscribe(canvi)
        t.hook('deleting').unsubscribe(canvi)
      }
      window.clearInterval(interval)
      // En bloquejar amb canvis pendents, es pugen ara
      if (temporitzador.current !== undefined && pendentRef.current) void sincronitzarAra()
      window.clearTimeout(temporitzador.current)
    }
  }, [db, sincronitzarAra])

  // En arribar el permís, la subscripció de dalt ja sincronitza
  const connectar = connectarGoogle

  const valor = useMemo(
    () => ({ estat, ultimaCopia, pendent, connectar, sincronitzarAra }),
    [estat, ultimaCopia, pendent, connectar, sincronitzarAra],
  )
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useSincronia(): ValorSincronia {
  const v = useContext(Context)
  if (!v) throw new Error('useSincronia fora de ProveidorSincronia')
  return v
}
