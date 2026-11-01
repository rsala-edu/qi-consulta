// Estat de la sessió d'ús: si l'app està bloquejada o oberta.
// La clau mestra només viu aquí, en memòria, i dins del magatzem.
// En bloquejar (o tancar l'app) es perd i cal tornar a obrir-la amb la
// contrasenya, l'empremta o (si s'ha oblidat la contrasenya) la clau de
// recuperació.
//
// Primer ús en un dispositiu (amb Google configurat): «Continuar amb Google».
// Si a Drive ja hi ha una còpia, es restaura amb la contrasenya; si no, es
// crea la contrasenya.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { crearClauMestra, desbloquejarClauMestra, passkeyDisponible } from '../crypto'
import type { QiDB } from '../db/esquema'
import {
  crearMagatzem,
  guardarClauEmbolcallada,
  guardarEstatGoogle,
  llegirClauEmbolcallada,
  llegirEstatGoogle,
  type Magatzem,
} from '../db/magatzem'
import type { FitxerCopia } from '../sincronia/copia'
import { driveGoogle } from '../sincronia/drive'
import { acceptarPermis, googleConfigurat, iniciarSessioGoogle, tokenGoogle } from '../sincronia/google'
import { copiaDeDrive, restaurarCopia } from '../sincronia/sincronitzar'
import { desbloquejarAmbEmpremta, recuperarAmbClau, teClauRecuperacio, teEmpremta } from './claus'
import { useAutoBloqueig } from './useAutoBloqueig'

export type EstatSessio =
  | { tipus: 'carregant' }
  /** Dispositiu nou, encara sense Google (només si Google està configurat) */
  | { tipus: 'sense-google' }
  | { tipus: 'sense-configurar' }
  /** A Drive hi ha una còpia: s'obre amb la contrasenya o la clau de recuperació */
  | { tipus: 'restaurar'; fitxer: FitxerCopia }
  | { tipus: 'bloquejat'; empremta: boolean; recuperacio: boolean }
  | { tipus: 'desbloquejat'; magatzem: Magatzem; clau: CryptoKey }

interface ValorSessio {
  estat: EstatSessio
  /** Base de dades local (per a dades que no són de pacient, com el calibratge) */
  db: QiDB
  /** S'ha de cridar directament des d'un toc (obre la finestra de Google) */
  connectarGoogle(): Promise<void>
  crearContrasenya(contrasenya: string): Promise<void>
  desbloquejar(contrasenya: string): Promise<void>
  desbloquejarAmbEmpremta(): Promise<void>
  /** Contrasenya oblidada: clau de recuperació i contrasenya nova */
  recuperar(clauRecuperacio: string, contrasenyaNova: string): Promise<void>
  bloquejar(): void
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
    void (async () => {
      const embolcall = await llegirClauEmbolcallada(db)
      let nou: EstatSessio
      if (embolcall) nou = await estatBloquejat(db)
      else if (googleConfigurat() && !(await llegirEstatGoogle(db))) nou = { tipus: 'sense-google' }
      else nou = { tipus: 'sense-configurar' }
      if (actiu) setEstat(nou)
    })()
    return () => {
      actiu = false
    }
  }, [db])

  const obrir = useCallback((clau: CryptoKey) => setEstat({ tipus: 'desbloquejat', magatzem: crearMagatzem(db, clau), clau }), [db])

  const connectarGoogle = useCallback(async () => {
    // La finestra s'obre abans de cap espera: ha de ser dins el mateix toc
    const finestra = iniciarSessioGoogle({ triarCompte: estat.tipus === 'sense-google' })
    await acceptarPermis(await finestra)
    const anterior = await llegirEstatGoogle(db)
    await guardarEstatGoogle(db, { connectatAt: new Date().toISOString(), ultimaCopia: anterior?.ultimaCopia ?? null })
    // Dispositiu nou: si ja hi ha dades a Drive, es restauren
    if (!(await llegirClauEmbolcallada(db))) {
      const fitxer = await copiaDeDrive(driveGoogle(tokenGoogle))
      setEstat(fitxer ? { tipus: 'restaurar', fitxer } : { tipus: 'sense-configurar' })
    }
  }, [db, estat.tipus])

  const crearContrasenya = useCallback(
    async (contrasenya: string) => {
      if (await llegirClauEmbolcallada(db)) throw new Error('La contrasenya ja està creada')
      const { embolcall, clau } = await crearClauMestra(contrasenya)
      await guardarClauEmbolcallada(db, embolcall)
      obrir(clau)
    },
    [db, obrir],
  )

  const desbloquejar = useCallback(
    async (contrasenya: string) => {
      if (estat.tipus === 'restaurar') {
        const clau = await desbloquejarClauMestra(estat.fitxer.embolcalls.contrasenya, contrasenya)
        await restaurarCopia(db, clau, estat.fitxer)
        return obrir(clau)
      }
      const embolcall = await llegirClauEmbolcallada(db)
      if (!embolcall) throw new Error('No hi ha cap contrasenya creada')
      obrir(await desbloquejarClauMestra(embolcall, contrasenya))
    },
    [db, estat, obrir],
  )

  const desbloquejarEmpremta = useCallback(async () => obrir(await desbloquejarAmbEmpremta(db)), [db, obrir])

  const recuperar = useCallback(
    async (text: string, contrasenyaNova: string) => {
      if (estat.tipus === 'restaurar') {
        const clau = await recuperarAmbClau(db, text, contrasenyaNova, estat.fitxer.embolcalls.secrets)
        // La còpia porta la contrasenya antiga: es restaura i es torna a posar la nova
        const nova = await llegirClauEmbolcallada(db)
        await restaurarCopia(db, clau, estat.fitxer)
        await guardarClauEmbolcallada(db, nova!)
        return obrir(clau)
      }
      obrir(await recuperarAmbClau(db, text, contrasenyaNova))
    },
    [db, estat, obrir],
  )

  const bloquejar = useCallback(() => {
    setEstat((e) => (e.tipus === 'desbloquejat' ? { tipus: 'carregant' } : e))
    void estatBloquejat(db).then((nou) => setEstat((e) => (e.tipus === 'carregant' ? nou : e)))
  }, [db])

  useAutoBloqueig(estat.tipus === 'desbloquejat', bloquejar, msInactivitat)

  const valor = useMemo(
    () => ({
      estat,
      db,
      connectarGoogle,
      crearContrasenya,
      desbloquejar,
      desbloquejarAmbEmpremta: desbloquejarEmpremta,
      recuperar,
      bloquejar,
    }),
    [estat, db, connectarGoogle, crearContrasenya, desbloquejar, desbloquejarEmpremta, recuperar, bloquejar],
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
