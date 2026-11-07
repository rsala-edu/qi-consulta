// Temporitzador de retenció de les agulles, per a tota l'app: funciona igual
// amb l'app oberta que bloquejada (docs/especificacions.md, etapa 3A).
//
// - La visita hi registra la retenció en marxa (hora d'inici, minuts i l'id de
//   la sessió: cap dada del pacient), que es desa a la base de dades en clar.
// - La pantalla de bloqueig la mostra («Retenció · 12:34»), sense cap dada.
// - En acabar, sona un so curt una sola vegada (si està activat a Ajustos >
//   Visita), sigui on sigui l'app.
// - Si s'acaba amb l'app bloquejada, en desbloquejar surt una franja que ho diu
//   i porta a la visita.
// El temps sempre es calcula a partir de l'hora d'inici, mai amb un comptador.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { llegirAjustosVisita } from '../db/ajustosVisita'
import type { QiDB } from '../db/esquema'
import { formatTemps, tempsRestant } from '../domini/sessio'
import { formatar, t } from '../i18n/t'
import { soCurt } from '../pantalles/visita/Temporitzador'

export interface RetencioEnMarxa {
  iniciAt: string
  minuts: number
  sessioId: string
  /** Ja ha sonat l'avís de final */
  avisat: boolean
  /** La doctora ja ha vist que ha acabat (ha tornat a la visita) */
  vista: boolean
}

interface ValorRetencio {
  retencio: RetencioEnMarxa | null
  /** Mil·lisegons que queden (negatiu: acabada); null si no n'hi ha cap */
  restant: number | null
  /** La visita registra (o treu, amb null) la retenció en marxa */
  registrar(r: Pick<RetencioEnMarxa, 'iniciAt' | 'minuts' | 'sessioId'> | null): void
  /** S'ha vist que ha acabat (en obrir la visita) */
  marcarVista(): void
}

const Context = createContext<ValorRetencio | null>(null)

export function ProveidorRetencio({ db, children }: { db: QiDB | null; children: ReactNode }) {
  const [retencio, setRetencio] = useState<RetencioEnMarxa | null>(null)
  const [ara, setAra] = useState(() => Date.now())

  useEffect(() => {
    if (!db) return
    let actiu = true
    void db.meta.get('retencio').then((r) => actiu && setRetencio(r?.clau === 'retencio' ? r.valor : null))
    return () => {
      actiu = false
    }
  }, [db])

  const desar = useCallback(
    (r: RetencioEnMarxa | null) => {
      setRetencio(r)
      if (!db) return
      void (r ? db.meta.put({ clau: 'retencio', valor: r }) : db.meta.delete('retencio'))
    },
    [db],
  )

  const restant = retencio ? tempsRestant(retencio, ara) : null
  const enMarxa = restant !== null && restant > 0

  // Només per dibuixar el compte enrere (i saber quan s'acaba)
  useEffect(() => {
    if (!enMarxa) return
    const i = window.setInterval(() => setAra(Date.now()), 500)
    return () => window.clearInterval(i)
  }, [enMarxa])
  useEffect(() => {
    const tornar = () => setAra(Date.now())
    document.addEventListener('visibilitychange', tornar)
    return () => document.removeEventListener('visibilitychange', tornar)
  }, [])

  // La pantalla no s'apaga mentre dura la retenció (si el navegador ho permet),
  // tant si l'app és oberta com bloquejada
  useEffect(() => {
    if (!enMarxa) return
    let bloqueig: { release(): Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }
    void nav.wakeLock?.request('screen').then(
      (b) => (bloqueig = b),
      () => {},
    )
    return () => void bloqueig?.release().catch(() => {})
  }, [enMarxa])

  // En acabar: un so curt, una sola vegada (si s'acaba ara, no si fa estona)
  useEffect(() => {
    if (!retencio || restant === null || restant > 0 || retencio.avisat) return
    desar({ ...retencio, avisat: true })
    if (!db || restant < -60_000) return
    void llegirAjustosVisita(db).then((a) => a.so && soCurt())
  }, [retencio, restant, db, desar])

  const registrar = useCallback<ValorRetencio['registrar']>(
    (r) => {
      if (!r) return desar(null)
      setAra(Date.now())
      // La mateixa retenció (només ha canviat res més de la sessió): es manté com estava
      setRetencio((actual) => {
        const nova =
          actual && actual.iniciAt === r.iniciAt && actual.minuts === r.minuts && actual.sessioId === r.sessioId
            ? actual
            : { ...r, avisat: false, vista: false }
        if (nova !== actual && db) void db.meta.put({ clau: 'retencio', valor: nova })
        return nova
      })
    },
    [db, desar],
  )
  const marcarVista = useCallback(() => {
    setRetencio((r) => {
      if (!r || r.vista) return r
      const nova = { ...r, vista: true }
      if (db) void db.meta.put({ clau: 'retencio', valor: nova })
      return nova
    })
  }, [db])

  const valor = useMemo(() => ({ retencio, restant, registrar, marcarVista }), [retencio, restant, registrar, marcarVista])
  return <Context.Provider value={valor}>{children}</Context.Provider>
}

export function useRetencio(): ValorRetencio {
  return useContext(Context) ?? { retencio: null, restant: null, registrar: () => {}, marcarVista: () => {} }
}

/** A la pantalla de bloqueig: «Retenció · 12:34», sense cap dada del pacient */
export function RetencioBloqueig() {
  const { restant } = useRetencio()
  if (restant === null) return null
  const acabada = restant <= 0
  return (
    <p className={`retencio-bloqueig${acabada ? ' acabada' : ''}`} role="timer" aria-label={t.visita.retencio}>
      {acabada ? t.visita.acabada : formatar(t.visita.retencioBloqueig, { temps: formatTemps(restant) })}
    </p>
  )
}

/** Franja després de desbloquejar: la retenció ha acabat (i encara no s'ha tornat a la visita) */
export function AvisRetencioAcabada({ onAnar }: { onAnar(sessioId: string): void }) {
  const { retencio, restant, marcarVista } = useRetencio()
  if (!retencio || restant === null || restant > 0 || retencio.vista) return null
  return (
    <p className="franja-avis franja-retencio" role="alert">
      <span>{formatar(t.visita.retencioAcabadaA, { hora: new Date(Date.parse(retencio.iniciAt) + retencio.minuts * 60_000).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' }) })}</span>
      <button
        type="button"
        className="boto boto-discret"
        onClick={() => {
          marcarVista()
          onAnar(retencio.sessioId)
        }}
      >
        {t.visita.tornarVisita}
      </button>
    </p>
  )
}
