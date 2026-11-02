import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router'
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
  const { bloquejar } = useSessio()
  const magatzem = useMagatzem()
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
            <Route path="avui" element={<PantallaAvui />} />
            <Route path="agenda" element={<PantallaAgenda />} />
            <Route path="pacients" element={<PantallaPacients />} />
            <Route path="pacients/nou" element={<PantallaNouPacient />} />
            <Route path="pacients/:id" element={<PantallaFitxaPacient />}>
              <Route index element={<Navigate to="dades" replace />} />
              <Route path="dades" element={<PestanyaDades />} />
              <Route path="fitxa-clinica" element={<PestanyaFitxaClinica />} />
              <Route path="cites" element={<PestanyaCites />} />
            </Route>
            <Route path="mapa" element={<PantallaProvaMapa />} />
            <Route path="ajustos" element={<PantallaAjustos />} />
            <Route path="ajustos/calibratge" element={<PantallaCalibratge />} />
            <Route path="ajustos/precaucions" element={<PantallaPrecaucions />} />
            <Route path="ajustos/seguretat" element={<PantallaSeguretat />} />
            <Route path="ajustos/aparenca" element={<PantallaAparenca />} />
            <Route path="ajustos/agenda" element={<PantallaAjustAgenda />} />
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
