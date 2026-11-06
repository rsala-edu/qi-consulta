import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useFormulariBrut } from '../../sincronia/revisio'
import { useForm, type Path } from 'react-hook-form'
import { AvisDesat } from '../../components/AvisDesat'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { VersioAnterior } from '../../components/VersioAnterior'
import type { CampEnConflicte } from '../../db/magatzem'
import { esquemaDadesFitxaClinica, type DadesFitxaClinica } from '../../domini/fitxaClinica'
import { t } from '../../i18n/t'
import { useEsborrany, type OpcionsEsborrany } from '../../sessio/useEsborrany'

interface Props {
  valorsInicials: DadesFitxaClinica
  onDesar(dades: DadesFitxaClinica): Promise<void>
  esborrany: OpcionsEsborrany
  /** Camps editats en dos dispositius alhora, per revisar */
  conflictes?: readonly CampEnConflicte[]
  /** La doctora ha revisat un camp */
  onResolt?(c: CampEnConflicte): Promise<void>
}

const CONTRAINDICACIONS = ['anticoagulants', 'embaras', 'marcapassos'] as const
const HABITS = ['son', 'tabac', 'alcohol', 'exercici'] as const

export function FormulariFitxaClinica({ valorsInicials, onDesar, esborrany, conflictes = [], onResolt }: Props) {
  const [marcaDesat, setMarcaDesat] = useState(0)
  const [errorDesar, setErrorDesar] = useState(false)
  const form = useForm<DadesFitxaClinica>({
    resolver: zodResolver(esquemaDadesFitxaClinica),
    defaultValues: valorsInicials,
  })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form
  const control = useEsborrany(form, esborrany)
  // Amb canvis sense desar, les pantalles no es refresquen soles (revisio.tsx)
  useFormulariBrut(form.formState.isDirty)
  // Si les dades canvien des de fora (un altre dispositiu), s'actualitzen els
  // camps que no s'han tocat i es conserven els que s'estan escrivint
  const textInicials = JSON.stringify(valorsInicials)
  const primeresInicials = useRef(textInicials)
  useEffect(() => {
    if (textInicials === primeresInicials.current) return
    primeresInicials.current = textInicials
    form.reset(JSON.parse(textInicials) as typeof valorsInicials, { keepDirtyValues: true })
  }, [textInicials, form])
  const c = t.camps.fitxaClinica

  /** L'altra versió de cada camp en conflicte, al costat del camp */
  const versions = (camp: string) =>
    conflictes
      .filter((x) => x.camp === camp)
      .map((x) => (
        <VersioAnterior
          key={`${x.conflicteId}|${x.camp}`}
          conflicte={x}
          onQuedar={() => onResolt?.(x) ?? Promise.resolve()}
          onRecuperar={async () => {
            // Es recupera l'altra versió i es desa la fitxa
            form.setValue(camp as Path<DadesFitxaClinica>, x.valor as never, { shouldDirty: true })
            await enviar(form.getValues())
            await onResolt?.(x)
          }}
        />
      ))
  const enConflicte = (camp: string) => (conflictes.some((x) => x.camp === camp) ? 'camp-en-conflicte' : '')

  async function enviar(dades: DadesFitxaClinica) {
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
      {conflictes.length > 0 && (
        <p className="avis avis-conflicte" role="status">
          {t.conflictes.avis}
        </p>
      )}
      {control.recuperat && (
        <p className="avis" role="status">
          {t.esborranys.recuperat}
        </p>
      )}
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
        <div className={enConflicte('contraindicacions.altres')}>
          <Camp etiqueta={c.altresContraindicacions} error={errors.contraindicacions?.altres?.message} ample>
            <input autoComplete="off" {...register('contraindicacions.altres')} />
          </Camp>
          {versions('contraindicacions.altres')}
        </div>
      </fieldset>

      <div className="graella">
        <div className={`camp-ample ${enConflicte('alergies')}`}>
          <Camp etiqueta={c.alergies} error={errors.alergies?.message} ample>
            <textarea rows={2} {...register('alergies')} />
          </Camp>
          {versions('alergies')}
        </div>
        <div className={`camp-ample ${enConflicte('medicacioActual')}`}>
          <Camp etiqueta={c.medicacioActual} error={errors.medicacioActual?.message} ample>
            <textarea rows={3} {...register('medicacioActual')} />
          </Camp>
          {versions('medicacioActual')}
        </div>
        <div className={`camp-ample ${enConflicte('antecedentsPersonals')}`}>
          <Camp etiqueta={c.antecedentsPersonals} error={errors.antecedentsPersonals?.message} ample>
            <textarea rows={4} {...register('antecedentsPersonals')} />
          </Camp>
          {versions('antecedentsPersonals')}
        </div>
        <div className={`camp-ample ${enConflicte('antecedentsFamiliars')}`}>
          <Camp etiqueta={c.antecedentsFamiliars} error={errors.antecedentsFamiliars?.message} ample>
            <textarea rows={3} {...register('antecedentsFamiliars')} />
          </Camp>
          {versions('antecedentsFamiliars')}
        </div>
      </div>

      <fieldset>
        <legend>{c.habits}</legend>
        <div className="graella">
          {HABITS.map((k) => (
            <div key={k} className={enConflicte(`habits.${k}`)}>
              <Camp etiqueta={c[k]} error={errors.habits?.[k]?.message}>
                <input autoComplete="off" {...register(`habits.${k}`)} />
              </Camp>
              {versions(`habits.${k}`)}
            </div>
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
