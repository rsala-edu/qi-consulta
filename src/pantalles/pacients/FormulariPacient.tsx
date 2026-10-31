import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { AvisDesat } from '../../components/AvisDesat'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { esquemaDadesPacient, SEXES, type DadesPacient } from '../../domini/pacient'
import { t } from '../../i18n/t'
import { useEsborrany, type OpcionsEsborrany } from '../../sessio/useEsborrany'
import { useState } from 'react'

interface Props {
  valorsInicials: DadesPacient
  onDesar(dades: DadesPacient): Promise<void>
  esborrany: OpcionsEsborrany
  textBoto?: string
}

export function FormulariPacient({ valorsInicials, onDesar, esborrany, textBoto = t.app.desar }: Props) {
  const [marcaDesat, setMarcaDesat] = useState(0)
  const [errorDesar, setErrorDesar] = useState(false)
  const form = useForm<DadesPacient>({
    resolver: zodResolver(esquemaDadesPacient),
    defaultValues: valorsInicials,
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form
  const control = useEsborrany(form, esborrany)
  const c = t.camps.pacient

  async function enviar(dades: DadesPacient) {
    setErrorDesar(false)
    control.abansDeDesar()
    try {
      await onDesar(dades)
      reset(dades)
      setMarcaDesat((m) => m + 1)
      await control.despresDeDesar(true)
    } catch {
      setErrorDesar(true)
      await control.despresDeDesar(false)
    }
  }

  return (
    <form className="formulari" onSubmit={handleSubmit(enviar)} noValidate>
      {control.recuperat && (
        <p className="avis" role="status">
          {t.esborranys.recuperat}
        </p>
      )}
      <div className="graella">
        <Camp etiqueta={c.nom} error={errors.nom?.message}>
          <input autoComplete="off" {...register('nom')} />
        </Camp>
        <Camp etiqueta={c.llinatges} error={errors.llinatges?.message}>
          <input autoComplete="off" {...register('llinatges')} />
        </Camp>
        <Camp etiqueta={c.dataNaixement} error={errors.dataNaixement?.message}>
          <input type="date" {...register('dataNaixement')} />
        </Camp>
        <Camp etiqueta={c.sexe} error={errors.sexe?.message}>
          <select {...register('sexe')}>
            {(['', ...SEXES] as const).map((s) => (
              <option key={s} value={s}>
                {t.camps.sexes[s]}
              </option>
            ))}
          </select>
        </Camp>
        <Camp etiqueta={c.telefon} error={errors.telefon?.message}>
          <input type="tel" inputMode="tel" autoComplete="off" {...register('telefon')} />
        </Camp>
        <Camp etiqueta={c.correu} error={errors.correu?.message}>
          <input type="email" inputMode="email" autoComplete="off" {...register('correu')} />
        </Camp>
        <Camp etiqueta={c.adreca} error={errors.adreca?.message} ample>
          <input autoComplete="off" {...register('adreca')} />
        </Camp>
        <Camp etiqueta={c.professio} error={errors.professio?.message}>
          <input autoComplete="off" {...register('professio')} />
        </Camp>
        <Camp etiqueta={c.comEnsHaConegut} error={errors.comEnsHaConegut?.message}>
          <input autoComplete="off" {...register('comEnsHaConegut')} />
        </Camp>
      </div>
      <div className="accions">
        {errorDesar && <p className="camp-error" role="alert">{t.app.errorInesperat}</p>}
        <AvisDesat marca={marcaDesat} />
        <Boto type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.app.desant : textBoto}
        </Boto>
      </div>
    </form>
  )
}
