import { useCallback, useEffect, useState } from 'react'
import { confirmarPrecaucio, llistarPrecaucions, type RevisioPrecaucio } from '../db/precaucions'
import { useSessio } from '../sessio/ContextSessio'

/** Precaucions revisades per la doctora en aquest dispositiu. */
export function usePrecaucions(): {
  revisions: RevisioPrecaucio[] | null
  confirmar(codi: string, precaucio: { embaras: boolean; nota: string }): Promise<void>
} {
  const { db } = useSessio()
  const [revisions, setRevisions] = useState<RevisioPrecaucio[] | null>(null)

  useEffect(() => {
    let actiu = true
    void llistarPrecaucions(db).then((l) => actiu && setRevisions(l))
    return () => {
      actiu = false
    }
  }, [db])

  const confirmar = useCallback(
    async (codi: string, precaucio: { embaras: boolean; nota: string }) => {
      const r = await confirmarPrecaucio(db, codi, precaucio)
      setRevisions((l) => [...(l ?? []).filter((x) => x.codi !== codi), r])
    },
    [db],
  )

  return { revisions, confirmar }
}
