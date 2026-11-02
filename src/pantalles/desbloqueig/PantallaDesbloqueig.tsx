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
import { fraseEntrada } from '../../sessio/frase'
import { ErrorRecuperacio } from '../../sincronia/recuperacio'
import { MissatgeErrorRecuperacio } from './ErrorRecuperacio'

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
  /** Recuperació: tornar a entrar amb Google si la sessió de Drive ha caducat */
  onTornarGoogle?(): void
}

export function PantallaDesbloqueig(props: Props) {
  const [recuperant, setRecuperant] = useState(false)
  if (recuperant && props.onRecuperar)
    return (
      <FormulariRecuperacio
        onRecuperar={props.onRecuperar}
        onTornar={() => setRecuperant(false)}
        onTornarGoogle={props.onTornarGoogle}
      />
    )
  return <FormulariContrasenya {...props} onOblidada={props.onRecuperar ? () => setRecuperant(true) : undefined} />
}

function FormulariContrasenya({
  mode,
  onCrear,
  onDesbloquejar,
  empremta = false,
  onEmpremta,
  onOblidada,
  onTornarGoogle,
}: Props & { onOblidada?: () => void }) {
  const crear = mode === 'crear'
  const restaurar = mode === 'restaurar'
  const [errorEmpremta, setErrorEmpremta] = useState(false)
  const [ambEmpremta, setAmbEmpremta] = useState(false)
  const [ambContrasenya, setAmbContrasenya] = useState(false)
  const [errorRecuperacio, setErrorRecuperacio] = useState<ErrorRecuperacio | null>(null)
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
      // Contrasenya incorrecta: al camp. Altres errors de la recuperació: el seu missatge
      const contrasenyaMal =
        e instanceof ErrorContrasenya || (e instanceof ErrorRecuperacio && e.tipus === 'contrasenya')
      if (!contrasenyaMal && e instanceof ErrorRecuperacio) {
        setErrorRecuperacio(e)
        return
      }
      setErrorRecuperacio(null)
      resetField('contrasenya')
      setError('contrasenya', { message: contrasenyaMal ? t.desbloqueig.contrasenyaIncorrecta : t.app.errorInesperat })
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
  const intro = crear ? t.desbloqueig.introCrear : restaurar ? t.desbloqueig.introRestaurar : null
  // En un dispositiu amb l'empremta activada, només el botó de l'empremta;
  // la contrasenya, si es tria l'enllaç de sota
  const ambBotoEmpremta = mode === 'desbloquejar' && empremta && !!onEmpremta
  const veureContrasenya = !ambBotoEmpremta || ambContrasenya

  return (
    <main className="pantalla-desbloqueig">
      <form className="targeta-desbloqueig" onSubmit={handleSubmit(enviar)} noValidate>
        {mode === 'desbloquejar' ? (
          <h1 className="logotip">
            <Simbol mida={72} />
            {titol}
          </h1>
        ) : (
          <span className="logotip">
            <Simbol mida={72} />
          </span>
        )}
        <FraseEntrada />
        {mode !== 'desbloquejar' && <h1>{titol}</h1>}

        {ambBotoEmpremta && !ambContrasenya && (
          <>
            <div className="accions">
              {ambEmpremta ? (
                <Indicador text={t.desbloqueig.desbloquejant} />
              ) : (
                <Boto className="boto-gran" onClick={() => void usarEmpremta()} disabled={ocupat}>
                  {t.desbloqueig.empremta}
                </Boto>
              )}
            </div>
            {errorEmpremta && <p role="alert">{t.desbloqueig.errorEmpremta}</p>}
            <button type="button" className="enllac-secundari" onClick={() => setAmbContrasenya(true)} disabled={ocupat}>
              {t.desbloqueig.ambContrasenya}
            </button>
          </>
        )}

        {veureContrasenya && (
          <>
            {intro && <p>{intro}</p>}

            <Camp etiqueta={t.desbloqueig.contrasenya} error={errors.contrasenya?.message}>
              <input
                type="password"
                autoComplete={crear ? 'new-password' : 'current-password'}
                autoFocus
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

            {errorRecuperacio && <MissatgeErrorRecuperacio error={errorRecuperacio} onTornarGoogle={onTornarGoogle} />}

            <div className="accions">
              {isSubmitting ? (
                <Indicador
                  text={crear ? t.desbloqueig.creant : restaurar ? t.desbloqueig.restaurant : t.desbloqueig.desbloquejant}
                />
              ) : (
                <Boto type="submit" disabled={ocupat}>
                  {crear ? t.desbloqueig.crear : restaurar ? t.desbloqueig.obrir : t.desbloqueig.desbloquejar}
                </Boto>
              )}
            </div>
            {onOblidada && !crear && (
              <button type="button" className="enllac-secundari" onClick={onOblidada} disabled={ocupat}>
                {t.desbloqueig.oblidada}
              </button>
            )}
            {ambBotoEmpremta && (
              <button type="button" className="enllac-secundari" onClick={() => setAmbContrasenya(false)} disabled={ocupat}>
                {t.desbloqueig.tornarEmpremta}
              </button>
            )}
          </>
        )}
      </form>
    </main>
  )
}

/** Frase sota el logo: una a l'atzar cada vegada que s'obre l'app */
function FraseEntrada() {
  const [frase] = useState(fraseEntrada)
  return <p className="frase-entrada">{frase}</p>
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
  onTornarGoogle,
}: {
  onRecuperar(clau: string, contrasenyaNova: string): Promise<void>
  onTornar(): void
  onTornarGoogle?(): void
}) {
  const [errorRecuperacio, setErrorRecuperacio] = useState<ErrorRecuperacio | null>(null)
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
      if (e instanceof ErrorRecuperacio) return setErrorRecuperacio(e)
      setErrorRecuperacio(null)
      setError('clau', { message: e instanceof ErrorClauRecuperacio ? t.desbloqueig.clauIncorrecta : t.app.errorInesperat })
    }
  }

  return (
    <main className="pantalla-desbloqueig">
      <form className="targeta-desbloqueig" onSubmit={handleSubmit(enviar)} noValidate>
        <span className="logotip">
          <Simbol mida={72} />
        </span>
        <FraseEntrada />
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
        {errorRecuperacio && <MissatgeErrorRecuperacio error={errorRecuperacio} onTornarGoogle={onTornarGoogle} />}
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
  const [errorRecuperacio, setErrorRecuperacio] = useState<ErrorRecuperacio | null>(null)

  function connectar() {
    setError(null)
    setErrorRecuperacio(null)
    setConnectant(true)
    // La finestra de Google s'obre dins el mateix toc
    onConnectar().then(
      () => setConnectant(false),
      (e: unknown) => {
        // Llegir la còpia de Drive (dispositiu nou): el missatge de cada cas
        if (e instanceof ErrorRecuperacio) setErrorRecuperacio(e)
        else {
          const motiu = (e as { motiu?: keyof typeof t.desbloqueig.errorsGoogle }).motiu
          setError(motiu ? t.desbloqueig.errorsGoogle[motiu] : t.app.errorInesperat)
        }
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
        <FraseEntrada />
        <h1>{t.desbloqueig.titolGoogle}</h1>
        <p>{t.desbloqueig.introGoogle}</p>
        {error && <p role="alert">{error}</p>}
        {errorRecuperacio && <MissatgeErrorRecuperacio error={errorRecuperacio} />}
        <div className="accions">
          {connectant ? (
            <Indicador text={t.desbloqueig.connectantGoogle} />
          ) : (
            <Boto onClick={connectar}>
              {errorRecuperacio?.tipus === 'drive' ? t.desbloqueig.tornarGoogle : t.desbloqueig.continuarGoogle}
            </Boto>
          )}
        </div>
      </div>
    </main>
  )
}
