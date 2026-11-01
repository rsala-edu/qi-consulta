import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { Simbol } from '../../components/Simbol'
import { ErrorContrasenya } from '../../crypto'
import { t } from '../../i18n/t'
import { ErrorClauRecuperacio } from '../../sessio/claus'

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
  mode: 'crear' | 'desbloquejar' | 'restaurar'
  onCrear(contrasenya: string): Promise<void>
  onDesbloquejar(contrasenya: string): Promise<void>
  /** Hi ha empremta activada en aquest dispositiu */
  empremta?: boolean
  onEmpremta?(): Promise<void>
  /** Es pot recuperar amb la clau impresa */
  onRecuperar?(clau: string, contrasenyaNova: string): Promise<void>
}

export function PantallaDesbloqueig(props: Props) {
  const [recuperant, setRecuperant] = useState(false)
  if (recuperant && props.onRecuperar)
    return <FormulariRecuperacio onRecuperar={props.onRecuperar} onTornar={() => setRecuperant(false)} />
  return <FormulariContrasenya {...props} onOblidada={props.onRecuperar ? () => setRecuperant(true) : undefined} />
}

function FormulariContrasenya({
  mode,
  onCrear,
  onDesbloquejar,
  empremta = false,
  onEmpremta,
  onOblidada,
}: Props & { onOblidada?: () => void }) {
  const crear = mode === 'crear'
  const restaurar = mode === 'restaurar'
  const [errorEmpremta, setErrorEmpremta] = useState(false)
  const [ambEmpremta, setAmbEmpremta] = useState(false)
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

  async function usarEmpremta() {
    setErrorEmpremta(false)
    setAmbEmpremta(true)
    try {
      await onEmpremta!()
    } catch {
      setErrorEmpremta(true)
      setAmbEmpremta(false)
    }
  }

  const ocupat = isSubmitting || ambEmpremta
  const titol = crear ? t.desbloqueig.titolCrear : restaurar ? t.desbloqueig.titolRestaurar : t.desbloqueig.titolDesbloquejar
  const intro = crear ? t.desbloqueig.introCrear : restaurar ? t.desbloqueig.introRestaurar : t.desbloqueig.introDesbloquejar

  return (
    <main className="pantalla-desbloqueig">
      <form className="targeta-desbloqueig" onSubmit={handleSubmit(enviar)} noValidate>
        {mode === 'desbloquejar' ? (
          <h1 className="logotip">
            <Simbol mida={72} />
            {titol}
          </h1>
        ) : (
          <>
            <span className="logotip">
              <Simbol mida={72} />
            </span>
            <h1>{titol}</h1>
          </>
        )}

        {empremta && onEmpremta && (
          <>
            <Boto onClick={() => void usarEmpremta()} disabled={ocupat}>
              {t.desbloqueig.empremta}
            </Boto>
            {errorEmpremta && <p role="alert">{t.desbloqueig.errorEmpremta}</p>}
          </>
        )}

        <p>{intro}</p>

        <Camp etiqueta={t.desbloqueig.contrasenya} error={errors.contrasenya?.message}>
          <input
            type="password"
            autoComplete={crear ? 'new-password' : 'current-password'}
            autoFocus={!empremta}
            disabled={ocupat}
            {...register('contrasenya')}
          />
        </Camp>

        {crear && (
          <Camp etiqueta={t.desbloqueig.repetirContrasenya} error={errors.repeticio?.message}>
            <input type="password" autoComplete="new-password" disabled={ocupat} {...register('repeticio')} />
          </Camp>
        )}

        {crear && <p className="avis">{t.desbloqueig.avisCrear}</p>}

        <div className="accions">
          {isSubmitting ? (
            <Indicador
              text={crear ? t.desbloqueig.creant : restaurar ? t.desbloqueig.restaurant : t.desbloqueig.desbloquejant}
            />
          ) : (
            <Boto type="submit" variant={empremta ? 'secundari' : 'principal'} disabled={ocupat}>
              {crear ? t.desbloqueig.crear : restaurar ? t.desbloqueig.obrir : t.desbloqueig.desbloquejar}
            </Boto>
          )}
        </div>
        {onOblidada && !crear && (
          <Boto variant="discret" onClick={onOblidada} disabled={ocupat}>
            {t.desbloqueig.oblidada}
          </Boto>
        )}
      </form>
    </main>
  )
}

const esquemaRecuperar = z
  .object({
    clau: z.string().min(1, t.desbloqueig.clauIncorrecta),
    contrasenya: z.string().min(MINIM, t.desbloqueig.massaCurta),
    repeticio: z.string(),
  })
  .refine((v) => v.contrasenya === v.repeticio, { message: t.desbloqueig.noCoincideixen, path: ['repeticio'] })

function FormulariRecuperacio({
  onRecuperar,
  onTornar,
}: {
  onRecuperar(clau: string, contrasenyaNova: string): Promise<void>
  onTornar(): void
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof esquemaRecuperar>>({
    resolver: zodResolver(esquemaRecuperar),
    defaultValues: { clau: '', contrasenya: '', repeticio: '' },
  })

  async function enviar(v: z.infer<typeof esquemaRecuperar>) {
    try {
      await onRecuperar(v.clau, v.contrasenya)
    } catch (e) {
      setError('clau', { message: e instanceof ErrorClauRecuperacio ? t.desbloqueig.clauIncorrecta : t.app.errorInesperat })
    }
  }

  return (
    <main className="pantalla-desbloqueig">
      <form className="targeta-desbloqueig" onSubmit={handleSubmit(enviar)} noValidate>
        <span className="logotip">
          <Simbol mida={72} />
        </span>
        <h1>{t.desbloqueig.titolRecuperar}</h1>
        <p>{t.desbloqueig.introRecuperar}</p>
        <Camp etiqueta={t.desbloqueig.clauRecuperacio} error={errors.clau?.message}>
          <textarea
            rows={3}
            className="text-clau"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={isSubmitting}
            {...register('clau')}
          />
        </Camp>
        <Camp etiqueta={t.desbloqueig.contrasenyaNova} error={errors.contrasenya?.message}>
          <input type="password" autoComplete="new-password" disabled={isSubmitting} {...register('contrasenya')} />
        </Camp>
        <Camp etiqueta={t.desbloqueig.repetirContrasenya} error={errors.repeticio?.message}>
          <input type="password" autoComplete="new-password" disabled={isSubmitting} {...register('repeticio')} />
        </Camp>
        <div className="accions">
          {isSubmitting ? <Indicador text={t.desbloqueig.recuperant} /> : <Boto type="submit">{t.desbloqueig.recuperar}</Boto>}
        </div>
        <Boto variant="discret" onClick={onTornar} disabled={isSubmitting}>
          {t.desbloqueig.tornarContrasenya}
        </Boto>
      </form>
    </main>
  )
}

/** Primer ús en un dispositiu: entrar amb el compte de Google de la doctora. */
export function PantallaGoogle({ onConnectar }: { onConnectar(): Promise<void> }) {
  const [connectant, setConnectant] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function connectar() {
    setError(null)
    setConnectant(true)
    // La finestra de Google s'obre dins el mateix toc
    onConnectar().then(
      () => setConnectant(false),
      (e: unknown) => {
        const motiu = (e as { motiu?: keyof typeof t.desbloqueig.errorsGoogle }).motiu
        setError(motiu ? t.desbloqueig.errorsGoogle[motiu] : t.app.errorInesperat)
        setConnectant(false)
      },
    )
  }

  return (
    <main className="pantalla-desbloqueig">
      <div className="targeta-desbloqueig">
        <span className="logotip">
          <Simbol mida={72} />
        </span>
        <h1>{t.desbloqueig.titolGoogle}</h1>
        <p>{t.desbloqueig.introGoogle}</p>
        {error && <p role="alert">{error}</p>}
        <div className="accions">
          {connectant ? (
            <Indicador text={t.desbloqueig.connectantGoogle} />
          ) : (
            <Boto onClick={connectar}>{t.desbloqueig.continuarGoogle}</Boto>
          )}
        </div>
      </div>
    </main>
  )
}
