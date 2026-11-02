// Agenda: la jornada d'un cop d'ull.
// - Vistes Dia i Setmana (cada dispositiu recorda l'última; per defecte,
//   setmana a l'ordinador i a la tauleta horitzontal, dia a la vertical).
// - La graella només mostra l'horari de consulta (Ajustos > Agenda) amb mitja
//   hora de marge, i s'amplia si hi ha cites fora. En obrir-la se situa a
//   l'hora actual o a la primera cita, mai a dalt de tot sense motiu.
// - Tocar una hora buida crea una cita (trams de 15 minuts); tocar una cita
//   n'obre la fitxa, amb «Començar visita» si és d'avui.
// - Minicalendari (a la columna lateral a l'ordinador, en un desplegable a la
//   tauleta) per saltar a qualsevol dia i marcar-lo com a tancat.
// - A la tauleta, lliscar el dit canvia de dia o de setmana.
// Arrossegar cites per canviar-les d'hora arriba a l'etapa 3.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { canviarDiaTancat, llegirDiesTancats, llegirHorari } from '../../db/agenda'
import {
  alcadaHora,
  contingutTargeta,
  esLaborable,
  hhmm,
  HORA_MINIMA,
  iniciVista,
  minutInicial,
  rangGraella,
  vistaPerDefecte,
  type Horari,
  type VistaAgenda,
} from '../../domini/agenda'
import {
  columnesDelDia,
  diaDe,
  esDia,
  fiDe,
  FRANJA,
  minutDelDia,
  novaCita,
  setmanaDe,
  solapaments,
  sumarDies,
  type Cita,
  type DadesCita,
} from '../../domini/cita'
import { dadesPacientBuides, nomComplet, type Pacient } from '../../domini/pacient'
import { diaCurt, diaLlarg, formatar, hora, mesAny, t } from '../../i18n/t'
import { useMagatzem, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { FormulariCita } from './FormulariCita'
import { Minicalendari } from './Minicalendari'

type Obert =
  | { tipus: 'nova'; inici: string }
  | { tipus: 'fitxa'; cita: Cita }
  | { tipus: 'editar'; cita: Cita }
  | null

/** Alçada mínima d'una targeta de cita: zona tàctil */
const ALT_MINIMA_CITA = 44
/** Capçalera dels dies (px) */
const ALT_CAPCALERA = 52
/** Marge sota la graella (px) */
const MARGE_INFERIOR = 16
/** Text de les targetes: alçada de línia i marge vertical (px), com al CSS */
const LINIA_TARGETA = 15
const MARGE_TARGETA = 8
const CLAU_VISTA = 'qi.vistaAgenda'
/** Distància mínima (px) per comptar un lliscament del dit */
const LLISCAMENT = 70

function vistaDesada(): VistaAgenda | null {
  try {
    const v = window.localStorage.getItem(CLAU_VISTA)
    return v === 'dia' || v === 'setmana' ? v : null
  } catch {
    return null
  }
}

function desarVista(v: VistaAgenda) {
  try {
    window.localStorage.setItem(CLAU_VISTA, v)
  } catch {
    // Sense emmagatzematge: no es recorda, i prou
  }
}

/** L'hora actual, que s'actualitza cada minut */
function useAra(): Date {
  const [ara, setAra] = useState(() => new Date())
  useEffect(() => {
    let interval = 0
    // Primer fins al minut següent, després cada minut
    const primer = window.setTimeout(
      () => {
        setAra(new Date())
        interval = window.setInterval(() => setAra(new Date()), 60_000)
      },
      60_000 - (Date.now() % 60_000),
    )
    return () => {
      window.clearTimeout(primer)
      window.clearInterval(interval)
    }
  }, [])
  return ara
}

function useConsulta(consulta: string): boolean {
  const [coincideix, setCoincideix] = useState(() => window.matchMedia(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia(consulta)
    const canvi = () => setCoincideix(m.matches)
    m.addEventListener('change', canvi)
    return () => m.removeEventListener('change', canvi)
  }, [consulta])
  return coincideix
}

export function PantallaAgenda() {
  const magatzem = useMagatzem()
  const { db } = useSessio()
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const ara = useAra()
  const avui = diaDe(ara)
  const dia = esDia(params.get('dia') ?? '') ? params.get('dia')! : avui
  const parametreVista = params.get('vista')
  const vista: VistaAgenda =
    parametreVista === 'dia' || parametreVista === 'setmana'
      ? parametreVista
      : (vistaDesada() ?? vistaPerDefecte(window.innerWidth, window.innerHeight))
  // Columna lateral a l'ordinador (ratolí i pantalla ampla); a la tauleta, desplegable
  const ambLateral = useConsulta('(min-width: 1100px) and (pointer: fine)')
  const [calendariObert, setCalendariObert] = useState(false)

  // Des de l'accés ràpid «Nova cita» (Avui) s'obre directament el formulari
  const [obert, setObert] = useState<Obert>(() => (params.get('nova') ? { tipus: 'nova', inici: `${dia}T10:00` } : null))
  const [versio, setVersio] = useState(0)

  const [carrega, substituir] = useCarrega(
    async () => {
      // Totes les cites: n'hi ha poques, i així els solapaments es comproven
      // encara que la cita es mogui a un altre dia
      const [pacients, cites, horari, diesTancats] = await Promise.all([
        magatzem.llistarPacients(),
        magatzem.llistarCites('0000', '9999'),
        llegirHorari(db),
        llegirDiesTancats(db),
      ])
      return { pacients, cites, horari, diesTancats }
    },
    [magatzem, db, versio],
  )

  const dies = vista === 'dia' ? [dia] : setmanaDe(dia)
  const anar = (nouDia: string, novaVista: VistaAgenda = vista) => {
    setObert(null)
    setCalendariObert(false)
    setParams({ dia: nouDia, vista: novaVista }, { replace: true })
  }
  const canviarVista = (v: VistaAgenda) => {
    desarVista(v)
    anar(dia, v)
  }
  const pas = vista === 'dia' ? 1 : 7

  // Nova cita: a la primera hora de consulta del dia (o ara, si és avui i dins l'horari)
  const iniciNovaCita = (h: Horari) => {
    const d = dies.includes(avui) ? avui : vista === 'dia' ? dia : (dies.find((x) => esLaborable(x, h)) ?? dia)
    const minut = d === avui ? Math.ceil((ara.getHours() * 60 + ara.getMinutes()) / FRANJA) * FRANJA : h.inici
    const dinsHorari = minut >= h.inici && minut < h.fi ? minut : h.inici
    return `${d}T${hhmm(dinsHorari)}`
  }

  const nomDe = (id: string) => {
    if (carrega.estat !== 'llest') return '—'
    const p = carrega.dades.pacients.find((x) => x.id === id)
    return p ? nomComplet(p) : '—'
  }

  const minicalendari = carrega.estat === 'llest' && (
    <Minicalendari
      dia={dia}
      avui={avui}
      visibles={dies}
      ambCites={new Set(carrega.dades.cites.map((c) => c.inici.slice(0, 10)))}
      horari={carrega.dades.horari}
      diesTancats={carrega.dades.diesTancats}
      onTriar={(d) => anar(d)}
      onCanviarTancat={(d, tancat) => void canviarDiaTancat(db, d, tancat).then(() => setVersio((n) => n + 1))}
    />
  )

  return (
    <main className={`pantalla pantalla-agenda${ambLateral ? ' amb-lateral' : ''}`}>
      <div className="disseny-agenda">
        {ambLateral && <aside className="agenda-lateral">{minicalendari}</aside>}

        <div className="agenda-principal">
          <div className="barra-agenda">
            <h1 className="titol-agenda">{t.cites.titol}</h1>
            <div className="grup-botons">
              <button type="button" className="boto-rodo" onClick={() => anar(sumarDies(dia, -pas))} aria-label={t.cites.anterior}>
                ‹
              </button>
              <Boto variant="secundari" onClick={() => anar(avui)}>
                {t.cites.avui}
              </Boto>
              <button type="button" className="boto-rodo" onClick={() => anar(sumarDies(dia, pas))} aria-label={t.cites.seguent}>
                ›
              </button>
            </div>
            <h2 className="dia-agenda">{vista === 'dia' ? diaLlarg(dia) : mesAny(dies[0]!)}</h2>
            {!ambLateral && (
              <div className="desplegable-calendari">
                <Boto
                  variant="secundari"
                  aria-expanded={calendariObert}
                  onClick={() => setCalendariObert((o) => !o)}
                >
                  {t.cites.calendari}
                </Boto>
                {calendariObert && <div className="panell-desplegable">{minicalendari}</div>}
              </div>
            )}
            <div className="segmentat" role="radiogroup" aria-label={t.cites.vista}>
              {(['dia', 'setmana'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={vista === v} onClick={() => canviarVista(v)}>
                  {t.cites[v]}
                </button>
              ))}
            </div>
            <Boto
              disabled={carrega.estat !== 'llest'}
              onClick={() => carrega.estat === 'llest' && setObert({ tipus: 'nova', inici: iniciNovaCita(carrega.dades.horari) })}
            >
              {t.cites.novaCita}
            </Boto>
          </div>

          {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
          {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
          {carrega.estat === 'llest' && (
            <Graella
              dies={dies}
              avui={avui}
              ara={ara}
              horari={carrega.dades.horari}
              diesTancats={carrega.dades.diesTancats}
              cites={carrega.dades.cites}
              pacients={carrega.dades.pacients}
              onFranja={(inici) => setObert({ tipus: 'nova', inici })}
              onCita={(cita) => setObert({ tipus: 'fitxa', cita })}
              onNova={() => setObert({ tipus: 'nova', inici: iniciNovaCita(carrega.dades.horari) })}
              onLliscar={(sentit) => anar(sumarDies(dia, sentit * pas))}
              buit={vista === 'dia' ? t.cites.diaBuit : t.cites.setmanaBuida}
            />
          )}
        </div>
      </div>

      {carrega.estat === 'llest' && obert && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setObert(null)}>
          <section
            className="dialeg dialeg-cita"
            role="dialog"
            aria-modal="true"
            aria-label={obert.tipus === 'nova' ? t.cites.novaCita : formatar(t.cites.editarCita, { nom: nomDe(obert.cita.pacientId) })}
          >
            <h2>{obert.tipus === 'nova' ? t.cites.novaCita : formatar(t.cites.editarCita, { nom: nomDe(obert.cita.pacientId) })}</h2>
            {obert.tipus === 'fitxa' ? (
              <FitxaCita
                cita={obert.cita}
                esAvui={obert.cita.inici.slice(0, 10) === avui}
                onComencar={() => navegar(`/pacients/${obert.cita.pacientId}/cites`)}
                onEditar={() => setObert({ tipus: 'editar', cita: obert.cita })}
                onTancar={() => setObert(null)}
              />
            ) : (
              <FormulariCita
                key={obert.tipus === 'nova' ? obert.inici : obert.cita.id}
                id={obert.tipus === 'editar' ? obert.cita.id : undefined}
                inicial={obert.tipus === 'nova' ? novaCita('', obert.inici) : obert.cita}
                pacients={carrega.dades.pacients}
                altres={carrega.dades.cites}
                horari={carrega.dades.horari}
                diesTancats={carrega.dades.diesTancats}
                onCancellar={() => setObert(null)}
                onDesar={async (dades: DadesCita) => {
                  if (obert.tipus === 'nova') await magatzem.crearCita(dades)
                  else await magatzem.actualitzarCita(obert.cita.id, dades)
                  setObert(null)
                  if (!dies.includes(dades.inici.slice(0, 10))) anar(dades.inici.slice(0, 10))
                  setVersio((n) => n + 1)
                }}
                onEsborrar={
                  obert.tipus === 'editar'
                    ? async () => {
                        await magatzem.esborrarCita(obert.cita.id)
                        setObert(null)
                        setVersio((n) => n + 1)
                      }
                    : undefined
                }
                onCrearPacient={async (nom, telefon) => {
                  const p = await magatzem.crearPacient({ ...dadesPacientBuides(), nom, telefon })
                  substituir({ ...carrega.dades, pacients: [...carrega.dades.pacients, p] })
                  return p
                }}
              />
            )}
          </section>
        </div>
      )}
    </main>
  )
}

/** Fitxa breu d'una cita: hora, tipus i motiu, estat i notes */
function FitxaCita({
  cita,
  esAvui,
  onComencar,
  onEditar,
  onTancar,
}: {
  cita: Cita
  esAvui: boolean
  onComencar(): void
  onEditar(): void
  onTancar(): void
}) {
  const c = t.cites
  return (
    <div className="fitxa-cita">
      <p className="fitxa-cita-hora">
        {diaLlarg(cita.inici.slice(0, 10))} · {hora(cita.inici)}–{hora(fiDe(cita))} ·{' '}
        {formatar(c.minuts, { n: String(cita.durada) })}
      </p>
      <p>
        {c.tipusNoms[cita.tipus]}
        {cita.motiu && ` · ${cita.motiu}`}
      </p>
      <p>
        <span className={`etiqueta etiqueta-${cita.estat}`}>{c.estats[cita.estat]}</span>
      </p>
      {cita.notes && <p className="detall">{cita.notes}</p>}
      <div className="accions accions-esquerra">
        {esAvui && cita.estat === 'programada' && <Boto onClick={onComencar}>{c.comencarVisita}</Boto>}
        <Boto variant="secundari" onClick={onEditar}>
          {c.editar}
        </Boto>
        <Link className="boto boto-discret" to={`/pacients/${cita.pacientId}/dades`}>
          {c.veureFitxa}
        </Link>
        <Boto variant="discret" onClick={onTancar}>
          {c.tancar}
        </Boto>
      </div>
    </div>
  )
}

function Graella({
  dies,
  avui,
  ara,
  horari,
  diesTancats,
  cites,
  pacients,
  onFranja,
  onCita,
  onNova,
  onLliscar,
  buit,
}: {
  dies: string[]
  avui: string
  ara: Date
  horari: Horari
  diesTancats: ReadonlySet<string>
  cites: readonly Cita[]
  pacients: readonly Pacient[]
  onFranja(inici: string): void
  onCita(c: Cita): void
  onNova(): void
  onLliscar(sentit: 1 | -1): void
  buit: string
}) {
  const perDia = useMemo(() => {
    const m = new Map<string, Cita[]>()
    for (const d of dies) m.set(d, [])
    for (const c of cites) m.get(c.inici.slice(0, 10))?.push(c)
    return m
  }, [dies, cites])
  const visibles = useMemo(() => [...perDia.values()].flat(), [perDia])
  // Sense cites, la franja del missatge fa baixar la graella: cal tornar a mesurar
  const buida = visibles.length === 0
  const rang = rangGraella(horari, visibles)
  const franges = Array.from({ length: (rang.fi - rang.inici) / FRANJA }, (_, i) => rang.inici + i * FRANJA)
  // L'alçada de cada hora: tot l'horari a la pantalla si hi cap (mínim 48 px
  // amb ratolí i 56 px amb els dits); si no, la graella es desplaça
  const dits = useConsulta('(pointer: coarse)')
  const desplacament = useRef<HTMLDivElement>(null)
  const [espai, setEspai] = useState<{ graella: number; hores: number } | null>(null)
  useLayoutEffect(() => {
    const mesurar = () => {
      const el = desplacament.current
      if (!el) return
      const dalt = el.getBoundingClientRect().top + window.scrollY
      const graella = Math.max(360, window.innerHeight - dalt - MARGE_INFERIOR)
      setEspai((e) =>
        e && e.graella === graella ? e : { graella, hores: graella - ALT_CAPCALERA },
      )
    }
    mesurar()
    window.addEventListener('resize', mesurar)
    return () => window.removeEventListener('resize', mesurar)
  }, [buida])
  const alturaHora = alcadaHora(espai?.hores ?? 0, rang.fi - rang.inici, dits ? HORA_MINIMA.dits : HORA_MINIMA.ratoli)
  const quart = alturaHora / 4
  const y = (minut: number) => ((minut - rang.inici) / FRANJA) * quart
  const alcada = franges.length * quart
  const setmana = dies.length > 1
  const nomDe = (id: string) => {
    const p = pacients.find((x) => x.id === id)
    return p ? nomComplet(p) : '—'
  }

  // En obrir (i en canviar de dies), si cal desplaçar-se, la vista comença una
  // hora abans de l'hora actual o de la primera cita, en punt
  const clauDies = `${dies.join()}|${alturaHora}`
  const situada = useRef('')
  useLayoutEffect(() => {
    const el = desplacament.current
    if (!el || !espai || situada.current === clauDies) return
    situada.current = clauDies
    const minut = minutInicial(dies, new Date(), horari, visibles)
    el.scrollTop = Math.max(0, y(iniciVista(minut, rang)) - 8)
  })

  // Lliscar el dit (tauleta): canvia de dia o de setmana
  const inici = useRef<{ x: number; y: number } | null>(null)
  const tocar = (e: TouchEvent) => {
    const p = e.touches[0]
    inici.current = e.touches.length === 1 && p ? { x: p.clientX, y: p.clientY } : null
  }
  const deixar = (e: TouchEvent) => {
    const p = e.changedTouches[0]
    const i = inici.current
    inici.current = null
    if (!p || !i) return
    const dx = p.clientX - i.x
    const dy = p.clientY - i.y
    if (Math.abs(dx) > LLISCAMENT && Math.abs(dx) > 1.5 * Math.abs(dy)) onLliscar(dx < 0 ? 1 : -1)
  }

  const minutAra = ara.getHours() * 60 + ara.getMinutes()

  return (
    <div className="contenidor-graella">
      {buida && (
        <div className="franja-buida" role="status">
          <span>{buit}</span>
          <Boto variant="secundari" onClick={onNova}>
            {t.cites.novaCita}
          </Boto>
        </div>
      )}
      <div
        ref={desplacament}
        style={{ maxHeight: espai?.graella }}
        className={`agenda agenda-${dies.length === 1 ? 'dia' : 'setmana'}`}
        data-testid="graella-agenda"
        onTouchStart={tocar}
        onTouchEnd={deixar}
      >
        <div className="agenda-hores" aria-hidden="true">
          <div className="agenda-capcalera" />
          <div className="agenda-cos" style={{ height: alcada }}>
            {franges
              .filter((m) => m % 60 === 0)
              .map((m) => (
                <span key={m} style={{ top: y(m) }}>
                  {hhmm(m)}
                </span>
              ))}
          </div>
        </div>
        {dies.map((d) => {
          const delDia = perDia.get(d) ?? []
          const columnes = columnesDelDia(delDia)
          const tancat = diesTancats.has(d)
          const laborable = esLaborable(d, horari)
          return (
            <section
              key={d}
              className={`agenda-dia${d === avui ? ' avui' : ''}${tancat || !laborable ? ' tancat' : ''}`}
              aria-label={formatar(t.cites.citesDel, { dia: diaLlarg(d) })}
            >
              <div className="agenda-capcalera">
                <span className="nom-dia">{diaCurt(d)}</span>
                {tancat && <span className="marca-tancat">{t.cites.diaTancat}</span>}
              </div>
              <div className="agenda-cos" style={{ height: alcada }}>
                {/* Fora de l'horari de consulta, ombrejat */}
                {!tancat && laborable && (
                  <>
                    <div className="fora-horari" style={{ top: 0, height: Math.max(0, y(horari.inici)) }} />
                    <div className="fora-horari" style={{ top: y(horari.fi), bottom: 0 }} />
                  </>
                )}
                {franges.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`franja${m % 60 === 0 ? ' en-punt' : ''}`}
                    style={{ top: y(m), height: quart }}
                    aria-label={formatar(t.cites.franjaLliure, { dia: diaLlarg(d), hora: hhmm(m) })}
                    onClick={() => onFranja(`${d}T${hhmm(m)}`)}
                  />
                ))}
                {d === avui && minutAra >= rang.inici && minutAra <= rang.fi && (
                  <div className="linia-ara" style={{ top: y(minutAra) }} data-minut={minutAra}>
                    <span className="sr-only">{t.cites.horaActual}</span>
                  </div>
                )}
                {delDia.map((c) => {
                  const { columna, columnes: n } = columnes.get(c.id)!
                  const solapa = solapaments(c, delDia).length > 0
                  const minut = minutDelDia(c.inici)
                  const durada = Math.min(c.durada, 24 * 60 - minut)
                  const alt = Math.max(ALT_MINIMA_CITA, (durada / FRANJA) * quart - 2)
                  const nom = nomDe(c.pacientId)
                  const tipusMotiu = `${t.cites.tipusNoms[c.tipus]}${c.motiu ? ` · ${c.motiu}` : ''}${
                    c.estat !== 'programada' ? ` · ${t.cites.estats[c.estat]}` : ''
                  }`
                  // Tota la informació: tooltip a l'ordinador i nom accessible
                  const tot = `${hora(c.inici)}–${hora(fiDe(c))} ${nom} · ${tipusMotiu} · ${formatar(t.cites.minuts, {
                    n: String(c.durada),
                  })}${solapa ? ` · ${t.cites.solapaCurt}` : ''}`
                  const linies = Math.max(1, Math.floor((alt - MARGE_TARGETA) / LINIA_TARGETA))
                  const contingut = contingutTargeta(alt, c.durada, LINIA_TARGETA, MARGE_TARGETA)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`cita-agenda tipus-${c.tipus} estat-${c.estat}${solapa ? ' solapa' : ''}`}
                      style={{
                        top: y(minut) + 1,
                        height: alt,
                        left: `calc(${(100 / n) * columna}% + 3px)`,
                        width: `calc(${100 / n}% - 6px)`,
                      }}
                      title={tot}
                      aria-label={tot}
                      onClick={() => onCita(c)}
                    >
                      {setmana ? (
                        // Setmana: nom, hora d'inici i motiu, segons l'alçada
                        contingut.tipus === 'curta' ? (
                          <span className="text-targeta" style={{ WebkitLineClamp: contingut.linies }}>
                            <span className="hora">{hora(c.inici)}</span> <span className="nom">{nom}</span>
                          </span>
                        ) : (
                          <>
                            <span className="nom text-targeta" style={{ WebkitLineClamp: contingut.liniesNom }}>
                              {nom}
                            </span>
                            <span className="hora">{hora(c.inici)}</span>
                            {contingut.motiu && c.motiu && <span className="detall">{c.motiu}</span>}
                          </>
                        )
                      ) : (
                        // Dia: hora i durada, nom i «tipus · motiu», si hi caben
                        <>
                          <span className="linia-targeta">
                            <span className="hora">
                              {hora(c.inici)}–{hora(fiDe(c))}
                            </span>{' '}
                            <span className="durada">· {formatar(t.cites.minuts, { n: String(c.durada) })}</span>
                            {solapa && <span className="marca-solapa"> · {t.cites.solapaCurt}</span>}
                          </span>
                          <span className="nom linia-targeta">{nom}</span>
                          {linies >= 3 && <span className="detall linia-targeta">{tipusMotiu}</span>}
                        </>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
