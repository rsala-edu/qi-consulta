// Els botons d'informe de cada lloc (etapa 4D): sessió (pestanya Tancar de la
// visita), episodi i historial complet (fitxa > Tractaments).

import { llegirAjustosConsulta } from '../db/ajustosConsulta'
import type { Episodi } from '../domini/episodi'
import type { Pacient } from '../domini/pacient'
import { llistaPunts, type Sessio } from '../domini/sessio'
import { t } from '../i18n/t'
import { useMagatzem, useSessio } from '../sessio/ContextSessio'
import { BotoInforme } from './BotoInforme'
import { nomFitxerInforme } from './nomFitxer'
import { historialPacient, informeEpisodi, informeSessio } from './contingut'
import { imatgesPunts } from './imatgesPunts'
import { generarInforme } from './pdf'

const i = t.informes

export function BotoInformeSessio({ pacient, episodi, sessio }: { pacient: Pacient; episodi: Episodi | null; sessio: Sessio }) {
  const { db } = useSessio()
  return (
    <BotoInforme
      etiqueta={i.sessio}
      generar={async () => {
        const [consulta, imatges] = await Promise.all([llegirAjustosConsulta(db), imatgesPunts(db, llistaPunts(sessio.punts)).catch(() => ({}))])
        const pdf = await generarInforme(informeSessio({ consulta, pacient, episodi, sessio, imatges }))
        return { pdf, nom: nomFitxerInforme('informe-sessio', String(sessio.numero), sessio.iniciAt.slice(0, 10)) }
      }}
    />
  )
}

export function BotoInformeEpisodi({ pacient, episodi, sessions }: { pacient: Pacient; episodi: Episodi; sessions: readonly Sessio[] }) {
  const { db } = useSessio()
  const magatzem = useMagatzem()
  return (
    <BotoInforme
      etiqueta={i.episodi}
      className="informe-episodi-boto"
      generar={async () => {
        const [consulta, valoracions] = await Promise.all([llegirAjustosConsulta(db), magatzem.valoracionsDe(episodi.id)])
        const pdf = await generarInforme(informeEpisodi({ consulta, pacient, episodi, sessions, valoracions }))
        return { pdf, nom: nomFitxerInforme('informe-episodi', episodi.motiu, episodi.dataInici) }
      }}
    />
  )
}

export function BotoHistorial({ pacient }: { pacient: Pacient }) {
  const { db } = useSessio()
  const magatzem = useMagatzem()
  return (
    <BotoInforme
      etiqueta={i.historial}
      generar={async () => {
        const [consulta, episodis, sessions, consentiments] = await Promise.all([
          llegirAjustosConsulta(db),
          magatzem.llistarEpisodis(pacient.id),
          magatzem.sessionsDelPacient(pacient.id),
          magatzem.consentimentsDe(pacient.id),
        ])
        const valoracions = new Map(await Promise.all(episodis.map(async (e) => [e.id, await magatzem.valoracionsDe(e.id)] as const)))
        const pdf = await generarInforme(historialPacient({ consulta, pacient, episodis, sessions, valoracions, consentiments }))
        return { pdf, nom: nomFitxerInforme('historial', pacient.llinatges, new Date().toISOString().slice(0, 10)) }
      }}
    />
  )
}
