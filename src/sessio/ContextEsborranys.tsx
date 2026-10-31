// Esborranys dels formularis oberts. En desbloquejar es carreguen els que
// han quedat pendents i el diàleg ofereix recuperar-los.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { Magatzem } from '../db/magatzem'
import type { Esborrany, EsborranyGuardat } from '../domini/esborrany'

interface ValorEsborranys {
  /** null mentre es carreguen */
  pendents: Esborrany[] | null
  /** Esborrany triat per recuperar, fins que el formulari corresponent el consumeix */
  recuperant: Esborrany | null
  desar(clau: string, esborrany: EsborranyGuardat): Promise<void>
  esborrar(clau: string): Promise<void>
  recuperar(e: Esborrany): void
  descartar(e: Esborrany): Promise<void>
  tancarAvis(): void
  consumir(): void
}

const Context = createContext<ValorEsborranys | null>(null)

export function ProveidorEsborranys({ magatzem, children }: { magatzem: Magatzem; children: ReactNode }) {
  const navegar = useNavigate()
  const [pendents, setPendents] = useState<Esborrany[] | null>(null)
  const [recuperant, setRecuperant] = useState<Esborrany | null>(null)

  useEffect(() => {
    let actiu = true
    magatzem.llistarEsborranys().then(
      (llista) => actiu && setPendents(llista),
      () => actiu && setPendents([]),
    )
    return () => {
      actiu = false
    }
  }, [magatzem])

  const desar = useCallback(
    (clau: string, e: EsborranyGuardat) => magatzem.desarEsborrany(clau, e),
    [magatzem],
  )
  const esborrar = useCallback((clau: string) => magatzem.esborrarEsborrany(clau), [magatzem])

  const recuperar = useCallback(
    (e: Esborrany) => {
      setRecuperant(e)
      setPendents([]) // tanca el diàleg; els altres es tornaran a oferir el pròxim cop
      navegar(e.ruta)
    },
    [navegar],
  )

  const descartar = useCallback(
    async (e: Esborrany) => {
      await magatzem.esborrarEsborrany(e.clau)
      setPendents((p) => p && p.filter((x) => x.clau !== e.clau))
    },
    [magatzem],
  )

  const tancarAvis = useCallback(() => setPendents([]), [])
  const consumir = useCallback(() => setRecuperant(null), [])

  const valor = useMemo(
    () => ({ pendents, recuperant, desar, esborrar, recuperar, descartar, tancarAvis, consumir }),
    [pendents, recuperant, desar, esborrar, recuperar, descartar, tancarAvis, consumir],
  )
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useEsborranys(): ValorEsborranys {
  const valor = useContext(Context)
  if (!valor) throw new Error('useEsborranys fora de ProveidorEsborranys')
  return valor
}
