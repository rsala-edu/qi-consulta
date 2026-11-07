import { Fragment, lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AvisRetencioAcabada, ProveidorRetencio, RetencioBloqueig } from './visita/retencio'
import { LimitError } from './components/LimitError'
import { Boto } from './components/Boto'
import { Simbol } from './components/Simbol'
import { Indicador } from './components/Indicador'
import type { QiDB } from './db/esquema'
import { t } from './i18n/t'
import { PestanyaDades } from './pantalles/fitxa-pacient/PestanyaDades'
import { PestanyaCites } from './pantalles/fitxa-pacient/PestanyaCites'
import { PestanyaTractaments } from './pantalles/fitxa-pacient/PestanyaTractaments'
import { PantallaAgenda } from './pantalles/cites/PantallaAgenda'
import { PestanyaFitxaClinica } from './pantalles/fitxa-pacient/PestanyaFitxaClinica'
import { PantallaFitxaPacient } from './pantalles/fitxa-pacient/PantallaFitxaPacient'
import { PantallaDesbloqueig, PantallaGoogle } from './pantalles/desbloqueig/PantallaDesbloqueig'
import { PantallaNouPacient } from './pantalles/pacients/PantallaNouPacient'
import { PantallaPacients } from './pantalles/pacients/PantallaPacients'
import { PantallaAjuntar } from './pantalles/pacients/PantallaAjuntar'
import { PantallaAjustos } from './pantalles/ajustos/PantallaAjustos'
import { PantallaPrecaucions } from './pantalles/ajustos/PantallaPrecaucions'
import { PantallaSeguretat } from './pantalles/ajustos/PantallaSeguretat'
import { PantallaAvui } from './pantalles/avui/PantallaAvui'
import { ProveidorSincronia } from './sincronia/ContextSincronia'
import { googleConfigurat } from './sincronia/google'
import { migrarTipusVisita } from './db/tipusVisita'
import { migrarEpisodis } from './db/episodis'
import { IndicadorCopia } from './components/IndicadorCopia'
import { AvisFinestraPrivada } from './components/AvisFinestraPrivada'
import { AvisCanvis } from './components/AvisCanvis'
import { BotoTema } from './components/BotoTema'
import { PantallaAparenca } from './pantalles/ajustos/PantallaAparenca'
import { PantallaAjustAgenda } from './pantalles/ajustos/PantallaAjustAgenda'
import { PantallaDrive } from './pantalles/ajustos/PantallaDrive'
import { PantallaQuantA } from './pantalles/ajustos/PantallaQuantA'
import { PantallaAjustVisita } from './pantalles/ajustos/PantallaAjustVisita'
import { PantallaVisita } from './pantalles/visita/PantallaVisita'
import { ProveidorActualitzacio, useActualitzacio } from './actualitzacio/actualitzacio'
import { AvisVersioNova } from './components/AvisVersioNova'
import { AvisVersioAntiga } from './components/AvisVersioAntiga'

// Les pantalles amb el mapa 3D es carreguen a part (Three.js és gran)
const PantallaCalibratge = lazy(() =>
  import('./pantalles/ajustos/PantallaCalibratge').then((m) => ({ default: m.PantallaCalibratge })),
)
const PantallaProvaMapa = lazy(() =>
  import('./pantalles/mapa/PantallaProvaMapa').then((m) => ({ default: m.PantallaProvaMapa })),
)
import { useRevisioSincronia } from './sincronia/revisio'
import { DialegEsborranys } from './pantalles/desbloqueig/DialegEsborranys'
import { ProveidorEsborranys } from './sessio/ContextEsborranys'
import { ProveidorSessio, useMagatzem, useSessio } from './sessio/ContextSessio'

/**
 * Fitxes ajuntades: el que un altre dispositiu hagi creat per a la fitxa que
 * es va treure passa a la que es queda (en obrir i cada cop que arriben canvis)
 */
function RedireccioAjuntades() {
  const magatzem = useMagatzem()
  const revisio = useRevisioSincronia()
  useEffect(() => {
    void magatzem.redirigirAjuntades().catch(() => {})
  }, [magatzem, revisio])
  return null
}

function Marc() {
  const { bloquejar, db } = useSessio()
  const navegar = useNavigate()
  const magatzem = useMagatzem()
  // Una sola vegada per dispositiu: el tipus de visita automàtic a les cites que ja hi havia
  useEffect(() => {
    // I després, els episodis de les cites d'abans de l'etapa 3A
    void migrarTipusVisita(db, magatzem)
      .catch(() => {})
      .then(() => migrarEpisodis(db, magatzem))
      .catch(() => {})
  }, [db, magatzem])
  return (
    <ProveidorSincronia>
      <ProveidorEsborranys magatzem={magatzem}>
        <RedireccioAjuntades />
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
        <AvisVersioNova />
        <AvisRetencioAcabada onAnar={(id) => void navegar(`/visita/${id}`)} />
        <AvisVersioAntiga />
        <AvisFinestraPrivada />
        <AvisCanvis />
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

/**
 * En canviar d'un compte a un altre, tot es torna a muntar de zero: res d'un
 * espai no passa a l'altre. (Obrir el primer espai, quan no n'hi havia cap, no
 * cal: no hi ha res de l'anterior, i així es veu si hi ha hagut cap error.)
 */
function EspaiObert({ children }: { children: ReactNode }) {
  const { espai } = useSessio()
  const [clau, setClau] = useState({ espai, generacio: 0 })
  if (espai !== clau.espai) setClau({ espai, generacio: clau.espai === null ? clau.generacio : clau.generacio + 1 })
  return <Fragment key={clau.generacio}>{children}</Fragment>
}

/** La retenció en marxa de l'espai obert (cap, si encara no n'hi ha cap) */
function RetencioDeLEspai({ children }: { children: ReactNode }) {
  const sessio = useSessio()
  return <ProveidorRetencio db={sessio.espai ? sessio.db : null}>{children}</ProveidorRetencio>
}

/** Mentre l'app és bloquejada no es munta cap pantalla amb dades. */
function Porta() {
  const { estat } = useSessio()
  const { versioNova, actualitzar } = useActualitzacio()
  // Bloquejada (o encara no oberta): s'actualitza sola. Les dades són a
  // IndexedDB i el que no s'ha pujat, a la cua
  useEffect(() => {
    if (versioNova && estat.tipus !== 'desbloquejat' && estat.tipus !== 'carregant') actualitzar()
  }, [versioNova, estat.tipus, actualitzar])
  if (estat.tipus === 'desbloquejat') return <PortaOberta />
  return (
    <>
      <div className="tema-entrada">
        <BotoTema petit />
      </div>
      {/* La retenció de les agulles es veu (i sona) també amb l'app bloquejada, sense cap dada */}
      <RetencioBloqueig />
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
      return <PantallaGoogle onConnectar={() => connectarGoogle()} />
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
          onAltreCompte={googleConfigurat() ? () => connectarGoogle({ altreCompte: true }) : undefined}
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
            <Route path="pacients/:id/ajuntar/:altreId?" element={<P codi="UI-AJUNTAR"><PantallaAjuntar /></P>} />
            <Route path="pacients/:id" element={<P codi="UI-FITXA"><PantallaFitxaPacient /></P>}>
              <Route index element={<Navigate to="dades" replace />} />
              <Route path="dades" element={<P codi="UI-FITXA-DADES"><PestanyaDades /></P>} />
              <Route path="fitxa-clinica" element={<P codi="UI-FITXA-CLINICA"><PestanyaFitxaClinica /></P>} />
              <Route path="cites" element={<P codi="UI-FITXA-CITES"><PestanyaCites /></P>} />
              <Route path="tractaments" element={<P codi="UI-FITXA-TRACTAMENTS"><PestanyaTractaments /></P>} />
            </Route>
            <Route path="mapa" element={<P codi="UI-MAPA"><PantallaProvaMapa /></P>} />
            <Route path="ajustos" element={<P codi="UI-AJUSTOS"><PantallaAjustos /></P>} />
            <Route path="ajustos/calibratge" element={<P codi="UI-CALIBRATGE"><PantallaCalibratge /></P>} />
            <Route path="ajustos/precaucions" element={<P codi="UI-PRECAUCIONS"><PantallaPrecaucions /></P>} />
            <Route path="ajustos/seguretat" element={<P codi="UI-SEGURETAT"><PantallaSeguretat /></P>} />
            <Route path="ajustos/drive" element={<P codi="UI-DRIVE"><PantallaDrive /></P>} />
            <Route path="ajustos/aparenca" element={<P codi="UI-APARENCA"><PantallaAparenca /></P>} />
            <Route path="ajustos/agenda" element={<P codi="UI-AJUST-AGENDA"><PantallaAjustAgenda /></P>} />
            <Route path="ajustos/quant-a" element={<P codi="UI-QUANT-A"><PantallaQuantA /></P>} />
            <Route path="ajustos/visita" element={<P codi="UI-AJUST-VISITA"><PantallaAjustVisita /></P>} />
            <Route path="visita/:id" element={<P codi="UI-VISITA"><PantallaVisita /></P>} />
            <Route path="*" element={<Navigate to="/avui" replace />} />
          </Route>
        </Routes>
      )
  }
}

export function App({ db }: { db: QiDB | null }) {
  return (
    <HashRouter>
      <ProveidorActualitzacio>
        <ProveidorSessio db={db}>
          <EspaiObert>
            <RetencioDeLEspai>
              <Porta />
            </RetencioDeLEspai>
          </EspaiObert>
        </ProveidorSessio>
      </ProveidorActualitzacio>
    </HashRouter>
  )
}
