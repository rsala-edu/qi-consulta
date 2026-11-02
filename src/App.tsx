import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router'
import { LimitError } from './components/LimitError'
import { Boto } from './components/Boto'
import { Simbol } from './components/Simbol'
import { Indicador } from './components/Indicador'
import type { QiDB } from './db/esquema'
import { t } from './i18n/t'
import { PestanyaDades } from './pantalles/fitxa-pacient/PestanyaDades'
import { PestanyaCites } from './pantalles/fitxa-pacient/PestanyaCites'
import { PantallaAgenda } from './pantalles/cites/PantallaAgenda'
import { PestanyaFitxaClinica } from './pantalles/fitxa-pacient/PestanyaFitxaClinica'
import { PantallaFitxaPacient } from './pantalles/fitxa-pacient/PantallaFitxaPacient'
import { PantallaDesbloqueig, PantallaGoogle } from './pantalles/desbloqueig/PantallaDesbloqueig'
import { PantallaNouPacient } from './pantalles/pacients/PantallaNouPacient'
import { PantallaPacients } from './pantalles/pacients/PantallaPacients'
import { PantallaAjustos } from './pantalles/ajustos/PantallaAjustos'
import { PantallaPrecaucions } from './pantalles/ajustos/PantallaPrecaucions'
import { PantallaSeguretat } from './pantalles/ajustos/PantallaSeguretat'
import { PantallaAvui } from './pantalles/avui/PantallaAvui'
import { ProveidorSincronia } from './sincronia/ContextSincronia'
import { migrarTipusVisita } from './db/tipusVisita'
import { IndicadorCopia } from './components/IndicadorCopia'
import { BotoTema } from './components/BotoTema'
import { PantallaAparenca } from './pantalles/ajustos/PantallaAparenca'
import { PantallaAjustAgenda } from './pantalles/ajustos/PantallaAjustAgenda'

// Les pantalles amb el mapa 3D es carreguen a part (Three.js és gran)
const PantallaCalibratge = lazy(() =>
  import('./pantalles/ajustos/PantallaCalibratge').then((m) => ({ default: m.PantallaCalibratge })),
)
const PantallaProvaMapa = lazy(() =>
  import('./pantalles/mapa/PantallaProvaMapa').then((m) => ({ default: m.PantallaProvaMapa })),
)
import { DialegEsborranys } from './pantalles/desbloqueig/DialegEsborranys'
import { ProveidorEsborranys } from './sessio/ContextEsborranys'
import { ProveidorSessio, useMagatzem, useSessio } from './sessio/ContextSessio'

function Marc() {
  const { bloquejar, db } = useSessio()
  const magatzem = useMagatzem()
  // Una sola vegada per dispositiu: el tipus de visita automàtic a les cites que ja hi havia
  useEffect(() => {
    void migrarTipusVisita(db, magatzem).catch(() => {})
  }, [db, magatzem])
  return (
    <ProveidorSincronia>
      <ProveidorEsborranys magatzem={magatzem}>
        <header className="barra-app">
          <span className="logotip">
          <Simbol />
          {t.app.nom}
        </span>
          <nav className="navegacio" aria-label={t.navegacio.principal}>
            <NavLink to="/avui">{t.navegacio.avui}</NavLink>
            <NavLink to="/agenda">{t.navegacio.agenda}</NavLink>
            <NavLink to="/pacients">{t.navegacio.pacients}</NavLink>
            <NavLink to="/mapa">{t.navegacio.mapa}</NavLink>
            <NavLink to="/ajustos">{t.navegacio.ajustos}</NavLink>
          </nav>
          <IndicadorCopia />
          <BotoTema />
          <Boto variant="discret" onClick={bloquejar}>
            {t.app.bloquejar}
          </Boto>
        </header>
        <Suspense fallback={<Indicador text={t.app.carregant} />}>
          <Outlet />
        </Suspense>
        <DialegEsborranys />
      </ProveidorEsborranys>
    </ProveidorSincronia>
  )
}

/**
 * Cada pantalla, amb el seu límit d'error: si peta, la barra de navegació es
 * manté i, en canviar de ruta, es torna a provar.
 */
function P({ codi, children }: { codi: string; children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <LimitError codi={codi} clau={pathname}>
      {children}
    </LimitError>
  )
}

/** Mentre l'app és bloquejada no es munta cap pantalla amb dades. */
function Porta() {
  const { estat } = useSessio()
  if (estat.tipus === 'desbloquejat') return <PortaOberta />
  return (
    <>
      <div className="tema-entrada">
        <BotoTema petit />
      </div>
      <PortaOberta />
    </>
  )
}

function PortaOberta() {
  const { estat, connectarGoogle, crearContrasenya, desbloquejar, desbloquejarAmbEmpremta, recuperar } = useSessio()
  switch (estat.tipus) {
    case 'carregant':
      return (
        <main className="pantalla-desbloqueig">
          <Indicador text={t.app.carregant} />
        </main>
      )
    case 'sense-google':
      return <PantallaGoogle onConnectar={connectarGoogle} />
    case 'sense-configurar':
    case 'bloquejat':
    case 'restaurar':
      return (
        <PantallaDesbloqueig
          key={estat.tipus}
          mode={
            estat.tipus === 'sense-configurar' ? 'crear' : estat.tipus === 'restaurar' ? 'restaurar' : 'desbloquejar'
          }
          onCrear={crearContrasenya}
          onDesbloquejar={desbloquejar}
          empremta={estat.tipus === 'bloquejat' && estat.empremta}
          onEmpremta={desbloquejarAmbEmpremta}
          onTornarGoogle={estat.tipus === 'restaurar' ? () => void connectarGoogle() : undefined}
          onRecuperar={
            (estat.tipus === 'restaurar' && estat.fitxer.embolcalls.secrets.some((x) => x.tipus === 'recuperacio')) ||
            (estat.tipus === 'bloquejat' && estat.recuperacio)
              ? recuperar
              : undefined
          }
        />
      )
    case 'desbloquejat':
      return (
        <Routes>
          <Route element={<Marc />}>
            <Route index element={<Navigate to="/avui" replace />} />
            <Route path="avui" element={<P codi="UI-AVUI"><PantallaAvui /></P>} />
            <Route path="agenda" element={<P codi="UI-AGENDA"><PantallaAgenda /></P>} />
            <Route path="pacients" element={<P codi="UI-PACIENTS"><PantallaPacients /></P>} />
            <Route path="pacients/nou" element={<P codi="UI-NOU"><PantallaNouPacient /></P>} />
            <Route path="pacients/:id" element={<P codi="UI-FITXA"><PantallaFitxaPacient /></P>}>
              <Route index element={<Navigate to="dades" replace />} />
              <Route path="dades" element={<P codi="UI-FITXA-DADES"><PestanyaDades /></P>} />
              <Route path="fitxa-clinica" element={<P codi="UI-FITXA-CLINICA"><PestanyaFitxaClinica /></P>} />
              <Route path="cites" element={<P codi="UI-FITXA-CITES"><PestanyaCites /></P>} />
            </Route>
            <Route path="mapa" element={<P codi="UI-MAPA"><PantallaProvaMapa /></P>} />
            <Route path="ajustos" element={<P codi="UI-AJUSTOS"><PantallaAjustos /></P>} />
            <Route path="ajustos/calibratge" element={<P codi="UI-CALIBRATGE"><PantallaCalibratge /></P>} />
            <Route path="ajustos/precaucions" element={<P codi="UI-PRECAUCIONS"><PantallaPrecaucions /></P>} />
            <Route path="ajustos/seguretat" element={<P codi="UI-SEGURETAT"><PantallaSeguretat /></P>} />
            <Route path="ajustos/aparenca" element={<P codi="UI-APARENCA"><PantallaAparenca /></P>} />
            <Route path="ajustos/agenda" element={<P codi="UI-AJUST-AGENDA"><PantallaAjustAgenda /></P>} />
            <Route path="*" element={<Navigate to="/avui" replace />} />
          </Route>
        </Routes>
      )
  }
}

export function App({ db }: { db: QiDB }) {
  return (
    <HashRouter>
      <ProveidorSessio db={db}>
        <Porta />
      </ProveidorSessio>
    </HashRouter>
  )
}
