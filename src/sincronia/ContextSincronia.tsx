// Sincronia automàtica amb Google Drive mentre l'app és oberta: uns segons
// després de cada canvi, cada cinc minuts (per rebre els canvis de l'altre
// dispositiu) i en connectar-se.
//
// El permís de Google dura una hora. Quan ha caducat (o en queden menys de
// deu minuts), el pròxim toc de la doctora a qualsevol lloc de l'app obre la
// renovació silenciosa: la finestra de Google s'obre i es tanca sola, sense
// preguntar res. Mentrestant els canvis queden desats al dispositiu i es
// pugen després. «Drive: connectar» només apareix si la renovació falla.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { guardarEstatGoogle, llegirEstatGoogle, type EstatGoogle } from '../db/magatzem'
import { useClauMestra, useSessio } from '../sessio/ContextSessio'
import { pendentsDePujar } from './escriptura'
import { ProveidorRevisio } from './revisio'
import { driveGoogle, ErrorAutoritzacio, ErrorDrive } from './drive'
import {
  acceptarPermis,
  calRenovarPermis,
  ErrorGoogle,
  googleConfigurat,
  iniciarSessioGoogle,
  oblidarPermis,
  quanCanviiElPermis,
  tokenGoogle,
} from './google'
import { classificarErrorSincronia, type ErrorSincronia } from './motiuSincronia'
import { diariPerTancar, ErrorSenseCopiaAnterior, llegirDarreraSincronia, sincronitzar, type InfoDrive } from './sincronitzar'

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
  /** d) La còpia principal és danyada: es fa servir la diària o la mensual. Torna si ha anat bé */
  provarCopiesAnteriors(): Promise<boolean>
  /** El que s'ha llegit de Drive a l'última sincronia (format i clau), per als detalls tècnics */
  infoDrive: InfoDrive | null
  /** Hora de l'última sincronia correcta d'aquest dispositiu */
  darreraCorrecta: string | null
  /**
   * Si ara mateix no es pot fer cap còpia: des de quan (l'última correcta o,
   * si mai n'hi ha hagut cap, el primer error). null si tot va bé.
   */
  senseCopiaDesDe: string | null
  /** S'ha entrat amb un altre compte de Google (no s'ha fet servir): el seu identificador */
  altreCompte: string | null
  /** Registres desats que encara no són a Drive */
  pendents: number
  /** Drive demana una versió més nova de l'app per escriure: no es puja res */
  nomesLectura: boolean
  /** Desfasament del rellotge respecte de Google (ms; positiu: avançat), si se sap */
  desfasMs: number | null
  /** Un dispositiu amb una versió antiga de l'app ha escrit dades a Drive */
  versioAntiga: boolean
  tancarAvisVersioAntiga(): void
}

const Context = createContext<ValorSincronia | null>(null)

export const ESPERA_DESPRES_DE_DESAR = 3_000
/** Esperes abans de tornar-ho a provar després d'un error temporal */
export const REINTENTS = [5_000, 15_000, 45_000, 120_000, 300_000]
const ESPERA_TORNADA = 15_000

/** Drive saturat (429), un error del servidor (5xx) o sense connexió: es pot tornar a provar */
function esTemporal(e: unknown, motiu: string): boolean {
  return motiu === 'xarxa' || (e instanceof ErrorDrive && (e.estat === 429 || e.estat >= 500))
}
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
  const [infoDrive, setInfoDrive] = useState<InfoDrive | null>(null)
  const [darreraCorrecta, setDarreraCorrecta] = useState<string | null>(null)
  const [errorDesDe, setErrorDesDe] = useState<string | null>(null)
  /** S'ha entrat amb un compte de Google que no és el d'aquest espai (el seu identificador) */
  const [altreCompte, setAltreCompte] = useState<string | null>(null)
  const enCurs = useRef(false)
  /** Un dispositiu amb una versió antiga ha escrit a qi-dades.json (fins que la doctora ho tanca) */
  const [versioAntiga, setVersioAntiga] = useState(false)
  const tancarAvisVersioAntiga = useCallback(() => {
    setVersioAntiga(false)
    void db.meta.delete('versioAntigaAt')
  }, [db])
  /** Puja cada cop que la sincronia aplica canvis d'un altre dispositiu */
  const [revisio, setRevisio] = useState(0)
  /** Quant va desfasat el rellotge d'aquest dispositiu respecte de Google (ms; positiu: avançat) */
  const [desfasMs, setDesfasMs] = useState<number | null>(null)
  /** Registres de la cua que encara no són a Drive */
  const [pendents, setPendents] = useState(0)
  /** Drive demana una versió més nova de l'app per escriure */
  const [nomesLectura, setNomesLectura] = useState(false)
  const comptarPendents = useCallback(async () => {
    const n = await pendentsDePujar(db)
    setPendents(n)
    return n
  }, [db])
  // La clau pot canviar (fusió amb Drive) mentre una sincronia és en marxa
  const clauRef = useRef(clau)
  useLayoutEffect(() => {
    clauRef.current = clau
  }, [clau])
  const pendentRef = useRef(false)
  const temporitzador = useRef<number | undefined>(undefined)
  /** Reintents seguits després d'un error temporal (i el seu temporitzador) */
  const reintent = useRef(0)
  const temporitzadorReintent = useRef<number | undefined>(undefined)
  /** El diari propi a punt per pujar-lo en tancar la pestanya (keepalive) */
  const perTancar = useRef<{ id: string; text: string } | null>(null)
  const temporitzadorTancar = useRef<number | undefined>(undefined)
  /** Quan s'ha sincronitzat per últim cop en tornar a la pestanya */
  const tornadaAt = useRef(0)
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

  /** Primer error sense cap còpia correcta entremig: es recorda (per avisar passades 24 hores) */
  const anotarError = useCallback(async () => {
    const ja = await db.meta.get('errorSincroniaDesDe')
    if (ja?.clau === 'errorSincroniaDesDe') return setErrorDesDe(ja.valor)
    const ara = new Date().toISOString()
    await db.meta.put({ clau: 'errorSincroniaDesDe', valor: ara })
    setErrorDesDe(ara)
  }, [db])

  const sincronitzarAmb = useCallback(async (copiaAnterior: boolean): Promise<boolean> => {
    if (!googleConfigurat()) return false
    if (!tokenGoogle()) {
      sensePermis()
      return false
    }
    if (enCurs.current) {
      pendentRef.current = true
      return false
    }
    enCurs.current = true
    let usada = clauRef.current
    try {
      // Si hi ha hagut canvis mentre es pujava, es torna a fer
      let ambCopiaAnterior = copiaAnterior
      do {
        pendentRef.current = false
        setEstat('sincronitzant')
        usada = clauRef.current
        let horaGoogle: number | null = null
        const r = await sincronitzar(db, usada, driveGoogle(tokenGoogle, undefined, (g, aqui) => (horaGoogle = aqui - g)), {
          informar: setInfoDrive,
          copiaAnterior: ambCopiaAnterior,
        })
        // Desfasament del rellotge: la capçalera Date de Google o, si no es pot
        // llegir, l'hora de Drive del fitxer que s'acaba d'escriure (ja desada)
        if (horaGoogle !== null) await db.meta.put({ clau: 'desfasRellotge', valor: { ms: horaGoogle, at: new Date().toISOString() } })
        if (r.versioAntiga) setVersioAntiga(true)
        const d = await db.meta.get('desfasRellotge')
        setDesfasMs(d?.clau === 'desfasRellotge' ? d.valor.ms : null)
        ambCopiaAnterior = false
        reintent.current = 0
        window.clearTimeout(temporitzadorReintent.current)
      window.clearTimeout(temporitzadorTancar.current)
        await db.meta.delete('errorSincroniaDesDe')
        setErrorDesDe(null)
        setDarreraCorrecta(await llegirDarreraSincronia(db))
        const anterior = await llegirEstatGoogle(db)
        const nou = { ...anterior, connectatAt: anterior?.connectatAt ?? new Date().toISOString(), ultimaCopia: r.copiaAt }
        await guardarEstatGoogle(db, nou)
        google.current = nou
        // Canvis d'un altre dispositiu: les pantalles obertes es refresquen (revisio.tsx)
        if (r.baixat) setRevisio((n) => n + 1)
        setUltimaCopia(r.copiaAt)
        setNomesLectura(r.nomesLectura)
        setError(null)
        setEstat('al-dia')
        await comptarPendents()
      } while (pendentRef.current && tokenGoogle())
      setPendent((await comptarPendents()) > 0 && nomesLecturaRef.current)
      return true
    } catch (e) {
      if (usada !== clauRef.current) {
        // La clau ha canviat a mig camí: es torna a fer amb la nova
        window.setTimeout(() => void sincronitzarAmbRef.current(false))
        return false
      }
      if (e instanceof ErrorAutoritzacio) {
        oblidarPermis()
        sensePermis()
      } else if (e instanceof ErrorSenseCopiaAnterior) {
        // Res no ha canviat: continua l'error d'abans (còpia danyada)
        setEstat('error')
      } else {
        const motiu = classificarErrorSincronia(e)
        setError(motiu)
        setEstat('error')
        // Errors temporals (Drive saturat o sense connexió): es torna a provar sol,
        // cada cop esperant més (5 s, 15 s, 45 s, 2 min, 5 min…)
        if (esTemporal(e, motiu.motiu)) {
          const espera = REINTENTS[Math.min(reintent.current, REINTENTS.length - 1)]!
          reintent.current++
          window.clearTimeout(temporitzadorReintent.current)
          temporitzadorReintent.current = window.setTimeout(() => void sincronitzarAmbRef.current(false), espera)
        }
      }
      await anotarError()
      // S'ha demanat una altra sincronia mentre aquesta fallava (per exemple, amb
      // la clau nova després de fusionar): es torna a provar
      if (pendentRef.current) window.setTimeout(() => void sincronitzarAmbRef.current(false), 1_000)
      return false
    } finally {
      enCurs.current = false
    }
  }, [db, sensePermis, anotarError, comptarPendents])
  const nomesLecturaRef = useRef(false)
  useLayoutEffect(() => {
    nomesLecturaRef.current = nomesLectura
  }, [nomesLectura])
  const sincronitzarAmbRef = useRef(sincronitzarAmb)
  useLayoutEffect(() => {
    sincronitzarAmbRef.current = sincronitzarAmb
  }, [sincronitzarAmb])

  // Depèn de la clau: en canviar-la, es torna a sincronitzar de seguida
  const sincronitzarAra = useCallback(async () => {
    void clau
    await sincronitzarAmb(false)
  }, [sincronitzarAmb, clau])
  const provarCopiesAnteriors = useCallback(() => sincronitzarAmb(true), [sincronitzarAmb])

  // En obrir: l'última còpia coneguda i, si ja hi ha permís, sincronitzar
  useEffect(() => {
    let actiu = true
    void comptarPendents().then((n) => {
      if (actiu && n > 0) {
        pendentRef.current = true
        setPendent(true)
      }
    })
    void Promise.all([llegirDarreraSincronia(db), db.meta.get('errorSincroniaDesDe'), db.meta.get('desfasRellotge')]).then(([d, e, r]) => {
      if (!actiu) return
      setDarreraCorrecta(d)
      setDesfasMs(r?.clau === 'desfasRellotge' ? r.valor.ms : null)
      void db.meta.get('versioAntigaAt').then((v) => actiu && setVersioAntiga(v !== undefined))
      setErrorDesDe(e?.clau === 'errorSincroniaDesDe' ? e.valor : null)
    })
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
  }, [db, sincronitzarAra, comptarPendents])

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
        // Un permís d'un altre compte no es fa servir mai en aquest espai
        .then((p) => acceptarPermis(p, undefined, google.current?.sub || null))
        .then(async ({ sub }) => {
          if (sub && google.current && !google.current.sub) {
            google.current = { ...google.current, sub }
            await guardarEstatGoogle(db, google.current)
          }
        })
        .catch((e: unknown) => {
          fallitAt.current = Date.now()
          if (e instanceof ErrorGoogle && e.motiu === 'altreCompte' && e.sub) setAltreCompte(e.sub)
          if (!tokenGoogle()) setEstat('cal-connectar')
        })
        .finally(() => {
          renovant.current = false
        })
    }
    document.addEventListener('click', alTocar, true)
    return () => document.removeEventListener('click', alTocar, true)
  }, [db, esperaRenovacio])

  // Cada canvi entra a la cua (escriptura.ts) i es puja uns segons després.
  // També si arriba mentre una sincronia és en marxa: la sincronia torna a
  // començar quan acaba (el canvi té un número de seqüència més alt)
  useEffect(() => {
    const canvi = () => {
      pendentRef.current = true
      window.setTimeout(() => {
        setPendent(true)
        void comptarPendents()
      })
      // El diari a punt per si es tanca la pestanya abans de pujar-lo
      window.clearTimeout(temporitzadorTancar.current)
      temporitzadorTancar.current = window.setTimeout(() => {
        void diariPerTancar(db, clauRef.current).then(
          (d) => (perTancar.current = d),
          () => (perTancar.current = null),
        )
      }, 300)
      window.clearTimeout(temporitzador.current)
      temporitzador.current = window.setTimeout(() => void sincronitzarAra(), ESPERA_DESPRES_DE_DESAR)
    }
    const cua = db.canvisPropis
    cua.hook('creating', canvi)
    cua.hook('updating', canvi)
    const interval = window.setInterval(() => void sincronitzarAra(), CADA)
    return () => {
      cua.hook('creating').unsubscribe(canvi)
      cua.hook('updating').unsubscribe(canvi)
      window.clearInterval(interval)
      window.clearTimeout(temporitzadorReintent.current)
      // En bloquejar amb canvis pendents, es pugen ara
      if (temporitzador.current !== undefined && pendentRef.current) void sincronitzarAra()
      window.clearTimeout(temporitzador.current)
    }
  }, [db, sincronitzarAra, comptarPendents])

  // En amagar la pestanya (canviar d'app, tancar-la, bloquejar la pantalla) es
  // puja de seguida el que hi hagi pendent. I si es tanca amb canvis pendents,
  // el navegador ho avisa (amb el seu propi text)
  useEffect(() => {
    const amagada = () => {
      if (document.visibilityState === 'hidden' && pendentRef.current) void sincronitzarAra()
      // En tornar a la pestanya, es miren els canvis dels altres dispositius de seguida
      // (com a molt un cop cada 15 segons)
      if (document.visibilityState === 'visible' && Date.now() - tornadaAt.current > ESPERA_TORNADA) {
        tornadaAt.current = Date.now()
        void sincronitzarAra()
      }
    }
    const sortint = () => {
      if (!pendentRef.current) return
      // Es tanca la pestanya: el diari (si és prou petit) es puja amb keepalive,
      // que el navegador acaba encara que la pàgina ja no hi sigui. Si no es pot,
      // es pujarà en tornar a obrir l'app (el navegador ja ha avisat)
      if (perTancar.current) driveGoogle(tokenGoogle).actualitzarEnTancar?.(perTancar.current.id, perTancar.current.text)
      void sincronitzarAra()
    }
    const tancant = (e: BeforeUnloadEvent) => {
      if (!pendentRef.current && !enCurs.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('visibilitychange', amagada)
    window.addEventListener('pagehide', sortint)
    window.addEventListener('beforeunload', tancant)
    return () => {
      document.removeEventListener('visibilitychange', amagada)
      window.removeEventListener('pagehide', sortint)
      window.removeEventListener('beforeunload', tancant)
    }
  }, [sincronitzarAra])

  // Sense connexió: es torna a provar sol quan torna la connexió
  useEffect(() => {
    const enLinia = () => void sincronitzarAra()
    window.addEventListener('online', enLinia)
    return () => window.removeEventListener('online', enLinia)
  }, [sincronitzarAra])

  // Reserva manual. En arribar el permís, la subscripció de dalt ja sincronitza
  const connectar = useCallback(async () => {
    setAltreCompte(null)
    try {
      await connectarGoogle()
    } catch (e) {
      // Un altre compte: no s'ha fet servir per a res; la doctora tria què fer
      if (e instanceof ErrorGoogle && e.motiu === 'altreCompte' && e.sub) setAltreCompte(e.sub)
      throw e
    }
    fallitAt.current = 0
    google.current = await llegirEstatGoogle(db)
  }, [connectarGoogle, db])

  // No es pot fer cap còpia: hi ha un error, cal connectar, hi ha canvis que
  // esperen el permís o l'últim intent va fallar (l'error desat només s'esborra
  // amb una sincronia correcta, encara que l'app s'hagi bloquejat entremig)
  const aturada = errorDesDe !== null || estat === 'error' || estat === 'cal-connectar' || (estat === 'al-dia' && pendent)
  const senseCopiaDesDe = aturada ? (darreraCorrecta ?? errorDesDe) : null

  const valor = useMemo(
    () => ({
      estat,
      ultimaCopia,
      pendent,
      error,
      connectar,
      sincronitzarAra,
      provarCopiesAnteriors,
      infoDrive,
      darreraCorrecta,
      senseCopiaDesDe,
      altreCompte,
      pendents,
      nomesLectura,
      desfasMs,
      versioAntiga,
      tancarAvisVersioAntiga,
    }),
    [
      estat,
      ultimaCopia,
      pendent,
      error,
      connectar,
      sincronitzarAra,
      provarCopiesAnteriors,
      infoDrive,
      darreraCorrecta,
      senseCopiaDesDe,
      altreCompte,
      pendents,
      nomesLectura,
      desfasMs,
      versioAntiga,
      tancarAvisVersioAntiga,
    ],
  )
  return (
    <Context.Provider value={valor}>
      <ProveidorRevisio revisio={revisio}>{children}</ProveidorRevisio>
    </Context.Provider>
  )
}

export function useSincronia(): ValorSincronia {
  const v = useContext(Context)
  if (!v) throw new Error('useSincronia fora de ProveidorSincronia')
  return v
}
