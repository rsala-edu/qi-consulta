// Ajustos → Seguretat i còpia: Google Drive, empremta i clau de recuperació.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { EstatCopia } from '../../components/EstatCopia'
import { Indicador } from '../../components/Indicador'
import { ErrorContrasenya, ErrorPasskeyCancellada, ErrorSensePrf, passkeyDisponible } from '../../crypto'
import { diaLlarg, formatar, t } from '../../i18n/t'
import { activarEmpremta, desactivarEmpremta, novaClauRecuperacio, teClauRecuperacio, teEmpremta } from '../../sessio/claus'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useSincronia } from '../../sincronia/ContextSincronia'
import { diaDe } from '../../domini/cita'

type Accio = 'empremta' | 'clau' | null

export function PantallaSeguretat() {
  const { db } = useSessio()
  const { estat: estatCopia, sincronitzarAra } = useSincronia()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const [empremta, clau, disponible] = await Promise.all([teEmpremta(db), teClauRecuperacio(db), passkeyDisponible()])
    return { empremta, clau, disponible }
  }, [db, versio])
  const [accio, setAccio] = useState<Accio>(null)
  const [clauImpresa, setClauImpresa] = useState<string | null>(null)
  const s = t.seguretat

  if (clauImpresa)
    return (
      <FullClauRecuperacio
        clau={clauImpresa}
        onFet={() => {
          setClauImpresa(null)
          setVersio((n) => n + 1)
        }}
      />
    )

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{s.titol}</h1>

      <section className="panell" aria-label={s.drive}>
        <h2>{s.drive}</h2>
        <EstatCopia />
        {estatCopia === 'al-dia' && (
          <Boto variant="discret" onClick={() => void sincronitzarAra()}>
            {s.sincronitzarAra}
          </Boto>
        )}
      </section>

      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'llest' && (
        <>
          <section className="panell" aria-label={s.empremta}>
            <h2>{s.empremta}</h2>
            <p className="detall">{s.empremtaDesc}</p>
            {carrega.dades.empremta ? (
              <>
                <p role="status">{s.empremtaActiva}</p>
                <Boto
                  variant="discret"
                  onClick={() => void desactivarEmpremta(db).then(() => setVersio((n) => n + 1))}
                >
                  {s.desactivarEmpremta}
                </Boto>
              </>
            ) : !carrega.dades.disponible ? (
              <p>{s.empremtaNoDisponible}</p>
            ) : accio === 'empremta' ? (
              <DemanarContrasenya
                onCancellar={() => setAccio(null)}
                onContrasenya={async (c) => {
                  await activarEmpremta(db, c)
                  setAccio(null)
                  setVersio((n) => n + 1)
                }}
              />
            ) : (
              <Boto onClick={() => setAccio('empremta')}>{s.activarEmpremta}</Boto>
            )}
          </section>

          <section className="panell" aria-label={s.clau}>
            <h2>{s.clau}</h2>
            <p className="detall">{s.clauDesc}</p>
            <p role="status">{carrega.dades.clau ? s.clauFeta : s.clauPendent}</p>
            {accio === 'clau' ? (
              <DemanarContrasenya
                onCancellar={() => setAccio(null)}
                onContrasenya={async (c) => {
                  setClauImpresa(await novaClauRecuperacio(db, c))
                  setAccio(null)
                }}
              />
            ) : (
              <Boto variant={carrega.dades.clau ? 'secundari' : 'principal'} onClick={() => setAccio('clau')}>
                {carrega.dades.clau ? s.ferClauNova : s.ferClau}
              </Boto>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function DemanarContrasenya({
  onContrasenya,
  onCancellar,
}: {
  onContrasenya(c: string): Promise<void>
  onCancellar(): void
}) {
  const [contrasenya, setContrasenya] = useState('')
  const [ocupat, setOcupat] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="formulari"
      onSubmit={(e) => {
        e.preventDefault()
        setOcupat(true)
        setError(null)
        onContrasenya(contrasenya).catch((err: unknown) => {
          setError(
            err instanceof ErrorContrasenya
              ? t.desbloqueig.contrasenyaIncorrecta
              : err instanceof ErrorSensePrf
                ? t.seguretat.empremtaSensePrf
                : err instanceof ErrorPasskeyCancellada
                  ? t.seguretat.empremtaCancellada
                  : t.app.errorInesperat,
          )
          setContrasenya('')
          setOcupat(false)
        })
      }}
    >
      <Camp etiqueta={t.seguretat.demanarContrasenya} error={error ?? undefined}>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          disabled={ocupat}
          value={contrasenya}
          onChange={(e) => setContrasenya(e.target.value)}
        />
      </Camp>
      <div className="accions accions-esquerra">
        {ocupat ? (
          <Indicador text={t.desbloqueig.desbloquejant} />
        ) : (
          <>
            <Boto type="submit" disabled={contrasenya === ''}>
              {t.seguretat.continuar}
            </Boto>
            <Boto variant="discret" onClick={onCancellar}>
              {t.app.cancellar}
            </Boto>
          </>
        )}
      </div>
    </form>
  )
}

/** El full per imprimir amb la clau de recuperació. */
function FullClauRecuperacio({ clau, onFet }: { clau: string; onFet(): void }) {
  const [guardada, setGuardada] = useState(false)
  const [avui] = useState(() => diaDe(new Date()))
  const s = t.seguretat
  return (
    <main className="pantalla full-clau">
      <article className="full-imprimir" aria-label={s.titolFull}>
        <h1>{s.titolFull}</h1>
        <p className="text-clau-impresa" data-testid="clau-recuperacio">
          {clau}
        </p>
        <p>{s.instruccionsFull}</p>
        <p className="detall">{formatar(s.dataFull, { dia: diaLlarg(avui) })}</p>
      </article>
      <div className="no-imprimir formulari">
        <Boto variant="secundari" onClick={() => window.print()}>
          {s.imprimir}
        </Boto>
        <label className="casella">
          <input type="checkbox" checked={guardada} onChange={(e) => setGuardada(e.target.checked)} />
          {s.guardada}
        </label>
        <div className="accions accions-esquerra">
          <Boto disabled={!guardada} onClick={onFet}>
            {s.fet}
          </Boto>
        </div>
      </div>
    </main>
  )
}
