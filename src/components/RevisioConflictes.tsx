// Revisió dels camps d'un registre (dades del pacient, una cita) editats en
// dos dispositius alhora: un avís suau i, per a cada camp, l'altra versió.

import type { CampEnConflicte } from '../db/magatzem'
import { t } from '../i18n/t'
import { VersioAnterior } from './VersioAnterior'

export function RevisioConflictes({
  conflictes,
  etiquetes,
  onQuedar,
  onRecuperar,
}: {
  conflictes: readonly CampEnConflicte[]
  etiquetes: Record<string, string>
  onQuedar(c: CampEnConflicte): Promise<void>
  onRecuperar(c: CampEnConflicte): Promise<void>
}) {
  if (conflictes.length === 0) return null
  return (
    <section className="revisio-conflictes" aria-label={t.conflictes.avisRegistre}>
      <p className="avis avis-conflicte" role="status">
        {t.conflictes.avisRegistre}
      </p>
      {conflictes.map((c) => (
        <VersioAnterior
          key={`${c.conflicteId}|${c.camp}`}
          conflicte={c}
          etiqueta={etiquetes[c.camp] ?? c.camp}
          onQuedar={() => onQuedar(c)}
          onRecuperar={() => onRecuperar(c)}
        />
      ))}
    </section>
  )
}
