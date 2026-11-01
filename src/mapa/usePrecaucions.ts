import { useCallback, useEffect, useState } from 'react'
import {
  confirmarCategoria,
  desarExcepcio,
  desconfirmarCategoria,
  llegirRevisioPrecaucions,
  treureExcepcio,
  type RevisioDesada,
} from '../db/precaucions'
import type { CategoriaPrecaucio } from '../punts/esquema'
import { useSessio } from '../sessio/ContextSessio'

/** Precaucions revisades per la doctora en aquest dispositiu (per categories i excepcions). */
export function usePrecaucions(): {
  revisio: RevisioDesada | null
  confirmar(categoria: CategoriaPrecaucio): Promise<void>
  tornarAPendent(categoria: CategoriaPrecaucio): Promise<void>
  desarExcepcio(codi: string, precaucio: { categories: CategoriaPrecaucio[]; nota: string }): Promise<void>
  treureExcepcio(codi: string): Promise<void>
} {
  const { db } = useSessio()
  const [revisio, setRevisio] = useState<RevisioDesada | null>(null)

  const recarregar = useCallback(async () => {
    setRevisio(await llegirRevisioPrecaucions(db))
  }, [db])

  useEffect(() => {
    let actiu = true
    void llegirRevisioPrecaucions(db).then((r) => actiu && setRevisio(r))
    return () => {
      actiu = false
    }
  }, [db])

  return {
    revisio,
    confirmar: useCallback(
      async (c: CategoriaPrecaucio) => {
        await confirmarCategoria(db, c)
        await recarregar()
      },
      [db, recarregar],
    ),
    tornarAPendent: useCallback(
      async (c: CategoriaPrecaucio) => {
        await desconfirmarCategoria(db, c)
        await recarregar()
      },
      [db, recarregar],
    ),
    desarExcepcio: useCallback(
      async (codi: string, p: { categories: CategoriaPrecaucio[]; nota: string }) => {
        await desarExcepcio(db, codi, p)
        await recarregar()
      },
      [db, recarregar],
    ),
    treureExcepcio: useCallback(
      async (codi: string) => {
        await treureExcepcio(db, codi)
        await recarregar()
      },
      [db, recarregar],
    ),
  }
}
