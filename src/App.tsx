import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { Boto } from './components/Boto'
import { Indicador } from './components/Indicador'
import type { QiDB } from './db/esquema'
import { t } from './i18n/t'
import { PestanyaDades } from './pantalles/fitxa-pacient/PestanyaDades'
import { PestanyaFitxaClinica } from './pantalles/fitxa-pacient/PestanyaFitxaClinica'
import { PantallaFitxaPacient } from './pantalles/fitxa-pacient/PantallaFitxaPacient'
import { PantallaDesbloqueig } from './pantalles/desbloqueig/PantallaDesbloqueig'
import { PantallaNouPacient } from './pantalles/pacients/PantallaNouPacient'
import { PantallaPacients } from './pantalles/pacients/PantallaPacients'
import { DialegEsborranys } from './pantalles/desbloqueig/DialegEsborranys'
import { ProveidorEsborranys } from './sessio/ContextEsborranys'
import { ProveidorSessio, useMagatzem, useSessio } from './sessio/ContextSessio'

function Marc() {
  const { bloquejar } = useSessio()
  const magatzem = useMagatzem()
  return (
    <ProveidorEsborranys magatzem={magatzem}>
      <header className="barra-app">
        <span className="logotip">{t.app.nom}</span>
        <Boto variant="discret" onClick={bloquejar}>
          {t.app.bloquejar}
        </Boto>
      </header>
      <Outlet />
      <DialegEsborranys />
    </ProveidorEsborranys>
  )
}

/** Mentre l'app és bloquejada no es munta cap pantalla amb dades. */
function Porta() {
  const { estat, crearContrasenya, desbloquejar } = useSessio()
  switch (estat.tipus) {
    case 'carregant':
      return (
        <main className="pantalla-desbloqueig">
          <Indicador text={t.app.carregant} />
        </main>
      )
    case 'sense-configurar':
    case 'bloquejat':
      return (
        <PantallaDesbloqueig
          key={estat.tipus}
          mode={estat.tipus === 'sense-configurar' ? 'crear' : 'desbloquejar'}
          onCrear={crearContrasenya}
          onDesbloquejar={desbloquejar}
        />
      )
    case 'desbloquejat':
      return (
        <Routes>
          <Route element={<Marc />}>
            <Route index element={<Navigate to="/pacients" replace />} />
            <Route path="pacients" element={<PantallaPacients />} />
            <Route path="pacients/nou" element={<PantallaNouPacient />} />
            <Route path="pacients/:id" element={<PantallaFitxaPacient />}>
              <Route index element={<Navigate to="dades" replace />} />
              <Route path="dades" element={<PestanyaDades />} />
              <Route path="fitxa-clinica" element={<PestanyaFitxaClinica />} />
            </Route>
            <Route path="*" element={<Navigate to="/pacients" replace />} />
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
