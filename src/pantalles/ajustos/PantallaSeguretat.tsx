// Ajustos → Seguretat i còpia: com es protegeixen les dades, bloqueig automàtic,
// Google Drive, empremta i clau de recuperació.

import { useState } from 'react'
import { descarregarText } from '../../components/descarregar'
import { FormulariCredencial } from '../../components/FormulariCredencial'
import {
  desarCopiaAbansCanviClau,
  exportarQi,
  importarQi,
  llegirCopiaAbansCanviClau,
  llegirQi,
  nomFitxerQi,
  obrirClauCopia,
} from '../../sincronia/canviClau'
import type { FitxerCopia } from '../../sincronia/copia'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { EstatCopia } from '../../components/EstatCopia'
import { Indicador } from '../../components/Indicador'
import { ErrorContrasenya, ErrorPasskeyCancellada, ErrorSensePrf, passkeyDisponible } from '../../crypto'
import { diaLlarg, formatar, t } from '../../i18n/t'
import { activarEmpremta, desactivarEmpremta, novaClauRecuperacio, teClauRecuperacio, teEmpremta } from '../../sessio/claus'
import { useClauMestra, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useSincronia } from '../../sincronia/ContextSincronia'
import { diaDe } from '../../domini/cita'
import { OPCIONS_MINUTS_BLOQUEIG } from '../../db/magatzem'

type Accio = 'empremta' | 'clau' | null

export function PantallaSeguretat() {
  const { db, minutsBloqueig, canviarMinutsBloqueig } = useSessio()
  const { estat: estatCopia, error: errorCopia, sincronitzarAra } = useSincronia()
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

      <section className="panell" aria-label={s.proteccio}>
        <h2>{s.proteccio}</h2>
        {s.proteccioText.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section className="panell" aria-label={s.bloqueig}>
        <h2>{s.bloqueig}</h2>
        <p className="detall">{s.bloqueigDesc}</p>
        <Camp etiqueta={s.bloqueigDespres}>
          <select value={minutsBloqueig} onChange={(e) => void canviarMinutsBloqueig(Number(e.target.value))}>
            {OPCIONS_MINUTS_BLOQUEIG.map((m) => (
              <option key={m} value={m}>
                {formatar(s.minuts, { n: String(m) })}
              </option>
            ))}
          </select>
        </Camp>
      </section>

      <section className="panell" aria-label={s.drive}>
        <h2>{s.drive}</h2>
        <EstatCopia />
        {estatCopia === 'al-dia' && (
          <Boto variant="discret" onClick={() => void sincronitzarAra()}>
            {s.sincronitzarAra}
          </Boto>
        )}
        {estatCopia === 'error' && errorCopia?.motiu === 'clau' && (
          <p>
            <strong>{t.sincronia.motius.clau}</strong> <Link to="/ajustos/drive">{t.sincronia.veureOpcions}</Link>
          </p>
        )}
      </section>

      <CopiaEnFitxer />

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

/** Descarregar i importar un fitxer .qi xifrat */
function CopiaEnFitxer() {
  const { db } = useSessio()
  const clau = useClauMestra()
  const [versio, setVersio] = useState(0)
  const [abans] = useCarrega(() => llegirCopiaAbansCanviClau(db), [db, versio])
  const [fitxer, setFitxer] = useState<FitxerCopia | null>(null)
  const [missatge, setMissatge] = useState<{ text: string; error: boolean } | null>(null)
  const s = t.seguretat

  return (
    <section className="panell" aria-label={s.fitxers}>
      <h2>{s.fitxers}</h2>
      <p className="detall">{s.fitxersDesc}</p>
      <div className="accions accions-esquerra">
        <Boto
          variant="secundari"
          onClick={() =>
            void exportarQi(db, clau).then(
              (text) => descarregarText(text, nomFitxerQi()),
              () => setMissatge({ text: t.app.errorInesperat, error: true }),
            )
          }
        >
          {s.descarregar}
        </Boto>
        {abans.estat === 'llest' && abans.dades && (
          <Boto
            variant="discret"
            onClick={() => descarregarText(abans.dades!.text, nomFitxerQi(new Date(abans.dades!.at)))}
          >
            {formatar(s.copiaAbans, { quan: diaLlarg(diaDe(new Date(abans.dades.at))) })}
          </Boto>
        )}
      </div>

      <h3>{s.importar}</h3>
      <p className="detall">{s.importarDesc}</p>
      <Camp etiqueta={s.triarFitxer}>
        <input
          type="file"
          accept=".qi,application/json"
          onChange={(e) => {
            setMissatge(null)
            setFitxer(null)
            const f = e.target.files?.[0]
            if (!f) return
            void f.text().then(
              (text) => {
                try {
                  setFitxer(llegirQi(text))
                } catch {
                  setMissatge({ text: s.fitxerNoValid, error: true })
                }
              },
              () => setMissatge({ text: s.fitxerNoValid, error: true }),
            )
          }}
        />
      </Camp>
      {fitxer && (
        <FormulariCredencial
          etiquetaContrasenya={s.contrasenyaCopia}
          etiquetaClau={s.clauCopia}
          textBoto={s.importar}
          textFent={s.important}
          onCancellar={() => setFitxer(null)}
          onCredencial={async (c) => {
            const clauQi = await obrirClauCopia(fitxer, c)
            // Per si de cas, les dades d'abans queden desades dins el dispositiu
            await desarCopiaAbansCanviClau(db, clau)
            const r = await importarQi(db, clau, fitxer, clauQi)
            setFitxer(null)
            setVersio((n) => n + 1)
            setMissatge({
              text: [
                s.importat,
                r.possiblesDuplicats > 0 ? formatar(t.drive.duplicats, { n: String(r.possiblesDuplicats) }) : '',
                r.conflictes > 0 ? formatar(t.drive.conflictes, { n: String(r.conflictes) }) : '',
              ]
                .filter(Boolean)
                .join(' '),
              error: false,
            })
          }}
        />
      )}
      {missatge && (
        <p role={missatge.error ? 'alert' : 'status'} className={missatge.error ? 'camp-error' : undefined}>
          {missatge.text}
        </p>
      )}
    </section>
  )
}

