import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { AvisDesat } from '../../components/AvisDesat'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { esquemaDadesFitxaClinica, type DadesFitxaClinica } from '../../domini/fitxaClinica'
import { t } from '../../i18n/t'

interface Props {
  valorsInicials: DadesFitxaClinica
  onDesar(dades: DadesFitxaClinica): Promise<void>
}

const CONTRAINDICACIONS = ['anticoagulants', 'embaras', 'marcapassos'] as const
const HABITS = ['son', 'tabac', 'alcohol', 'exercici'] as const

export function FormulariFitxaClinica({ valorsInicials, onDesar }: Props) {
  const [marcaDesat, setMarcaDesat] = useState(0)
  const [errorDesar, setErrorDesar] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DadesFitxaClinica>({
    resolver: zodResolver(esquemaDadesFitxaClinica),
    defaultValues: valorsInicials,
  })
  const c = t.camps.fitxaClinica

  async function enviar(dades: DadesFitxaClinica) {
    setErrorDesar(false)
    try {
      await onDesar(dades)
      reset(dades)
      setMarcaDesat((m) => m + 1)
    } catch {
      setErrorDesar(true)
    }
  }

  return (
    <form className="formulari" onSubmit={handleSubmit(enviar)} noValidate>
      <fieldset className="contraindicacions">
        <legend>{c.contraindicacions}</legend>
        <div className="caselles">
          {CONTRAINDICACIONS.map((k) => (
            <label key={k} className="casella casella-gran">
              <input type="checkbox" {...register(`contraindicacions.${k}`)} />
              {c[k]}
            </label>
          ))}
        </div>
        <Camp etiqueta={c.altresContraindicacions} error={errors.contraindicacions?.altres?.message} ample>
          <input autoComplete="off" {...register('contraindicacions.altres')} />
        </Camp>
      </fieldset>

      <div className="graella">
        <Camp etiqueta={c.alergies} error={errors.alergies?.message} ample>
          <textarea rows={2} {...register('alergies')} />
        </Camp>
        <Camp etiqueta={c.medicacioActual} error={errors.medicacioActual?.message} ample>
          <textarea rows={3} {...register('medicacioActual')} />
        </Camp>
        <Camp etiqueta={c.antecedentsPersonals} error={errors.antecedentsPersonals?.message} ample>
          <textarea rows={4} {...register('antecedentsPersonals')} />
        </Camp>
        <Camp etiqueta={c.antecedentsFamiliars} error={errors.antecedentsFamiliars?.message} ample>
          <textarea rows={3} {...register('antecedentsFamiliars')} />
        </Camp>
      </div>

      <fieldset>
        <legend>{c.habits}</legend>
        <div className="graella">
          {HABITS.map((k) => (
            <Camp key={k} etiqueta={c[k]} error={errors.habits?.[k]?.message}>
              <input autoComplete="off" {...register(`habits.${k}`)} />
            </Camp>
          ))}
        </div>
      </fieldset>

      <div className="accions">
        {errorDesar && <p className="camp-error" role="alert">{t.app.errorInesperat}</p>}
        <AvisDesat marca={marcaDesat} />
        <Boto type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.app.desant : t.app.desar}
        </Boto>
      </div>
    </form>
  )
}
