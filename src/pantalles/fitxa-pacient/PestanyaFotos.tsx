// Pestanya «Fotos» de la fitxa del pacient (etapa 4C): fer-ne (amb el
// consentiment d'imatges vigent), la galeria amb «Comparar» i les esborrades.

import { useState } from 'react'
import { Indicador } from '../../components/Indicador'
import { episodisActius } from '../../domini/episodi'
import { BotoFerFoto, GaleriaFotos } from '../../fotos/Fotos'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaFotos() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const [fotos, sessions, episodis] = await Promise.all([magatzem.fotosDe(pacient.id), magatzem.sessionsDelPacient(pacient.id), magatzem.llistarEpisodis(pacient.id)])
    return { fotos, sessions, episodi: episodisActius(episodis)[0]?.id ?? null }
  }, [magatzem, pacient.id, versio])
  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>
  const { fotos, sessions, episodi } = carrega.dades
  return (
    <section className="pestanya-fotos" aria-label={t.fotos.titol}>
      <div className="accions accions-esquerra">
        <BotoFerFoto pacientId={pacient.id} episodiId={episodi} sessioId={null} tornar={`/pacients/${pacient.id}/fotos`} onDesada={() => setVersio((n) => n + 1)} />
      </div>
      <GaleriaFotos fotos={fotos} numeroSessio={(id) => sessions.find((s) => s.id === id)?.numero} onCanvi={() => setVersio((n) => n + 1)} />
    </section>
  )
}
