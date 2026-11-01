// Agenda: vista de dia i de setmana amb franges de 15 minuts. Tocar una franja
// buida crea una cita; tocar una cita l'obre per editar-la (moure-la,
// canviar-ne l'estat…). Les cites que se solapen es veuen una al costat de
// l'altra i marcades.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
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
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { FormulariCita } from './FormulariCita'

type Vista = 'dia' | 'setmana'
type Obert = { tipus: 'nova'; inici: string } | { tipus: 'editar'; cita: Cita } | null

/** Alçada d'una franja de 15 minuts (px) */
const ALT_FRANJA = 22
/** Horari que es veu sempre (es fa més gran si hi ha cites fora) */
const HORA_INICI = 8
const HORA_FI = 21

export function PantallaAgenda() {
  const magatzem = useMagatzem()
  const [params, setParams] = useSearchParams()
  // El dia d'avui es fixa en obrir la pantalla
  const [avui] = useState(() => diaDe(new Date()))
  const dia = esDia(params.get('dia') ?? '') ? params.get('dia')! : avui
  const vista: Vista = params.get('vista') === 'setmana' ? 'setmana' : 'dia'
  // Des de l'accés ràpid «Nova cita» (Avui) s'obre directament el formulari
  const [obert, setObert] = useState<Obert>(() => (params.get('nova') ? { tipus: 'nova', inici: `${dia}T10:00` } : null))
  const [versio, setVersio] = useState(0)

  const [carrega, substituir] = useCarrega(
    async () => {
      // Totes les cites: n'hi ha poques, i així els solapaments es comproven
      // encara que la cita es mogui a un altre dia
      const [pacients, cites] = await Promise.all([magatzem.llistarPacients(), magatzem.llistarCites('0000', '9999')])
      return { pacients, cites }
    },
    [magatzem, versio],
  )

  const dies = vista === 'dia' ? [dia] : setmanaDe(dia)
  const anar = (nouDia: string, novaVista: Vista = vista) => {
    setObert(null)
    setParams({ dia: nouDia, vista: novaVista }, { replace: true })
  }
  const pas = vista === 'dia' ? 1 : 7

  return (
    <main className="pantalla pantalla-agenda">
      <div className="capcalera-pantalla">
        <h1>{t.cites.titol}</h1>
        <Boto onClick={() => setObert({ tipus: 'nova', inici: `${dia}T10:00` })}>{t.cites.novaCita}</Boto>
      </div>
      <div className="barra-agenda">
        <div className="grup-botons">
          <Boto variant="secundari" onClick={() => anar(sumarDies(dia, -pas))} aria-label={t.cites.anterior}>
            ‹
          </Boto>
          <Boto variant="secundari" onClick={() => anar(avui)}>
            {t.cites.avui}
          </Boto>
          <Boto variant="secundari" onClick={() => anar(sumarDies(dia, pas))} aria-label={t.cites.seguent}>
            ›
          </Boto>
        </div>
        <h2 className="dia-agenda">{vista === 'dia' ? diaLlarg(dia) : mesAny(dies[0]!)}</h2>
        <div className="segmentat" role="radiogroup" aria-label={t.cites.vista}>
          {(['dia', 'setmana'] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={vista === v} onClick={() => anar(dia, v)}>
              {t.cites[v]}
            </button>
          ))}
        </div>
      </div>

      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && (
        <>
          <Graella
            dies={dies}
            avui={avui}
            cites={carrega.dades.cites}
            pacients={carrega.dades.pacients}
            onFranja={(inici) => setObert({ tipus: 'nova', inici })}
            onCita={(cita) => setObert({ tipus: 'editar', cita })}
          />
          {obert && (
            <div className="fons-dialeg">
              <section
                className="dialeg dialeg-cita"
                role="dialog"
                aria-modal="true"
                aria-label={
                  obert.tipus === 'nova'
                    ? t.cites.novaCita
                    : formatar(t.cites.editarCita, { nom: nomDe(carrega.dades.pacients, obert.cita.pacientId) })
                }
              >
                <h2>
                  {obert.tipus === 'nova'
                    ? t.cites.novaCita
                    : formatar(t.cites.editarCita, { nom: nomDe(carrega.dades.pacients, obert.cita.pacientId) })}
                </h2>
                <FormulariCita
                  key={obert.tipus === 'nova' ? obert.inici : obert.cita.id}
                  id={obert.tipus === 'editar' ? obert.cita.id : undefined}
                  inicial={obert.tipus === 'nova' ? novaCita('', obert.inici) : obert.cita}
                  pacients={carrega.dades.pacients}
                  altres={carrega.dades.cites}
                  onCancellar={() => setObert(null)}
                  onDesar={async (dades: DadesCita) => {
                    if (obert.tipus === 'nova') await magatzem.crearCita(dades)
                    else await magatzem.actualitzarCita(obert.cita.id, dades)
                    setObert(null)
                    if (dades.inici.slice(0, 10) !== dia && !dies.includes(dades.inici.slice(0, 10)))
                      anar(dades.inici.slice(0, 10))
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
              </section>
            </div>
          )}
        </>
      )}
    </main>
  )
}

function nomDe(pacients: readonly Pacient[], id: string): string {
  const p = pacients.find((x) => x.id === id)
  return p ? nomComplet(p) : '—'
}

function Graella({
  dies,
  avui,
  cites,
  pacients,
  onFranja,
  onCita,
}: {
  dies: string[]
  avui: string
  cites: readonly Cita[]
  pacients: readonly Pacient[]
  onFranja(inici: string): void
  onCita(c: Cita): void
}) {
  const perDia = useMemo(() => {
    const m = new Map<string, Cita[]>()
    for (const d of dies) m.set(d, [])
    for (const c of cites) m.get(c.inici.slice(0, 10))?.push(c)
    return m
  }, [dies, cites])

  // L'horari s'eixampla si hi ha cites abans de les 8 o després de les 21
  const visibles = [...perDia.values()].flat()
  const primera = Math.min(HORA_INICI * 60, ...visibles.map((c) => Math.floor(minutDelDia(c.inici) / 60) * 60))
  const ultima = Math.max(
    HORA_FI * 60,
    ...visibles.map((c) => Math.min(24 * 60, Math.ceil((minutDelDia(c.inici) + c.durada) / 60) * 60)),
  )
  const franges = Array.from({ length: (ultima - primera) / FRANJA }, (_, i) => primera + i * FRANJA)
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

  return (
    <div className={`agenda agenda-${dies.length === 1 ? 'dia' : 'setmana'}`}>
      <div className="agenda-hores" aria-hidden="true">
        <div className="agenda-capcalera" />
        <div className="agenda-cos" style={{ height: franges.length * ALT_FRANJA }}>
          {franges
            .filter((m) => m % 60 === 0)
            .map((m) => (
              <span key={m} style={{ top: ((m - primera) / FRANJA) * ALT_FRANJA }}>
                {hhmm(m)}
              </span>
            ))}
        </div>
      </div>
      {dies.map((d) => {
        const delDia = perDia.get(d) ?? []
        const columnes = columnesDelDia(delDia)
        return (
          <section
            key={d}
            className={`agenda-dia${d === avui ? ' avui' : ''}`}
            aria-label={formatar(t.cites.citesDel, { dia: diaLlarg(d) })}
          >
            <div className="agenda-capcalera">{diaCurt(d)}</div>
            <div className="agenda-cos" style={{ height: franges.length * ALT_FRANJA }}>
              {franges.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`franja${m % 60 === 0 ? ' en-punt' : ''}`}
                  style={{ top: ((m - primera) / FRANJA) * ALT_FRANJA, height: ALT_FRANJA }}
                  aria-label={formatar(t.cites.franjaLliure, { dia: diaLlarg(d), hora: hhmm(m) })}
                  onClick={() => onFranja(`${d}T${hhmm(m)}`)}
                />
              ))}
              {delDia.map((c) => {
                const { columna, columnes: n } = columnes.get(c.id)!
                const solapa = solapaments(c, delDia).length > 0
                const inici = minutDelDia(c.inici)
                const durada = Math.min(c.durada, 24 * 60 - inici)
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cita-agenda estat-${c.estat}${solapa ? ' solapa' : ''}`}
                    style={{
                      top: ((inici - primera) / FRANJA) * ALT_FRANJA,
                      height: Math.max(ALT_FRANJA, (durada / FRANJA) * ALT_FRANJA - 2),
                      left: `calc(${(100 / n) * columna}% + 2px)`,
                      width: `calc(${100 / n}% - 4px)`,
                    }}
                    onClick={() => onCita(c)}
                  >
                    <span className="hora">
                      {hora(c.inici)}–{hora(fiDe(c))}
                    </span>{' '}
                    <span className="nom">{nomDe(pacients, c.pacientId)}</span>
                    <span className="detall">
                      {' · '}
                      {t.cites.tipusNoms[c.tipus]}
                      {c.estat !== 'programada' && ` · ${t.cites.estats[c.estat]}`}
                    </span>
                    {solapa && <span className="marca-solapa"> · {t.cites.solapaCurt}</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
