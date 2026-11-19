// Pestanya «Documents» de la fitxa del pacient (etapa 4E): informes,
// analítiques, audiometries i altres proves; «Fotografiar document» i «Pujar
// fitxer» (o arrossegar-los, al PC). Els nous van a l'episodi actiu (es pot canviar).

import { Indicador } from '../../components/Indicador'
import { PanellDocuments } from '../../documents/Documents'
import { episodisActius, nomEpisodi } from '../../domini/episodi'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaDocuments() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [carrega] = useCarrega(() => magatzem.llistarEpisodis(pacient.id), [magatzem, pacient.id])
  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>
  const episodis = [...carrega.dades].sort((a, b) => b.dataInici.localeCompare(a.dataInici))
  return (
    <section className="pestanya-documents" aria-label={t.documents.titol}>
      <PanellDocuments
        context={{
          pacientId: pacient.id,
          episodiId: episodisActius(carrega.dades)[0]?.id ?? null,
          episodis: episodis.map((e) => ({ id: e.id, nom: `${nomEpisodi(e) || t.documents.episodi} · ${new Date(`${e.dataInici}T12:00:00`).toLocaleDateString('ca')}` })),
        }}
      />
    </section>
  )
}
