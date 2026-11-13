// A la pestanya Tractament (etapa 4B): «Protocols» obre un cercador (amb els
// suggerits per al motiu de l'episodi o la síndrome a dalt); en triar-ne un,
// si la sessió ja té punts pregunta si substituir-los o afegir-los. La sessió
// desa de quin protocol s'ha partit. «Desar com a protocol» desa els punts de
// la sessió com un protocol nou.

import { useState, type Dispatch, type SetStateAction } from 'react'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { aplicarProtocol, cercar, protocolDeSessio, suggerits, type Protocol } from '../../domini/protocol'
import { llistaPunts, type DadesSessio } from '../../domini/sessio'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'

const p = t.protocols

export function BotonsProtocols({
  dades,
  setDades,
  editable,
  textosSuggeriment,
  etiquetaEpisodi,
}: {
  dades: DadesSessio
  setDades: Dispatch<SetStateAction<DadesSessio>>
  editable: boolean
  /** Motiu de l'episodi i síndromes, per suggerir protocols */
  textosSuggeriment: readonly string[]
  /** Etiqueta per defecte en desar un protocol nou (el motiu de l'episodi) */
  etiquetaEpisodi: string
}) {
  const magatzem = useMagatzem()
  const [obert, setObert] = useState<'cercar' | 'desar' | null>(null)
  const [protocols, setProtocols] = useState<Protocol[] | null>(null)
  const [consulta, setConsulta] = useState('')
  const [triat, setTriat] = useState<Protocol | null>(null)
  const [nom, setNom] = useState('')
  const [desat, setDesat] = useState<string | null>(null)
  if (!editable) return null

  const obrirCercador = async () => {
    setObert('cercar')
    setConsulta('')
    setTriat(null)
    setProtocols(await magatzem.protocols())
  }
  const aplicar = (x: Protocol, substituir: boolean) => {
    setDades((d) => ({ ...d, punts: aplicarProtocol(d.punts, x, substituir), protocol: { id: x.id, nom: x.nom } }))
    setObert(null)
    setTriat(null)
  }
  const triar = (x: Protocol) => {
    if (Object.keys(dades.punts).length === 0) aplicar(x, true)
    else setTriat(x)
  }
  const sug = protocols ? suggerits(protocols, textosSuggeriment) : []
  const resultats = protocols ? cercar(protocols, consulta).filter((x) => consulta.trim() || !sug.includes(x)) : []

  return (
    <>
      <Boto variant="secundari" className="boto-protocols" onClick={() => void obrirCercador()}>
        {p.boto}
      </Boto>

      {obert === 'cercar' && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setObert(null)}>
          <section className="dialeg dialeg-protocols" role="dialog" aria-modal="true" aria-label={p.titol}>
            <h2>{p.titol}</h2>
            {triat ? (
              <div className="pregunta-protocol" role="group" aria-label={p.preguntaTitol}>
                <p>{formatar(p.pregunta, { nom: triat.nom })}</p>
                <div className="accions accions-esquerra">
                  <Boto onClick={() => aplicar(triat, true)}>{p.substituir}</Boto>
                  <Boto variant="secundari" onClick={() => aplicar(triat, false)}>
                    {p.afegir}
                  </Boto>
                  <Boto variant="discret" onClick={() => setTriat(null)}>
                    {t.app.cancellar}
                  </Boto>
                </div>
              </div>
            ) : (
              <>
                <input type="search" className="cerca-protocols" aria-label={p.cercar} placeholder={p.cercar} value={consulta} autoFocus onChange={(e) => setConsulta(e.target.value)} />
                {!consulta.trim() && sug.length > 0 && (
                  <section aria-label={p.suggerits}>
                    <h3>{p.suggerits}</h3>
                    <LlistaProtocols llista={sug} onTriar={triar} />
                  </section>
                )}
                <section aria-label={p.tots}>
                  {!consulta.trim() && sug.length > 0 && <h3>{p.tots}</h3>}
                  {resultats.length === 0 ? <p className="detall">{p.capTrobat}</p> : <LlistaProtocols llista={resultats} onTriar={triar} />}
                </section>
                <div className="accions">
                  {/* Els punts d'aquesta sessió, com un protocol nou */}
                  {llistaPunts(dades.punts).length > 0 && (
                    <Boto
                      variant="secundari"
                      onClick={() => {
                        setNom('')
                        setDesat(null)
                        setObert('desar')
                      }}
                    >
                      {p.desarCom}
                    </Boto>
                  )}
                  <Boto variant="discret" onClick={() => setObert(null)}>
                    {t.app.cancellar}
                  </Boto>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {obert === 'desar' && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setObert(null)}>
          <section className="dialeg dialeg-protocols" role="dialog" aria-modal="true" aria-label={p.desarCom}>
            <h2>{p.desarCom}</h2>
            {desat ? (
              <>
                <p role="status">{formatar(p.desatCom, { nom: desat })}</p>
                <div className="accions">
                  <Boto onClick={() => setObert(null)}>{t.mapa.tancar}</Boto>
                </div>
              </>
            ) : (
              <>
                <p className="detall">{llistaPunts(dades.punts).map((x) => x.codi).join(' · ')}</p>
                <Camp etiqueta={p.nom}>
                  <input value={nom} autoFocus onChange={(e) => setNom(e.target.value)} />
                </Camp>
                <div className="accions accions-esquerra">
                  <Boto
                    disabled={!nom.trim()}
                    onClick={() =>
                      void magatzem
                        .desarProtocol(null, protocolDeSessio(nom, llistaPunts(dades.punts), etiquetaEpisodi ? [etiquetaEpisodi] : []))
                        .then((x) => setDesat(x.nom))
                    }
                  >
                    {p.desar}
                  </Boto>
                  <Boto variant="discret" onClick={() => setObert(null)}>
                    {t.app.cancellar}
                  </Boto>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function LlistaProtocols({ llista, onTriar }: { llista: readonly Protocol[]; onTriar(x: Protocol): void }) {
  return (
    <ul className="llista-protocols-visita">
      {llista.map((x) => (
        <li key={x.id}>
          <button type="button" className="fila-protocol" onClick={() => onTriar(x)}>
            <strong>{x.nom}</strong>
            {x.exemple && <span className="etiqueta etiqueta-exemple">{p.exemple}</span>}
            <span className="detall">{x.punts.map((q) => q.codi).join(' · ')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
