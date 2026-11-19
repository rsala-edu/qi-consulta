// Llista de documents adjunts (etapa 4E): miniatura (o la icona del tipus),
// títol, tipus, data, pàgines i mida, el vincle (sessió o valoració) i
// «Pendent de pujar» mentre el fitxer no és a Drive. Tocar-ne un l'obre al
// visor. Els anul·lats no es mostren: només el registre (quan i per què).

import { useState } from 'react'
import { Indicador } from '../components/Indicador'
import { midaLlegible, vigents, type Document, type TipusDocument } from '../domini/document'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'
import { useCarrega } from '../sessio/useCarrega'
import { AfegirDocuments, type ContextDocuments } from './AfegirDocuments'
import { VisorDocument } from './VisorDocument'

const d = t.documents

/** Icona per tipus (quan no hi ha miniatura): un full amb la inicial */
function IconaTipus({ tipus }: { tipus: TipusDocument }) {
  return (
    <svg className={`icona-document icona-${tipus}`} viewBox="0 0 48 60" aria-hidden="true">
      <path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="currentColor" opacity="0.12" />
      <path d="M32 2v12h12" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 2h28l12 12v42a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="23" y="44" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
        {d.tipus[tipus].charAt(0)}
      </text>
    </svg>
  )
}

export function LlistaDocuments({
  documents,
  pendents,
  numeroSessio,
  diaValoracio,
  onCanvi,
}: {
  documents: readonly Document[]
  pendents: ReadonlySet<string>
  numeroSessio?(id: string): number | undefined
  diaValoracio?(id: string): string | undefined
  onCanvi(): void
}) {
  const [obert, setObert] = useState<Document | null>(null)
  const llista = vigents(documents)
  const anullats = documents.filter((x) => x.anullat)
  return (
    <>
      {llista.length === 0 ? (
        <p className="detall">{d.cap}</p>
      ) : (
        <ul className="llista-documents" aria-label={d.titol}>
          {llista.map((x) => {
            const sessio = x.sessioId ? numeroSessio?.(x.sessioId) : undefined
            const valoracio = x.valoracioId ? diaValoracio?.(x.valoracioId) : undefined
            return (
              <li key={x.id}>
                <button type="button" className="targeta-document" aria-label={formatar(d.obrir, { titol: x.titol })} onClick={() => setObert(x)}>
                  <span className="miniatura-document">{x.miniatura ? <img src={x.miniatura} alt="" /> : <IconaTipus tipus={x.tipus} />}</span>
                  <span className="text-document-adjunt">
                    <strong>{x.titol}</strong>
                    <span className="detall">
                      {d.tipus[x.tipus]} · {new Date(`${x.data}T12:00:00`).toLocaleDateString('ca')}
                    </span>
                    <span className="detall">
                      {x.format === 'pdf' ? `PDF · ${formatar(d.paginesN, { n: String(x.pagines) })}` : 'JPEG'} · {midaLlegible(x.mida)}
                      {sessio ? ` · ${formatar(d.deSessio, { n: String(sessio) })}` : ''}
                      {valoracio ? ` · ${formatar(d.deValoracio, { dia: valoracio })}` : ''}
                    </span>
                    {pendents.has(x.id) && <span className="etiqueta etiqueta-pendent-pujar">{d.pendentPujar}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {anullats.length > 0 && (
        <details className="fotos-esborrades documents-anullats">
          <summary>
            {d.anullats} ({anullats.length})
          </summary>
          <ul>
            {anullats.map((x) => (
              <li key={x.id}>
                {formatar(d.anullatEl, {
                  titol: x.titol,
                  quan: new Date(x.anullat!.at).toLocaleString('ca', { dateStyle: 'medium', timeStyle: 'short' }),
                  motiu: x.anullat!.motiu,
                })}
              </li>
            ))}
          </ul>
        </details>
      )}
      {obert && (
        <VisorDocument
          document={obert}
          onTancar={() => setObert(null)}
          onAnullat={() => {
            setObert(null)
            onCanvi()
          }}
        />
      )}
    </>
  )
}

/**
 * Els documents d'un pacient (o només els d'un episodi, a la visita), amb
 * «Fotografiar document» i «Pujar fitxer».
 */
export function PanellDocuments({ context, nomesEpisodi = false }: { context: ContextDocuments; nomesEpisodi?: boolean }) {
  const magatzem = useMagatzem()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const [tots, sessions] = await Promise.all([magatzem.documentsDe(context.pacientId), magatzem.sessionsDelPacient(context.pacientId)])
    const documents = nomesEpisodi ? tots.filter((x) => x.episodiId === context.episodiId) : tots
    const pendents = await magatzem.documentsPendentsDePujar(documents.map((x) => x.id))
    return { documents, sessions, pendents }
  }, [magatzem, context.pacientId, context.episodiId, nomesEpisodi, versio])
  const refrescar = () => setVersio((n) => n + 1)
  return (
    <div className="panell-documents">
      <AfegirDocuments context={context} onDesats={refrescar} />
      {carrega.estat === 'carregant' ? (
        <Indicador text={t.app.carregant} />
      ) : carrega.estat === 'error' ? (
        <p role="alert">{t.app.errorInesperat}</p>
      ) : (
        <LlistaDocuments
          documents={carrega.dades.documents}
          pendents={carrega.dades.pendents}
          numeroSessio={(id) => carrega.dades.sessions.find((s) => s.id === id)?.numero}
          onCanvi={refrescar}
        />
      )}
    </div>
  )
}
