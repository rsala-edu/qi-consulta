import { Indicador } from '../../components/Indicador'
import { nomComplet } from '../../domini/pacient'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { FormulariFitxaClinica } from './FormulariFitxaClinica'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaFitxaClinica() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [carrega, substituir] = useCarrega(async () => {
    const fitxa = await magatzem.obtenirFitxaClinica(pacient.id)
    return { fitxa, conflictes: await magatzem.conflictesDe(fitxa.id) }
  }, [magatzem, pacient.id])

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>

  const { id: _id, pacientId: _p, creatAt: _c, modificatAt: _m, ...dades } = carrega.dades.fitxa
  return (
    <section>
      <FormulariFitxaClinica
        key={pacient.id}
        valorsInicials={dades}
        esborrany={{
          clau: `pacient:${pacient.id}:fitxa-clinica`,
          descripcio: formatar(t.esborranys.fitxaClinicaDe, { nom: nomComplet(pacient) }),
        }}
        onDesar={async (noves) => {
          await magatzem.desarFitxaClinica(pacient.id, noves)
        }}
        conflictes={carrega.dades.conflictes}
        onResolt={async (c) => {
          await magatzem.resoldreConflicte(c.conflicteId, c.camp)
          substituir({
            ...carrega.dades,
            conflictes: carrega.dades.conflictes.filter((x) => !(x.conflicteId === c.conflicteId && x.camp === c.camp)),
          })
        }}
      />
    </section>
  )
}
