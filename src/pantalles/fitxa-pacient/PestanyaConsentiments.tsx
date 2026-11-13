// Pestanya «Consentiments» de la fitxa del pacient (etapa 4A): l'estat de cada
// tipus (vigent, pendent o revocat), «Signar» (si la plantilla està
// aprovada) i l'historial de documents signats, que es poden veure, imprimir,
// descarregar (amb l'avís que el fitxer ja no està xifrat) i revocar.

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { aprovadaDe, estatDelTipus, TIPUS_CONSENTIMENT, type Consentiment } from '../../domini/consentiment'
import { descarregarPdf, nomFitxer, urlPdf } from '../../consentiment/document'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { useFitxaPacient } from './PantallaFitxaPacient'

const c = t.consentiments
const quan = (iso: string) => new Date(iso).toLocaleString('ca', { dateStyle: 'long', timeStyle: 'short' })

export function PestanyaConsentiments() {
  const magatzem = useMagatzem()
  const { pacient } = useFitxaPacient()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const [consentiments, plantilles] = await Promise.all([magatzem.consentimentsDe(pacient.id), magatzem.plantillesConsentiment()])
    return { consentiments, plantilles }
  }, [magatzem, pacient.id, versio])
  const [obert, setObert] = useState<Consentiment | null>(null)

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>
  const { consentiments, plantilles } = carrega.dades

  return (
    <section className="consentiments" aria-label={c.titol}>
      {TIPUS_CONSENTIMENT.map((tipus) => {
        const estat = estatDelTipus(consentiments, tipus)
        const delTipus = consentiments.filter((x) => x.tipus === tipus)
        const aprovada = aprovadaDe(plantilles, tipus)
        return (
          <article key={tipus} className="panell consentiment" aria-label={c.tipus[tipus]}>
            <header className="capcalera-consentiment">
              <h3>{c.tipus[tipus]}</h3>
              <span className={`etiqueta etiqueta-consentiment-${estat}`}>{c.estats[estat]}</span>
              {estat !== 'vigent' &&
                (aprovada ? (
                  <Link className="boto boto-principal" to={`/pacients/${pacient.id}/consentiments/${tipus}/signar`}>
                    {c.signar}
                  </Link>
                ) : (
                  <span className="detall">{c.capAprovada}</span>
                ))}
            </header>
            {delTipus.length === 0 ? (
              <p className="detall">{c.capSignat}</p>
            ) : (
              <ol className="historial-consentiments" aria-label={c.historial}>
                {delTipus.map((x) => (
                  <Document key={x.id} consentiment={x} onVeure={() => setObert(x)} onRevocat={() => setVersio((n) => n + 1)} />
                ))}
              </ol>
            )}
          </article>
        )
      })}
      {obert && <VisorPdf consentiment={obert} onTancar={() => setObert(null)} />}
    </section>
  )
}

function Document({ consentiment: x, onVeure, onRevocat }: { consentiment: Consentiment; onVeure(): void; onRevocat(): void }) {
  const magatzem = useMagatzem()
  const [revocant, setRevocant] = useState(false)
  const [motiu, setMotiu] = useState('')
  return (
    <li className={`document-consentiment ${x.estat}`}>
      <span>
        {formatar(c.versioSignat, { versio: String(x.versio), quan: quan(x.signatAt) })} ·{' '}
        <strong>{c.estats[x.estat === 'vigent' ? 'vigent' : 'revocat']}</strong>
      </span>
      {x.revocacio && <span className="detall">{formatar(c.revocatEl, { quan: quan(x.revocacio.at), motiu: x.revocacio.motiu })}</span>}
      <div className="accions accions-esquerra">
        <Boto variant="secundari" onClick={onVeure}>
          {c.veure}
        </Boto>
        <Boto
          variant="discret"
          onClick={() => {
            if (window.confirm(c.avisDescarrega)) descarregarPdf(x.pdf, nomFitxer(x.tipus, x.versio, x.signatAt))
          }}
        >
          {c.descarregar}
        </Boto>
        {x.estat === 'vigent' && !revocant && (
          <Boto variant="discret" onClick={() => setRevocant(true)}>
            {c.revocar}
          </Boto>
        )}
      </div>
      {revocant && (
        <div className="formulari revocar-consentiment">
          <Camp etiqueta={c.motiuRevocacio}>
            <textarea rows={2} value={motiu} autoFocus onChange={(e) => setMotiu(e.target.value)} />
          </Camp>
          <div className="accions accions-esquerra">
            <Boto disabled={!motiu.trim()} onClick={() => void magatzem.revocarConsentiment(x.id, motiu).then(onRevocat)}>
              {c.confirmarRevocacio}
            </Boto>
            <Boto variant="discret" onClick={() => setRevocant(false)}>
              {t.app.cancellar}
            </Boto>
          </div>
        </div>
      )}
    </li>
  )
}

/** El PDF dins l'app (sense sortir-ne); imprimir avisa que surt sense xifrar */
function VisorPdf({ consentiment: x, onTancar }: { consentiment: Consentiment; onTancar(): void }) {
  const [url] = useState(() => urlPdf(x.pdf))
  const marc = useRef<HTMLIFrameElement>(null)
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && onTancar()}>
      <section className="dialeg dialeg-pdf" role="dialog" aria-modal="true" aria-label={x.titol}>
        <h2>{x.titol}</h2>
        <iframe ref={marc} className="visor-pdf" src={url} title={x.titol} />
        <div className="accions">
          <Boto
            variant="secundari"
            onClick={() => {
              if (window.confirm(c.avisDescarrega)) marc.current?.contentWindow?.print()
            }}
          >
            {c.imprimir}
          </Boto>
          <Boto onClick={onTancar}>{c.tancarDocument}</Boto>
        </div>
      </section>
    </div>
  )
}
