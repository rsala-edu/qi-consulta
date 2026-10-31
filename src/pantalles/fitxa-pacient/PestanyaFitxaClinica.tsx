import { Indicador } from '../../components/Indicador'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { FormulariFitxaClinica } from './FormulariFitxaClinica'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaFitxaClinica() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [carrega] = useCarrega(() => magatzem.obtenirFitxaClinica(pacient.id), [magatzem, pacient.id])

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>

  const { id: _id, pacientId: _p, creatAt: _c, modificatAt: _m, ...dades } = carrega.dades
  return (
    <section>
      <FormulariFitxaClinica
        key={pacient.id}
        valorsInicials={dades}
        onDesar={async (noves) => {
          await magatzem.desarFitxaClinica(pacient.id, noves)
        }}
      />
    </section>
  )
}
