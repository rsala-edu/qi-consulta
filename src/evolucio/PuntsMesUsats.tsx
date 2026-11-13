// Punts més usats (etapa 3C): barres (per defecte), llista o al mapa. La vista
// es recorda a cada dispositiu; els filtres (cos, orella o tots, i aquest
// episodi o tots els del pacient) no.

import { useMemo, useState } from 'react'
import { Boto } from '../components/Boto'
import { puntsMesUsats, type FiltreMapa, type SessioEvolucio } from '../domini/evolucio'
import { diaCurtMes, formatar, t } from '../i18n/t'
import { MapaUs } from './MapaUs'
import { nomPunt } from './nomPunt'
import { desarVistaPunts, vistaPuntsInicial, VISTES_PUNTS, type VistaPunts } from './preferencies'

const MAXIM_BARRES = 10

interface Props {
  sessionsEpisodi: readonly SessioEvolucio[]
  sessionsPacient: readonly SessioEvolucio[]
}

function Segmentat<T extends string>({ nom, valors, valor, textos, onCanviar }: { nom: string; valors: readonly T[]; valor: T; textos: Record<T, string>; onCanviar(v: T): void }) {
  return (
    <div className="segmentat" role="radiogroup" aria-label={nom}>
      {valors.map((v) => (
        <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => onCanviar(v)}>
          {textos[v]}
        </button>
      ))}
    </div>
  )
}

export function PuntsMesUsats({ sessionsEpisodi, sessionsPacient }: Props) {
  const e = t.evolucio
  const [vista, setVistaEstat] = useState<VistaPunts>(vistaPuntsInicial)
  const [filtre, setFiltre] = useState<FiltreMapa>('tots')
  const [ambit, setAmbit] = useState<'episodi' | 'pacient'>('episodi')
  const [tots, setTots] = useState(false)
  const setVista = (v: VistaPunts) => {
    setVistaEstat(v)
    desarVistaPunts(v)
  }
  const usos = useMemo(
    () => puntsMesUsats(ambit === 'episodi' ? sessionsEpisodi : sessionsPacient, filtre),
    [ambit, sessionsEpisodi, sessionsPacient, filtre],
  )
  const maxim = Math.max(1, ...usos.map((u) => u.sessions))
  const barres = tots ? usos : usos.slice(0, MAXIM_BARRES)

  return (
    <section className="punts-usats" aria-label={e.puntsUsats}>
      <h4>{e.puntsUsats}</h4>
      <div className="filtres-us">
        <Segmentat<VistaPunts> nom={e.vista} valors={VISTES_PUNTS} valor={vista} textos={e.vistes} onCanviar={setVista} />
        <Segmentat<FiltreMapa> nom={e.filtreMapa} valors={['cos', 'orella', 'tots'] as const} valor={filtre} textos={e.filtres} onCanviar={setFiltre} />
        <Segmentat<'episodi' | 'pacient'> nom={e.ambit} valors={['episodi', 'pacient'] as const} valor={ambit} textos={e.ambits} onCanviar={setAmbit} />
      </div>
      {usos.length === 0 ? (
        <p className="detall">{e.capPunt}</p>
      ) : vista === 'barres' ? (
        <>
          <ol className="barres-us">
            {barres.map((u) => (
              <li key={u.clau}>
                <span className="nom-us">
                  <strong>{u.codi}</strong> <span className="detall">{nomPunt(u.mapa, u.codi)}</span>
                </span>
                <span className="barra-us" aria-hidden="true">
                  <span style={{ width: `${(u.sessions / maxim) * 100}%` }} />
                </span>
                <span className="detall quantes-us">{formatar(e.enSessions, { n: String(u.sessions), de: String(u.de) })}</span>
              </li>
            ))}
          </ol>
          {usos.length > MAXIM_BARRES && (
            <Boto variant="discret" onClick={() => setTots((x) => !x)} aria-expanded={tots}>
              {tots ? e.veureMenys : formatar(e.veureTots, { n: String(usos.length) })}
            </Boto>
          )}
        </>
      ) : vista === 'llista' ? (
        <div className="taula-us-desplacable">
          <table className="taula-us">
            <thead>
              <tr>
                <th scope="col">{e.columnes.punt}</th>
                <th scope="col">{e.columnes.sessions}</th>
                <th scope="col">{e.columnes.primera}</th>
                <th scope="col">{e.columnes.ultima}</th>
                <th scope="col">{e.columnes.tecnica}</th>
              </tr>
            </thead>
            <tbody>
              {usos.map((u) => (
                <tr key={u.clau}>
                  <th scope="row">
                    {u.codi} <span className="detall">{nomPunt(u.mapa, u.codi)}</span>
                  </th>
                  <td>{formatar(e.enSessions, { n: String(u.sessions), de: String(u.de) })}</td>
                  <td>{diaCurtMes(u.primera.dia)}</td>
                  <td>{diaCurtMes(u.ultima.dia)}</td>
                  <td>{t.mapa.tecnica[u.tecnica]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <MapaUs usos={usos} mapes={filtre === 'tots' ? ['cos', 'orella'] : [filtre]} />
      )}
    </section>
  )
}
