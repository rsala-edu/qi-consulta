// Visor d'un document (etapa 4E), dins l'app. El fitxer es desxifra només a la
// memòria: els PDF es dibuixen amb pdf.js (també a les tauletes Android, que
// no mostren PDF dins la pàgina) i les imatges amb una URL blob que es revoca
// en tancar. No es desa mai al disc, llevat que la doctora triï «Descarregar»
// (amb l'avís que surt sense xifrar). Si el fitxer no és al dispositiu, es baixa
// de Drive i es guarda xifrat entre els recents (per obrir-lo sense xarxa).

import { useEffect, useRef, useState } from 'react'
import { Boto } from '../components/Boto'
import { Camp } from '../components/Camp'
import { midaLlegible, type Document } from '../domini/document'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'
import { useSincronia } from '../sincronia/ContextSincronia'
import { baixarImatge } from '../fotos/driveImatges'
import { carregarPdf } from './pdfjs'

const d = t.documents

/** El fitxer: del dispositiu o, si no hi és, de Drive (i es guarda entre els recents) */
export function useFitxerDocument(id: string): { bytes: Uint8Array | null; estat: 'carregant' | 'llest' | 'no' } {
  const magatzem = useMagatzem()
  const { driveImatges } = useSincronia()
  // La funció canvia cada vegada que canvia l'estat de la sincronia: si fos una
  // dependència, el fitxer es tornaria a llegir (i el PDF a dibuixar) a cada canvi
  const drive = useRef(driveImatges)
  useEffect(() => {
    drive.current = driveImatges
  }, [driveImatges])
  const [r, setR] = useState<{ bytes: Uint8Array | null; estat: 'carregant' | 'llest' | 'no' }>({ bytes: null, estat: 'carregant' })
  useEffect(() => {
    let viu = true
    void (async () => {
      let bytes = await magatzem.fitxerDocument(id)
      if (!bytes) {
        const d = drive.current()
        const text = d ? await baixarImatge(d, id).catch(() => null) : null
        if (text) {
          await magatzem.desarFitxerDocumentBaixat(id, text)
          bytes = await magatzem.fitxerDocument(id)
        }
      }
      if (viu) setR({ bytes, estat: bytes ? 'llest' : 'no' })
    })()
    return () => {
      viu = false
    }
  }, [id, magatzem])
  return r
}

function descarregar(bytes: Uint8Array, doc: Document) {
  const tipus = doc.format === 'pdf' ? 'application/pdf' : 'image/jpeg'
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: tipus }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${doc.titol.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'document'}-${doc.data}.${doc.format === 'pdf' ? 'pdf' : 'jpg'}`
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Les pàgines d'un PDF, dibuixades una per una a l'amplada del visor */
function PaginesPdf({ bytes, zoom }: { bytes: Uint8Array; zoom: number }) {
  const contenidor = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let viu = true
    let tancar: (() => void) | null = null
    const el = contenidor.current
    if (!el) return
    el.replaceChildren()
    void (async () => {
      try {
        const c = await carregarPdf(bytes)
        tancar = c.tancar
        if (!viu) return c.tancar()
        const amplada = Math.max(240, el.clientWidth - 2) * zoom
        for (let n = 1; n <= c.pdf.numPages && viu; n++) {
          const pagina = await c.pdf.getPage(n)
          const v1 = pagina.getViewport({ scale: 1 })
          const escala = amplada / v1.width
          const ppp = Math.min(2, window.devicePixelRatio || 1)
          const v = pagina.getViewport({ scale: escala * ppp })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(v.width)
          canvas.height = Math.ceil(v.height)
          canvas.style.width = `${Math.round(amplada)}px`
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', formatar(d.pagina, { n: String(n) }))
          canvas.className = 'pagina-pdf'
          const ctx = canvas.getContext('2d')!
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          el.append(canvas)
          await pagina.render({ canvas, canvasContext: ctx, viewport: v }).promise
        }
        if (viu) el.dataset.llest = 'si'
      } catch {
        if (viu) setError(true)
      }
    })()
    return () => {
      viu = false
      tancar?.()
      // Les pàgines dibuixades (dades de salut) fora de la pàgina
      el.replaceChildren()
      delete el.dataset.llest
    }
  }, [bytes, zoom])
  if (error) return <p className="avis avis-error">{d.noDisponible}</p>
  return <div className="pagines-pdf" ref={contenidor} data-testid="pagines-pdf" />
}

function ImatgeDocument({ bytes, titol, zoom }: { bytes: Uint8Array; titol: string; zoom: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'image/jpeg' }))
    setUrl(u)
    // En tancar el visor, la URL deixa d'existir
    return () => URL.revokeObjectURL(u)
  }, [bytes])
  return url ? <img className="imatge-document" src={url} alt={titol} style={{ width: `${zoom * 100}%` }} /> : null
}

export function VisorDocument({ document: doc, onTancar, onAnullat }: { document: Document; onTancar(): void; onAnullat(): void }) {
  const magatzem = useMagatzem()
  const { bytes, estat } = useFitxerDocument(doc.id)
  const [zoom, setZoom] = useState(1)
  const [anullant, setAnullant] = useState(false)
  const [motiu, setMotiu] = useState('')
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onTancar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onTancar])
  return (
    <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && onTancar()}>
      <section className="dialeg dialeg-document-adjunt" role="dialog" aria-modal="true" aria-label={doc.titol}>
        <header className="capcalera-visor-document">
          <div>
            <h2>{doc.titol}</h2>
            <p className="detall">
              {d.tipus[doc.tipus]} · {new Date(`${doc.data}T12:00:00`).toLocaleDateString('ca')}
              {doc.format === 'pdf' && ` · ${formatar(d.paginesN, { n: String(doc.pagines) })}`} · {midaLlegible(doc.mida)}
            </p>
            {doc.nota && <p className="detall">{doc.nota}</p>}
          </div>
          <div className="accions accions-esquerra">
            <Boto variant="discret" aria-label={d.reduir} title={d.reduir} disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
              −
            </Boto>
            <Boto variant="discret" aria-label={d.ampliar} title={d.ampliar} disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              +
            </Boto>
            <Boto variant="secundari" onClick={onTancar}>
              {d.tancar}
            </Boto>
          </div>
        </header>
        <div className="cos-visor-document">
          {estat === 'carregant' && <p className="detall">{d.obrint}</p>}
          {estat === 'no' && <p className="avis">{d.noDisponible}</p>}
          {bytes && (doc.format === 'pdf' ? <PaginesPdf bytes={bytes} zoom={zoom} /> : <ImatgeDocument bytes={bytes} titol={doc.titol} zoom={zoom} />)}
        </div>
        {anullant ? (
          <div className="formulari">
            <Camp etiqueta={d.motiuAnullar}>
              <input value={motiu} autoFocus onChange={(e) => setMotiu(e.target.value)} />
            </Camp>
            <div className="accions accions-esquerra">
              <Boto disabled={!motiu.trim()} onClick={() => void magatzem.anullarDocument(doc.id, motiu).then(onAnullat)}>
                {d.confirmarAnullar}
              </Boto>
              <Boto variant="discret" onClick={() => setAnullant(false)}>
                {t.app.cancellar}
              </Boto>
            </div>
          </div>
        ) : (
          <div className="accions accions-esquerra">
            <Boto
              variant="secundari"
              disabled={!bytes}
              onClick={() => {
                if (bytes && window.confirm(d.avisDescarrega)) descarregar(bytes, doc)
              }}
            >
              {d.descarregar}
            </Boto>
            <Boto variant="discret" onClick={() => setAnullant(true)}>
              {d.anullar}
            </Boto>
          </div>
        )}
      </section>
    </div>
  )
}
