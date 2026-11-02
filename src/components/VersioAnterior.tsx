// Un camp clínic amb dues versions (editat en dos dispositius alhora): mostra
// l'altra versió i deixa triar «Quedar-me aquesta» o «Recuperar l'altra».

import { useState } from 'react'
import type { CampEnConflicte } from '../db/magatzem'
import { formatar, t } from '../i18n/t'
import { Boto } from './Boto'

function text(v: unknown): string {
  if (v === '' || v === null || v === undefined) return t.conflictes.buit
  return typeof v === 'string' ? v : JSON.stringify(v)
}

function quan(iso: string): string {
  const d = new Date(iso)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} a les ${dos(d.getHours())}:${dos(d.getMinutes())}`
}

export function VersioAnterior({
  conflicte,
  etiqueta,
  onQuedar,
  onRecuperar,
}: {
  conflicte: CampEnConflicte
  /** Nom del camp, si no és al costat del camp mateix */
  etiqueta?: string
  onQuedar(): Promise<void>
  onRecuperar(): Promise<void>
}) {
  const [ocupat, setOcupat] = useState(false)
  const fer = (f: () => Promise<void>) => {
    setOcupat(true)
    void f().finally(() => setOcupat(false))
  }
  return (
    <div className="versio-anterior" data-camp={conflicte.camp}>
      <p className="detall">
        {etiqueta && <strong>{etiqueta} · </strong>}
        {formatar(t.conflictes.altraVersio, { quan: quan(conflicte.versioAt) })}
      </p>
      <p className="valor-anterior">{text(conflicte.valor)}</p>
      <div className="accions accions-esquerra">
        <Boto variant="secundari" disabled={ocupat} onClick={() => fer(onQuedar)}>
          {t.conflictes.quedarMe}
        </Boto>
        <Boto variant="discret" disabled={ocupat} onClick={() => fer(onRecuperar)}>
          {t.conflictes.recuperar}
        </Boto>
      </div>
    </div>
  )
}
