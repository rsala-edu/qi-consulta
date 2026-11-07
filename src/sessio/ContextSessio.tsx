// Estat de la sessió d'ús: si l'app està bloquejada o oberta.
// La clau mestra només viu aquí, en memòria, i dins del magatzem.
// En bloquejar (o tancar l'app) es perd i cal tornar a obrir-la amb la
// contrasenya, l'empremta o (si s'ha oblidat la contrasenya) la clau de
// recuperació.
//
// Un espai per compte de Google (espais.ts): cada compte té la seva base de
// dades, la seva contrasenya i la seva empremta. En arrencar s'obre l'espai de
// l'últim compte; «Entrar amb un altre compte de Google» obre el d'un altre.
// Un permís de Google d'un compte que no és el de l'espai obert no es fa
// servir mai per a res (google.ts, acceptarPermis).
//
// Primer ús d'un compte (amb Google configurat): si a Drive ja hi ha una
// còpia, només es pot recuperar (amb la contrasenya o la clau de recuperació);
// si no, es crea la contrasenya. Drive es torna a mirar just abans de crear-la:
// un dispositiu no pot començar mai de zero si a Drive ja hi ha dades.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { crearClauMestra, desbloquejarClauMestra, passkeyDisponible } from '../crypto'
import { QiDB } from '../db/esquema'
import {
  crearMagatzem,
  guardarClauEmbolcallada,
  guardarEstatGoogle,
  llegirClauEmbolcallada,
  llegirEstatGoogle,
  guardarMinutsBloqueig,
  llegirMinutsBloqueig,
  MINUTS_BLOQUEIG_PER_DEFECTE,
  type Magatzem,
} from '../db/magatzem'
import { driveGoogle } from '../sincronia/drive'
import { acceptarPermis, adoptarPermisRebutjat, googleConfigurat, iniciarSessioGoogle, tokenGoogle } from '../sincronia/google'
import { copiaPerRecuperar, obrirClauMestra, restaurarCopia } from '../sincronia/recuperacio'
import type { CopiaDrive } from '../sincronia/sincronitzar'
import { desbloquejarAmbEmpremta, recuperarAmbClau, teClauRecuperacio, teEmpremta } from './claus'
import { BASE_ANTIGA, marcarEspaiActual, migrarBaseAntiga, obrirEspai } from './espais'
import { demanarPersistencia } from './persistencia'
import { useAutoBloqueig } from './useAutoBloqueig'

export type EstatSessio =
  | { tipus: 'carregant' }
  /** Cap espai obert: cal entrar amb Google (només si Google està configurat) */
  | { tipus: 'sense-google' }
  | { tipus: 'sense-configurar' }
  /** A Drive hi ha una còpia: s'obre amb la contrasenya o la clau de recuperació */
  | { tipus: 'restaurar'; fitxer: CopiaDrive }
  | { tipus: 'bloquejat'; empremta: boolean; recuperacio: boolean }
  | { tipus: 'desbloquejat'; magatzem: Magatzem; clau: CryptoKey }

interface ValorSessio {
  estat: EstatSessio
  /** Base de dades local de l'espai obert (per a dades que no són de pacient, com el calibratge) */
  db: QiDB
  /** Nom de la base de dades de l'espai obert (canvia en canviar de compte) */
  espai: string | null
  /**
   * S'ha de cridar directament des d'un toc (obre la finestra de Google).
   * `altreCompte`: des de la pantalla de bloqueig, per obrir l'espai d'un altre compte.
   * Des de dins l'app, un compte que no és el de l'espai llança ErrorGoogle('altreCompte').
   */
  connectarGoogle(opcions?: { altreCompte?: boolean }): Promise<void>
  /** Bloqueja i obre l'espai d'un altre compte (amb el permís que ja s'ha donat, si n'hi ha) */
  canviarAlCompte(sub: string): Promise<void>
  crearContrasenya(contrasenya: string): Promise<void>
  desbloquejar(contrasenya: string): Promise<void>
  desbloquejarAmbEmpremta(): Promise<void>
  /** Contrasenya oblidada: clau de recuperació i contrasenya nova */
  recuperar(clauRecuperacio: string, contrasenyaNova: string): Promise<void>
  bloquejar(): void
  /**
   * El dispositiu passa a fer servir una altra clau mestra (la de Drive,
   * després de recuperar-ne les dades o de fusionar-s'hi)
   */
  adoptarClau(clau: CryptoKey): void
  /**
   * Retenció de les agulles en marxa fins a aquesta hora (ms): mentrestant no
   * es bloqueja per inactivitat (la doctora és a la sala, sense tocar la
   * tauleta). Després, torna a comptar el temps de sempre. null: cap.
   */
  suspendreBloqueig(fins: number | null): void
  /** Minuts sense activitat abans de bloquejar (Ajustos > Seguretat) */
  minutsBloqueig: number
  canviarMinutsBloqueig(minuts: number): Promise<void>
}

const Context = createContext<ValorSessio | null>(null)

export const DEU_MINUTS = 10 * 60 * 1000

async function estatBloquejat(db: QiDB): Promise<EstatSessio> {
  return {
    tipus: 'bloquejat',
    empremta: (await teEmpremta(db)) && (await passkeyDisponible()),
    recuperacio: await teClauRecuperacio(db),
  }
}

/** L'estat en obrir un espai: bloquejat si ja té contrasenya; si no, cal Google (o crear-la) */
async function estatEnObrir(db: QiDB | null): Promise<EstatSessio> {
  if (db && (await llegirClauEmbolcallada(db))) return estatBloquejat(db)
  // Encara que ja s'hi hagués connectat: cal tornar a mirar Drive
  if (googleConfigurat()) return { tipus: 'sense-google' }
  return { tipus: 'sense-configurar' }
}

export function ProveidorSessio({
  db: inicial,
  children,
  msInactivitat,
}: {
  /** L'espai que s'obre en arrencar (espais.ts, espaiInicial). null: cap encara */
  db: QiDB | null
  children: ReactNode
  /** Per a les proves: substitueix l'ajust de minuts */
  msInactivitat?: number
}) {
  const [db, setDb] = useState<QiDB | null>(inicial)
  const navegar = useNavigate()
  const [estat, setEstat] = useState<EstatSessio>({ tipus: 'carregant' })
  const [minutsBloqueig, setMinutsBloqueig] = useState(MINUTS_BLOQUEIG_PER_DEFECTE)

  useEffect(() => {
    if (!db) return
    let actiu = true
    void llegirMinutsBloqueig(db).then((m) => actiu && setMinutsBloqueig(m))
    return () => {
      actiu = false
    }
  }, [db])

  const canviarMinutsBloqueig = useCallback(
    async (minuts: number) => {
      await guardarMinutsBloqueig(db!, minuts)
      setMinutsBloqueig(minuts)
    },
    [db],
  )

  useEffect(() => {
    let actiu = true
    void estatEnObrir(db).then((nou) => actiu && setEstat(nou))
    return () => {
      actiu = false
    }
    // Només en arrencar: els canvis d'espai ja posen l'estat que toca
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const obrir = useCallback(
    (clau: CryptoKey) => setEstat({ tipus: 'desbloquejat', magatzem: crearMagatzem(db!, clau), clau }),
    [db],
  )

  /** Obre l'espai d'un compte (i hi migra la base de dades d'abans, si és la que hi ha oberta) */
  const anarAlCompte = useCallback(
    async (sub: string): Promise<QiDB> => {
      if (db?.name === BASE_ANTIGA) {
        const g = await llegirEstatGoogle(db)
        // La d'abans és d'aquest compte si no en recordava cap o si és el mateix
        if (!g?.sub || g.sub === sub) {
          const nova = await migrarBaseAntiga(db, sub)
          setDb(nova)
          return nova
        }
      }
      const nova = await obrirEspai(sub)
      if (nova.name !== db?.name) {
        // Cap pantalla (ni l'adreça, que pot portar l'id d'un pacient) passa d'un compte a l'altre
        if (db) void navegar('/', { replace: true })
        db?.close()
        setDb(nova)
      }
      return nova
    },
    [db, navegar],
  )

  /** Després d'entrar amb Google en un espai: si no té contrasenya, es mira Drive */
  const despresDeGoogle = useCallback(async (espai: QiDB, sub: string) => {
    const anterior = await llegirEstatGoogle(espai)
    await guardarEstatGoogle(espai, { connectatAt: new Date().toISOString(), ultimaCopia: anterior?.ultimaCopia ?? null, sub })
    if (!(await llegirClauEmbolcallada(espai))) {
      const fitxer = await copiaPerRecuperar(driveGoogle(tokenGoogle))
      setEstat(fitxer ? { tipus: 'restaurar', fitxer } : { tipus: 'sense-configurar' })
    } else setEstat(await estatBloquejat(espai))
  }, [])

  const connectarGoogle = useCallback(
    async ({ altreCompte = false }: { altreCompte?: boolean } = {}) => {
      // La finestra s'obre abans de cap espera: ha de ser dins el mateix toc
      const triar = estat.tipus === 'sense-google' || altreCompte
      const finestra = iniciarSessioGoogle({ mode: triar ? 'triar' : 'normal' })
      const esperat = triar || !db ? null : ((await llegirEstatGoogle(db))?.sub ?? null)
      const { sub } = await acceptarPermis(await finestra, undefined, esperat)
      if (triar) {
        // Des de la pantalla de bloqueig: res de l'espai d'abans es queda a la
        // pantalla mentre s'obre el nou. Si falla (Drive), es torna a «Continuar
        // amb Google», que mostra el motiu
        if (altreCompte) setEstat({ tipus: 'carregant' })
        try {
          const espai = await anarAlCompte(sub)
          await despresDeGoogle(espai, sub)
        } catch (e) {
          if (altreCompte) setEstat({ tipus: 'sense-google' })
          throw e
        }
        return
      }
      // Dins el mateix espai (tornar a connectar, recuperar): el compte és el mateix
      const anterior = await llegirEstatGoogle(db!)
      await guardarEstatGoogle(db!, { connectatAt: new Date().toISOString(), ultimaCopia: anterior?.ultimaCopia ?? null, sub })
      if (!(await llegirClauEmbolcallada(db!))) {
        const fitxer = await copiaPerRecuperar(driveGoogle(tokenGoogle))
        setEstat(fitxer ? { tipus: 'restaurar', fitxer } : { tipus: 'sense-configurar' })
      }
    },
    [db, estat.tipus, anarAlCompte, despresDeGoogle],
  )

  const canviarAlCompte = useCallback(
    async (sub: string) => {
      setEstat({ tipus: 'carregant' })
      const espai = await anarAlCompte(sub)
      if (adoptarPermisRebutjat(sub)) await despresDeGoogle(espai, sub)
      else setEstat(await estatEnObrir(espai))
    },
    [anarAlCompte, despresDeGoogle],
  )

  const crearContrasenya = useCallback(
    async (contrasenya: string) => {
      const espai = db ?? new QiDB(BASE_ANTIGA)
      if (!db) setDb(espai)
      if (await llegirClauEmbolcallada(espai)) throw new Error('La contrasenya ja està creada')
      if (googleConfigurat()) {
        // Un altre dispositiu pot haver pujat dades des que s'ha mirat Drive
        if (!tokenGoogle()) return setEstat({ tipus: 'sense-google' })
        const fitxer = await copiaPerRecuperar(driveGoogle(tokenGoogle))
        if (fitxer) return setEstat({ tipus: 'restaurar', fitxer })
      }
      const { embolcall, clau } = await crearClauMestra(contrasenya)
      await guardarClauEmbolcallada(espai, embolcall)
      marcarEspaiActual(espai.name)
      void demanarPersistencia(espai)
      setEstat({ tipus: 'desbloquejat', magatzem: crearMagatzem(espai, clau), clau })
    },
    [db],
  )

  const desbloquejar = useCallback(
    async (contrasenya: string) => {
      if (estat.tipus === 'restaurar') {
        const clau = await obrirClauMestra(estat.fitxer, contrasenya)
        await restaurarCopia(db!, clau, estat.fitxer, driveGoogle(tokenGoogle))
        void demanarPersistencia(db!)
        return obrir(clau)
      }
      const embolcall = await llegirClauEmbolcallada(db!)
      if (!embolcall) throw new Error('No hi ha cap contrasenya creada')
      obrir(await desbloquejarClauMestra(embolcall, contrasenya))
    },
    [db, estat, obrir],
  )

  const desbloquejarEmpremta = useCallback(async () => obrir(await desbloquejarAmbEmpremta(db!)), [db, obrir])

  const recuperar = useCallback(
    async (text: string, contrasenyaNova: string) => {
      if (estat.tipus === 'restaurar') {
        const clau = await recuperarAmbClau(db!, text, contrasenyaNova, estat.fitxer.embolcalls.secrets)
        // La còpia porta la contrasenya antiga: es restaura i es torna a posar la nova
        const nova = await llegirClauEmbolcallada(db!)
        await restaurarCopia(db!, clau, estat.fitxer, driveGoogle(tokenGoogle))
        await guardarClauEmbolcallada(db!, nova!)
        void demanarPersistencia(db!)
        return obrir(clau)
      }
      obrir(await recuperarAmbClau(db!, text, contrasenyaNova))
    },
    [db, estat, obrir],
  )

  const bloquejar = useCallback(() => {
    if (!db) return
    setEstat((e) => (e.tipus === 'desbloquejat' ? { tipus: 'carregant' } : e))
    void estatBloquejat(db).then((nou) => setEstat((e) => (e.tipus === 'carregant' ? nou : e)))
  }, [db])

  const [suspesFins, suspendreBloqueig] = useState<number | null>(null)
  const [suspes, setSuspes] = useState(false)
  useEffect(() => {
    const queda = suspesFins === null ? 0 : suspesFins - Date.now()
    setSuspes(queda > 0)
    if (queda <= 0) return
    const tmp = window.setTimeout(() => setSuspes(false), queda)
    return () => window.clearTimeout(tmp)
  }, [suspesFins])
  useAutoBloqueig(estat.tipus === 'desbloquejat' && !suspes, bloquejar, msInactivitat ?? minutsBloqueig * 60_000)

  const valor = useMemo<ValorSessio>(
    () => ({
      estat,
      get db(): QiDB {
        if (!db) throw new Error('Cap espai obert')
        return db
      },
      espai: db?.name ?? null,
      connectarGoogle,
      canviarAlCompte,
      crearContrasenya,
      desbloquejar,
      desbloquejarAmbEmpremta: desbloquejarEmpremta,
      recuperar,
      bloquejar,
      adoptarClau: obrir,
      suspendreBloqueig,
      minutsBloqueig,
      canviarMinutsBloqueig,
    }),
    [
      estat,
      db,
      connectarGoogle,
      canviarAlCompte,
      crearContrasenya,
      desbloquejar,
      desbloquejarEmpremta,
      recuperar,
      bloquejar,
      obrir,
      minutsBloqueig,
      canviarMinutsBloqueig,
    ],
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

/** Clau mestra (no extractable), per xifrar la còpia de Drive. */
export function useClauMestra(): CryptoKey {
  const { estat } = useSessio()
  if (estat.tipus !== 'desbloquejat') throw new Error('L\'app està bloquejada')
  return estat.clau
}
