// Sincronia automàtica amb Google Drive mentre l'app és oberta: uns segons
// després de cada canvi, cada cinc minuts (per rebre els canvis de l'altre
// dispositiu) i en connectar-se.
//
// El permís de Google dura una hora. Quan ha caducat (o en queden menys de
// deu minuts), el pròxim toc de la doctora a qualsevol lloc de l'app obre la
// renovació silenciosa: la finestra de Google s'obre i es tanca sola, sense
// preguntar res. Mentrestant els canvis queden desats al dispositiu i es
// pugen després. «Drive: connectar» només apareix si la renovació falla.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { guardarEstatGoogle, llegirEstatGoogle, type EstatGoogle } from '../db/magatzem'
import { useClauMestra, useSessio } from '../sessio/ContextSessio'
import { TAULES } from './copia'
import { driveGoogle, ErrorAutoritzacio } from './drive'
import {
  acceptarPermis,
  calRenovarPermis,
  googleConfigurat,
  iniciarSessioGoogle,
  oblidarPermis,
  quanCanviiElPermis,
  tokenGoogle,
} from './google'
import { classificarErrorSincronia, type ErrorSincronia } from './motiuSincronia'
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
  /** Si l'última sincronia ha fallat: el motiu (sense cap dada clínica) */
  error: ErrorSincronia | null
  /** S'ha de cridar des d'un toc */
  connectar(): Promise<void>
  sincronitzarAra(): Promise<void>
}

const Context = createContext<ValorSincronia | null>(null)

export const ESPERA_DESPRES_DE_DESAR = 5_000
const CADA = 5 * 60_000
/** Després d'una renovació silenciosa fallida, no es torna a provar fins al cap de deu minuts */
const ESPERA_DESPRES_DE_FALLAR = 10 * 60_000

/** Atribut dels botons que ja connecten amb Google (no cal la renovació silenciosa) */
export const ATRIBUT_CONNECTAR = 'data-connectar-google'

export function ProveidorSincronia({ children }: { children: ReactNode }) {
  const { db, connectarGoogle } = useSessio()
  const clau = useClauMestra()
  const [estat, setEstat] = useState<EstatSincronia>(googleConfigurat() ? 'cal-connectar' : 'sense-google')
  const [ultimaCopia, setUltimaCopia] = useState<string | null>(null)
  const [pendent, setPendent] = useState(false)
  const [error, setError] = useState<ErrorSincronia | null>(null)
  const enCurs = useRef(false)
  const pendentRef = useRef(false)
  const temporitzador = useRef<number | undefined>(undefined)
  /** Estat desat de Google: si aquest dispositiu ja s'hi ha connectat (i la pista del compte) */
  const google = useRef<EstatGoogle | null>(null)
  const renovant = useRef(false)
  const fallitAt = useRef(0)

  /** Es podrà renovar el permís amb el pròxim toc, sense preguntar res */
  const esperaRenovacio = useCallback(
    () => google.current !== null && Date.now() - fallitAt.current > ESPERA_DESPRES_DE_FALLAR,
    [],
  )

  /** Sense permís: si es pot renovar amb el pròxim toc, els canvis queden pendents; si no, cal connectar */
  const sensePermis = useCallback(() => {
    if (esperaRenovacio()) {
      pendentRef.current = true
      setPendent(true)
      setEstat('al-dia')
    } else setEstat('cal-connectar')
  }, [esperaRenovacio])

  const sincronitzarAra = useCallback(async () => {
    if (!googleConfigurat()) return
    if (!tokenGoogle()) return sensePermis()
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
        const nou = { ...anterior, connectatAt: anterior?.connectatAt ?? new Date().toISOString(), ultimaCopia: r.copiaAt }
        await guardarEstatGoogle(db, nou)
        google.current = nou
        setUltimaCopia(r.copiaAt)
        setError(null)
        setEstat('al-dia')
      } while (pendentRef.current && tokenGoogle())
      setPendent(false)
    } catch (e) {
      if (e instanceof ErrorAutoritzacio) {
        oblidarPermis()
        sensePermis()
      } else {
        setError(classificarErrorSincronia(e))
        setEstat('error')
      }
    } finally {
      enCurs.current = false
    }
  }, [db, clau, sensePermis])

  // En obrir: l'última còpia coneguda i, si ja hi ha permís, sincronitzar
  useEffect(() => {
    let actiu = true
    void llegirEstatGoogle(db).then((g) => {
      if (!actiu) return
      google.current = g
      setUltimaCopia(g?.ultimaCopia ?? null)
      if (tokenGoogle()) void sincronitzarAra()
      else if (googleConfigurat()) setEstat(g ? 'al-dia' : 'cal-connectar')
    })
    const desfer = quanCanviiElPermis(() => {
      if (tokenGoogle()) void sincronitzarAra()
    })
    return () => {
      actiu = false
      desfer()
    }
  }, [db, sincronitzarAra])

  // Renovació silenciosa amb el pròxim toc. S'escolta en fase de captura i no
  // atura el toc: el botó que s'ha tocat fa la seva feina igualment.
  useEffect(() => {
    if (!googleConfigurat()) return
    const alTocar = (ev: MouseEvent) => {
      if (renovant.current || !calRenovarPermis() || !esperaRenovacio()) return
      if ((ev.target as Element | null)?.closest?.(`[${ATRIBUT_CONNECTAR}]`)) return
      renovant.current = true
      // window.open s'ha de fer ara mateix, dins el toc
      iniciarSessioGoogle({ mode: 'silenciosa', pista: google.current?.sub || undefined })
        .then(acceptarPermis)
        .then(async ({ sub }) => {
          if (sub && google.current && google.current.sub !== sub) {
            google.current = { ...google.current, sub }
            await guardarEstatGoogle(db, google.current)
          }
        })
        .catch(() => {
          fallitAt.current = Date.now()
          if (!tokenGoogle()) setEstat('cal-connectar')
        })
        .finally(() => {
          renovant.current = false
        })
    }
    document.addEventListener('click', alTocar, true)
    return () => document.removeEventListener('click', alTocar, true)
  }, [db, esperaRenovacio])

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

  // Sense connexió: es torna a provar sol quan torna la connexió
  useEffect(() => {
    const enLinia = () => void sincronitzarAra()
    window.addEventListener('online', enLinia)
    return () => window.removeEventListener('online', enLinia)
  }, [sincronitzarAra])

  // Reserva manual. En arribar el permís, la subscripció de dalt ja sincronitza
  const connectar = useCallback(async () => {
    await connectarGoogle()
    fallitAt.current = 0
    google.current = await llegirEstatGoogle(db)
  }, [connectarGoogle, db])

  const valor = useMemo(
    () => ({ estat, ultimaCopia, pendent, error, connectar, sincronitzarAra }),
    [estat, ultimaCopia, pendent, error, connectar, sincronitzarAra],
  )
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useSincronia(): ValorSincronia {
  const v = useContext(Context)
  if (!v) throw new Error('useSincronia fora de ProveidorSincronia')
  return v
}
