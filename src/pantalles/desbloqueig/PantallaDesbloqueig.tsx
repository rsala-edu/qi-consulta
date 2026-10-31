import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { ErrorContrasenya } from '../../crypto'
import { t } from '../../i18n/t'

const MINIM = 8

const esquemaCrear = z
  .object({
    contrasenya: z.string().min(MINIM, t.desbloqueig.massaCurta),
    repeticio: z.string(),
  })
  .refine((v) => v.contrasenya === v.repeticio, {
    message: t.desbloqueig.noCoincideixen,
    path: ['repeticio'],
  })

const esquemaDesbloquejar = z.object({
  contrasenya: z.string().min(1, t.desbloqueig.contrasenyaIncorrecta),
  repeticio: z.string(),
})

type Valors = z.infer<typeof esquemaCrear>

interface Props {
  mode: 'crear' | 'desbloquejar'
  onCrear(contrasenya: string): Promise<void>
  onDesbloquejar(contrasenya: string): Promise<void>
}

export function PantallaDesbloqueig({ mode, onCrear, onDesbloquejar }: Props) {
  const crear = mode === 'crear'
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<Valors>({
    resolver: zodResolver(crear ? esquemaCrear : esquemaDesbloquejar),
    defaultValues: { contrasenya: '', repeticio: '' },
  })

  async function enviar({ contrasenya }: Valors) {
    try {
      // La derivació PBKDF2 (600.000 iteracions) pot trigar un moment a la
      // tauleta; mentrestant isSubmitting mostra l'indicador.
      if (crear) await onCrear(contrasenya)
      else await onDesbloquejar(contrasenya)
    } catch (e) {
      const missatge = e instanceof ErrorContrasenya ? t.desbloqueig.contrasenyaIncorrecta : t.app.errorInesperat
      resetField('contrasenya')
      setError('contrasenya', { message: missatge })
      setFocus('contrasenya')
    }
  }

  return (
    <main className="pantalla-desbloqueig">
      <form className="targeta-desbloqueig" onSubmit={handleSubmit(enviar)} noValidate>
        <h1 className={crear ? undefined : 'logotip'}>
          {crear ? t.desbloqueig.titolCrear : t.desbloqueig.titolDesbloquejar}
        </h1>
        <p>{crear ? t.desbloqueig.introCrear : t.desbloqueig.introDesbloquejar}</p>

        <Camp etiqueta={t.desbloqueig.contrasenya} error={errors.contrasenya?.message}>
          <input
            type="password"
            autoComplete={crear ? 'new-password' : 'current-password'}
            autoFocus
            disabled={isSubmitting}
            {...register('contrasenya')}
          />
        </Camp>

        {crear && (
          <Camp etiqueta={t.desbloqueig.repetirContrasenya} error={errors.repeticio?.message}>
            <input type="password" autoComplete="new-password" disabled={isSubmitting} {...register('repeticio')} />
          </Camp>
        )}

        {crear && <p className="avis">{t.desbloqueig.avisCrear}</p>}

        <div className="accions">
          {isSubmitting ? (
            <Indicador text={crear ? t.desbloqueig.creant : t.desbloqueig.desbloquejant} />
          ) : (
            <Boto type="submit">{crear ? t.desbloqueig.crear : t.desbloqueig.desbloquejar}</Boto>
          )}
        </div>
      </form>
    </main>
  )
}
