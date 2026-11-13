// Ajustos > Protocols (etapa 4B): la llista (els arxivats, a part), crear,
// editar, duplicar, arxivar i esborrar. Els exemples inicials porten
// «Exemple · revisa-les» i es poden editar o esborrar com els altres.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { duplicar, nouProtocol, type DadesProtocol, type Protocol } from '../../domini/protocol'
import { COSTATS_MARCAT, nouPuntMarcat, TECNIQUES_DEL_MAPA, type Mapa, type PuntMarcat } from '../../domini/puntMarcat'
import { nomPunt } from '../../evolucio/nomPunt'
import { formatar, t } from '../../i18n/t'
import { cercarPuntsOrella } from '../../orella/cataleg'
import { cataleg, cercarPunts } from '../../punts/cataleg'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const p = t.protocols

const dadesDe = ({ id: _i, creatAt: _c, modificatAt: _m, ...d }: Protocol): DadesProtocol => d

export function PantallaProtocols() {
  const magatzem = useMagatzem()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(() => magatzem.protocols(), [magatzem, versio])
  const [editant, setEditant] = useState<{ id: string | null; dades: DadesProtocol } | null>(null)
  const [arxivats, setArxivats] = useState(false)
  const recarregar = () => setVersio((n) => n + 1)

  if (editant)
    return (
      <main className="pantalla pantalla-protocols">
        <EditorProtocol
          inicial={editant.dades}
          onDesar={(d) =>
            void magatzem.desarProtocol(editant.id, d).then(() => {
              setEditant(null)
              recarregar()
            })
          }
          onCancellar={() => setEditant(null)}
        />
      </main>
    )

  const llista = carrega.estat === 'llest' ? carrega.dades.filter((x) => arxivats || !x.arxivat) : []
  return (
    <main className="pantalla pantalla-protocols">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{p.titol}</h1>
      <p className="detall">{p.desc}</p>
      <div className="accions accions-esquerra">
        <Boto onClick={() => setEditant({ id: null, dades: nouProtocol() })}>{p.nou}</Boto>
        <label className="casella">
          <input type="checkbox" checked={arxivats} onChange={(e) => setArxivats(e.target.checked)} />
          {p.mostrarArxivats}
        </label>
      </div>
      {carrega.estat !== 'llest' ? (
        <Indicador text={t.app.carregant} />
      ) : llista.length === 0 ? (
        <p className="detall">{p.cap}</p>
      ) : (
        <ul className="llista-protocols">
          {llista.map((x) => (
            <li key={x.id} className={`panell protocol${x.arxivat ? ' arxivat' : ''}`} aria-label={x.nom}>
              <div className="capcalera-protocol">
                <h2>{x.nom}</h2>
                {x.exemple && <span className="etiqueta etiqueta-exemple">{p.exemple}</span>}
                {x.arxivat && <span className="etiqueta">{p.arxivat}</span>}
              </div>
              {x.descripcio && <p>{x.descripcio}</p>}
              <p className="punts-protocol">
                {x.punts.map((q) => q.codi).join(' · ')} <span className="detall">({formatar(p.nPunts, { n: String(x.punts.length) })})</span>
              </p>
              {x.etiquetes.length > 0 && (
                <p className="etiquetes-protocol">
                  {x.etiquetes.map((e) => (
                    <span key={e} className="xip-etiqueta">
                      {e}
                    </span>
                  ))}
                </p>
              )}
              <div className="accions accions-esquerra">
                <Boto variant="secundari" onClick={() => setEditant({ id: x.id, dades: dadesDe(x) })}>
                  {p.editar}
                </Boto>
                <Boto variant="discret" onClick={() => void magatzem.desarProtocol(null, duplicar(dadesDe(x), p.copia)).then(recarregar)}>
                  {p.duplicar}
                </Boto>
                <Boto variant="discret" onClick={() => void magatzem.desarProtocol(x.id, { ...dadesDe(x), arxivat: !x.arxivat }).then(recarregar)}>
                  {x.arxivat ? p.desarxivar : p.arxivar}
                </Boto>
                <Boto
                  variant="discret"
                  onClick={() => {
                    if (window.confirm(formatar(p.confirmarEsborrar, { nom: x.nom }))) void magatzem.esborrarProtocol(x.id).then(recarregar)
                  }}
                >
                  {p.esborrar}
                </Boto>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function EditorProtocol({ inicial, onDesar, onCancellar }: { inicial: DadesProtocol; onDesar(d: DadesProtocol): void; onCancellar(): void }) {
  const [d, setD] = useState(inicial)
  const [etiquetes, setEtiquetes] = useState(inicial.etiquetes.join(', '))
  const [consulta, setConsulta] = useState('')
  const canviarPunt = (i: number, canvis: Partial<PuntMarcat>) => setD((x) => ({ ...x, punts: x.punts.map((q, j) => (j === i ? { ...q, ...canvis } : q)) }))
  const afegir = (codi: string, mapa: Mapa) => {
    if (!d.punts.some((q) => q.codi === codi && q.mapa === mapa)) setD((x) => ({ ...x, punts: [...x.punts, nouPuntMarcat(codi, 'bilateral', mapa === 'orella' ? 'llavor' : 'agulla', mapa)] }))
    setConsulta('')
  }
  const resultats = consulta.trim()
    ? [
        ...cercarPunts(cataleg, consulta).slice(0, 6).map((x) => ({ codi: x.codi, mapa: 'cos' as const, nom: x.pinyin })),
        ...cercarPuntsOrella(consulta).slice(0, 4).map((x) => ({ codi: x.codi, mapa: 'orella' as const, nom: x.nom })),
      ]
    : []
  return (
    <div className="formulari editor-protocol">
      <button type="button" className="enllac-tornar boto-enllac" onClick={onCancellar}>
        ← {p.tornar}
      </button>
      <h1>{d.nom || p.nou}</h1>
      {d.exemple && <p className="avis-suau">{p.exemple}</p>}
      <Camp etiqueta={p.nom}>
        <input value={d.nom} onChange={(e) => setD({ ...d, nom: e.target.value })} />
      </Camp>
      <Camp etiqueta={p.descripcio} ample>
        <textarea rows={2} value={d.descripcio} onChange={(e) => setD({ ...d, descripcio: e.target.value })} />
      </Camp>
      <Camp etiqueta={p.etiquetes} ample>
        <input value={etiquetes} onChange={(e) => setEtiquetes(e.target.value)} />
      </Camp>
      <section className="punts-editor" aria-label={p.punts}>
        <h2>{p.punts}</h2>
        {d.punts.length === 0 && <p className="detall">{p.capPunt}</p>}
        <ul>
          {d.punts.map((q, i) => (
            <li key={`${q.mapa}:${q.codi}`}>
              <strong>{q.codi}</strong> <span className="detall">{nomPunt(q.mapa, q.codi)}</span>
              <select aria-label={`${q.codi} · ${t.mapa.costatTitol}`} value={q.costat} onChange={(e) => canviarPunt(i, { costat: e.target.value as PuntMarcat['costat'] })}>
                {COSTATS_MARCAT.map((c) => (
                  <option key={c} value={c}>
                    {t.mapa.costat[c]}
                  </option>
                ))}
              </select>
              <select aria-label={`${q.codi} · ${t.mapa.tecnicaTitol}`} value={q.tecnica} onChange={(e) => canviarPunt(i, { tecnica: e.target.value as PuntMarcat['tecnica'] })}>
                {TECNIQUES_DEL_MAPA[q.mapa].map((x) => (
                  <option key={x} value={x}>
                    {t.mapa.tecnica[x]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="boto boto-discret"
                aria-label={formatar(p.treurePunt, { codi: q.codi })}
                onClick={() => setD((x) => ({ ...x, punts: x.punts.filter((_, j) => j !== i) }))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <Camp etiqueta={p.afegirPunt}>
          <input type="search" value={consulta} onChange={(e) => setConsulta(e.target.value)} />
        </Camp>
        {resultats.length > 0 && (
          <div className="resultats-punts">
            {resultats.map((r) => (
              <button key={`${r.mapa}:${r.codi}`} type="button" className="xip" onClick={() => afegir(r.codi, r.mapa)}>
                {r.codi} · {r.nom}
                {r.mapa === 'orella' ? ` (${t.orella.titol})` : ''}
              </button>
            ))}
          </div>
        )}
      </section>
      <Camp etiqueta={p.notes} ample>
        <textarea rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Camp>
      <div className="accions accions-esquerra">
        <Boto
          disabled={!d.nom.trim()}
          onClick={() =>
            onDesar({
              ...d,
              nom: d.nom.trim(),
              etiquetes: etiquetes
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        >
          {p.desar}
        </Boto>
        <Boto variant="discret" onClick={onCancellar}>
          {t.app.cancellar}
        </Boto>
      </div>
    </div>
  )
}
