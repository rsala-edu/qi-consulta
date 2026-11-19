// Afegir documents (etapa 4E). Dues entrades, sempre visibles:
// - «Fotografiar document»: la càmera de l'app (la foto no passa per la
//   galeria), una foto per pàgina; abans de desar, es poden reordenar, girar i
//   treure. Es desa com un sol PDF. Si la càmera de l'app no funciona (sense
//   permís o sense càmera), la càmera del sistema o un fitxer: mai un error sense sortida.
// - «Pujar fitxer»: un o diversos fitxers (PDF i imatges, també HEIC), o
//   arrossegant-los (al PC). Amb diverses imatges: «Un sol document (pàgines)»
//   o «Documents separats».
// Després, el formulari comú: tipus, títol, data del document, nota i vincle.
// Si alguna imatge ve d'un fitxer (la galeria del mòbil), en desar es recorda
// d'esborrar-la de la galeria.

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Boto } from '../components/Boto'
import { Camp } from '../components/Camp'
import { moure, titolDeFitxer, TIPUS_DOCUMENT, type DadesDocument, type TipusDocument } from '../domini/document'
import { araIso } from '../domini/registre'
import { urlJpeg } from '../fotos/processar'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'
import { prepararImatge } from '../fotos/processar'
import { comprovarFitxer, ErrorFitxer, girar, infoPdf, OPCIONS_IMATGE, pdfDeImatges, prepararPagina, type PaginaPreparada } from './processar'

const d = t.documents

/** On es poden vincular els documents nous */
export interface ContextDocuments {
  pacientId: string
  /** Episodi per defecte (l'actiu, o el de la visita) */
  episodiId: string | null
  /** Els episodis que es poden triar (a la fitxa); a la visita, cap: és el de la visita */
  episodis?: readonly { id: string; nom: string }[]
  /** Vincles que es poden triar (a la visita: la sessió i la valoració) */
  vincles?: readonly { valor: string; text: string }[]
  /** Vincle per defecte («sessio:<id>», «valoracio:<id>» o «») */
  vinclePerDefecte?: string
}

/** Un fitxer triat, ja comprovat */
export interface FitxerTriat {
  fitxer: File
  classe: 'pdf' | 'imatge' | 'heic'
}

const avui = () => {
  const a = new Date()
  return `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, '0')}-${String(a.getDate()).padStart(2, '0')}`
}

/** Comprova els fitxers (mida i tipus): els bons i els missatges dels que no */
export async function triarFitxers(llista: Iterable<File>): Promise<{ bons: FitxerTriat[]; errors: string[] }> {
  const bons: FitxerTriat[] = []
  const errors: string[] = []
  for (const fitxer of llista) {
    try {
      bons.push({ fitxer, classe: await comprovarFitxer(fitxer) })
    } catch (e) {
      errors.push(e instanceof ErrorFitxer ? e.message : formatar(d.errorLlegir, { nom: fitxer.name }))
    }
  }
  return { bons, errors }
}

/** Els botons «Fotografiar document» i «Pujar fitxer» (i la zona per arrossegar, al PC) */
export function AfegirDocuments({ context, onDesats }: { context: ContextDocuments; onDesats(): void }) {
  const [escanejant, setEscanejant] = useState(false)
  const [triats, setTriats] = useState<FitxerTriat[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [sobre, setSobre] = useState(false)
  const [avisGaleria, setAvisGaleria] = useState(false)
  const [desat, setDesat] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)

  const rebre = async (fitxers: Iterable<File>) => {
    const { bons, errors } = await triarFitxers(fitxers)
    setErrors(errors)
    if (bons.length > 0) setTriats(bons)
  }
  const deixar = (e: DragEvent) => {
    e.preventDefault()
    setSobre(false)
    if (e.dataTransfer.files.length) void rebre([...e.dataTransfer.files])
  }
  const acabat = (n: number, galeria: boolean) => {
    setEscanejant(false)
    setTriats(null)
    setDesat(n === 1 ? d.desat : formatar(d.desats, { n: String(n) }))
    setAvisGaleria(galeria)
    onDesats()
  }

  return (
    <div
      className={`afegir-documents${sobre ? ' sobre' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={deixar}
    >
      <div className="accions accions-esquerra">
        <Boto onClick={() => setEscanejant(true)}>{d.fotografiar}</Boto>
        <Boto variant="secundari" onClick={() => entrada.current?.click()}>
          {d.pujar}
        </Boto>
        <input
          ref={entrada}
          type="file"
          multiple
          accept="application/pdf,image/*,.heic,.heif"
          className="sr-only"
          aria-label={d.pujar}
          tabIndex={-1}
          onChange={(e) => {
            const fitxers = [...(e.target.files ?? [])]
            e.target.value = ''
            void rebre(fitxers)
          }}
        />
        <span className="detall nomes-punter">{sobre ? d.deixaAnar : d.arrossega}</span>
      </div>
      {errors.length > 0 && (
        <ul className="errors-fitxers" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {desat && !avisGaleria && (
        <p className="avis-suau" role="status">
          {desat}
        </p>
      )}
      {avisGaleria && (
        <div className="avis-suau avis-galeria" role="status">
          <p>
            {desat} {d.avisGaleria}
          </p>
          <Boto variant="discret" onClick={() => (setAvisGaleria(false), setDesat(null))}>
            {d.entesos}
          </Boto>
        </div>
      )}
      {escanejant && <Escanejar context={context} onCancellar={() => setEscanejant(false)} onDesat={(galeria) => acabat(1, galeria)} />}
      {triats && <DesarFitxers context={context} triats={triats} onCancellar={() => setTriats(null)} onDesats={(n) => acabat(n, triats.some((x) => x.classe !== 'pdf'))} />}
    </div>
  )
}

// --- Escanejar ----------------------------------------------------------------

interface Pagina {
  id: string
  img: PaginaPreparada
  url: string
  /** Ve d'un fitxer o de la càmera del sistema (pot ser a la galeria) */
  deFitxer: boolean
}

function Escanejar({ context, onCancellar, onDesat }: { context: ContextDocuments; onCancellar(): void; onDesat(galeria: boolean): void }) {
  const desarUn = useDesarUn(context)
  const video = useRef<HTMLVideoElement>(null)
  const [senseCamera, setSenseCamera] = useState(() => !navigator.mediaDevices?.getUserMedia)
  const [pagines, setPagines] = useState<Pagina[]>([])
  const [preparant, setPreparant] = useState(false)
  const [formulari, setFormulari] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // La càmera de l'app (la del darrere); s'atura en sortir o en passar al formulari
  useEffect(() => {
    if (formulari || senseCamera) return
    let flux: MediaStream | null = null
    let viu = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 2560 } }, audio: false })
      .then((s) => {
        if (!viu) return s.getTracks().forEach((x) => x.stop())
        flux = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play().catch(() => {})
        }
      })
      .catch(() => viu && setSenseCamera(true))
    return () => {
      viu = false
      flux?.getTracks().forEach((x) => x.stop())
    }
  }, [formulari, senseCamera])
  // Les URL de les miniatures, fora en tancar
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const afegir = async (origen: Blob | HTMLVideoElement, deFitxer: boolean) => {
    setPreparant(true)
    setError(null)
    try {
      let img: PaginaPreparada
      if (origen instanceof Blob) {
        const classe = await comprovarFitxer(origen as File)
        if (classe === 'pdf') throw new ErrorFitxer(formatar(d.formatNoAdmes, { nom: (origen as File).name }))
        img = await prepararPagina(origen, classe === 'heic')
      } else img = await prepararImatge(origen, OPCIONS_IMATGE)
      const url = urlJpeg(img.jpeg)
      urls.current.push(url)
      setPagines((p) => [...p, { id: crypto.randomUUID(), img, url, deFitxer }])
    } catch (e) {
      setError(e instanceof ErrorFitxer ? e.message : formatar(d.errorLlegir, { nom: origen instanceof File ? origen.name : t.fotos.camera }))
    } finally {
      setPreparant(false)
    }
  }
  const girarPagina = async (i: number) => {
    const p = pagines[i]!
    const img = await girar(p.img)
    const url = urlJpeg(img.jpeg)
    urls.current.push(url)
    setPagines((ps) => ps.map((x, j) => (j === i ? { ...x, img, url } : x)))
  }

  const entradaFitxer = (capture: boolean, text: string, principal = false) => (
    <label className={`boto ${principal ? 'boto-principal' : 'boto-secundari'} triar-fitxer`}>
      {text}
      <input
        type="file"
        accept="image/*,.heic,.heif"
        {...(capture ? { capture: 'environment' as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void afegir(f, true)
        }}
      />
    </label>
  )

  return (
    <div className="fons-dialeg">
      <section className="dialeg dialeg-escanejar" role="dialog" aria-modal="true" aria-label={d.escanejar}>
        <h2>{d.escanejar}</h2>
        {!formulari ? (
          <>
            {senseCamera ? (
              <p className="avis-suau" role="note">
                {d.senseCamera}
              </p>
            ) : (
              <video ref={video} className="video-camera" playsInline muted aria-label={t.fotos.camera} />
            )}
            <div className="accions accions-esquerra">
              {!senseCamera && (
                <Boto disabled={preparant} onClick={() => video.current && void afegir(video.current, false)}>
                  {preparant ? d.capturant : d.capturar}
                </Boto>
              )}
              {/* Alternatives sempre visibles: la càmera del sistema i un fitxer */}
              {entradaFitxer(true, d.cameraSistema, senseCamera)}
              {entradaFitxer(false, d.afegirDeFitxer)}
            </div>
            {error && <p role="alert">{error}</p>}
            <h3>
              {d.pagines} ({pagines.length})
            </h3>
            {pagines.length === 0 ? (
              <p className="detall">{d.capPagina}</p>
            ) : (
              <ol className="pagines-escanejades" aria-label={d.pagines}>
                {pagines.map((p, i) => (
                  <li key={p.id} aria-label={formatar(d.pagina, { n: String(i + 1) })}>
                    <img src={p.url} alt={formatar(d.pagina, { n: String(i + 1) })} data-amplada={p.img.amplada} data-alcada={p.img.alcada} />
                    <span className="numero-pagina">{i + 1}</span>
                    <div className="accions-pagina">
                      <Boto variant="discret" aria-label={d.pujarPagina} title={d.pujarPagina} disabled={i === 0} onClick={() => setPagines((ps) => moure(ps, i, i - 1))}>
                        ↑
                      </Boto>
                      <Boto variant="discret" aria-label={d.baixarPagina} title={d.baixarPagina} disabled={i === pagines.length - 1} onClick={() => setPagines((ps) => moure(ps, i, i + 1))}>
                        ↓
                      </Boto>
                      <Boto variant="discret" aria-label={d.girarPagina} title={d.girarPagina} onClick={() => void girarPagina(i)}>
                        ⟳
                      </Boto>
                      <Boto variant="discret" aria-label={d.treurePagina} title={d.treurePagina} onClick={() => setPagines((ps) => ps.filter((x) => x.id !== p.id))}>
                        ✕
                      </Boto>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="accions accions-esquerra">
              <Boto disabled={pagines.length === 0 || preparant} onClick={() => setFormulari(true)}>
                {d.continuar}
              </Boto>
              <Boto variant="discret" onClick={onCancellar}>
                {t.app.cancellar}
              </Boto>
            </div>
          </>
        ) : (
          <FormulariDocument
            context={context}
            titolInicial=""
            onCancellar={() => setFormulari(false)}
            onDesar={async (meta) => {
              const bytes = await pdfDeImatges(
                pagines.map((p) => p.img),
                meta.titol,
              )
              const info = await infoPdf(bytes)
              await desarUn(meta, bytes, { format: 'pdf', pagines: pagines.length, miniatura: info.miniatura || pagines[0]!.img.miniatura, origen: 'camera' })
              onDesat(pagines.some((p) => p.deFitxer))
            }}
          />
        )}
      </section>
    </div>
  )
}

// --- Fitxers triats o arrossegats -----------------------------------------------

/** Desar els fitxers triats: amb diverses imatges, un sol document o un per imatge */
export function DesarFitxers({
  context,
  triats,
  origen = 'fitxer',
  onCancellar,
  onDesats,
}: {
  context: ContextDocuments
  triats: readonly FitxerTriat[]
  origen?: 'fitxer' | 'compartit'
  onCancellar(): void
  onDesats(n: number): void
}) {
  const desarUn = useDesarUn(context)
  const imatges = triats.filter((x) => x.classe !== 'pdf')
  const pdfs = triats.filter((x) => x.classe === 'pdf')
  const [unSol, setUnSol] = useState(true)
  const docsSeparats = (imatges.length > 1 && !unSol ? imatges.length : imatges.length > 0 ? 1 : 0) + pdfs.length
  return (
    <div className="fons-dialeg">
      <section className="dialeg dialeg-escanejar" role="dialog" aria-modal="true" aria-label={docsSeparats === 1 ? d.nouDocument : formatar(d.nousDocuments, { n: String(docsSeparats) })}>
        <h2>{docsSeparats === 1 ? d.nouDocument : formatar(d.nousDocuments, { n: String(docsSeparats) })}</h2>
        <ul className="fitxers-triats" aria-label={d.fitxersTriats}>
          {triats.map((x) => (
            <li key={x.fitxer.name + x.fitxer.size}>{x.fitxer.name}</li>
          ))}
        </ul>
        {imatges.length > 1 && (
          <fieldset className="opcions-incidencies">
            <legend>{d.comDesar}</legend>
            <div className="opcions-en-fila">
              <label className="casella">
                <input type="radio" name="com-desar" checked={unSol} onChange={() => setUnSol(true)} />
                {d.unSol}
              </label>
              <label className="casella">
                <input type="radio" name="com-desar" checked={!unSol} onChange={() => setUnSol(false)} />
                {d.separats}
              </label>
            </div>
          </fieldset>
        )}
        <FormulariDocument
          context={context}
          titolInicial={docsSeparats === 1 ? titolDeFitxer(triats[0]!.fitxer.name) : ''}
          ambTitol={docsSeparats === 1}
          onCancellar={onCancellar}
          onDesar={async (meta) => {
            let n = 0
            const titol = (f: File) => (docsSeparats === 1 ? meta.titol : titolDeFitxer(f.name) || meta.titol || d.tipus[meta.tipus])
            for (const x of pdfs) {
              const bytes = new Uint8Array(await x.fitxer.arrayBuffer())
              const info = await infoPdf(bytes)
              await desarUn({ ...meta, titol: titol(x.fitxer) }, bytes, { format: 'pdf', pagines: info.pagines, miniatura: info.miniatura, origen })
              n++
            }
            if (imatges.length > 1 && unSol) {
              const pagines = []
              for (const x of imatges) pagines.push(await prepararPagina(x.fitxer, x.classe === 'heic'))
              const bytes = await pdfDeImatges(pagines, meta.titol)
              await desarUn(meta.titol ? meta : { ...meta, titol: titol(imatges[0]!.fitxer) }, bytes, {
                format: 'pdf',
                pagines: pagines.length,
                miniatura: pagines[0]!.miniatura,
                origen,
              })
              n++
            } else {
              for (const x of imatges) {
                const p = await prepararPagina(x.fitxer, x.classe === 'heic')
                await desarUn({ ...meta, titol: titol(x.fitxer) }, p.jpeg, { format: 'jpeg', pagines: 1, miniatura: p.miniatura, origen })
                n++
              }
            }
            onDesats(n)
          }}
        />
      </section>
    </div>
  )
}

// --- Formulari comú -------------------------------------------------------------

interface Meta {
  tipus: TipusDocument
  titol: string
  data: string
  nota: string
  episodiId: string | null
  vincle: string
}

type DesarUn = (meta: Meta, bytes: Uint8Array, fitxer: Pick<DadesDocument, 'format' | 'pagines' | 'miniatura' | 'origen'>) => Promise<void>

/** Desa un document al pacient del context, amb el vincle triat */
function useDesarUn(context: ContextDocuments): DesarUn {
  const magatzem = useMagatzem()
  return async (meta, bytes, fitxer) => {
    const [tipusVincle, idVincle] = meta.vincle.split(':')
    await magatzem.afegirDocument(
      context.pacientId,
      {
        tipus: meta.tipus,
        titol: meta.titol || d.tipus[meta.tipus],
        data: meta.data,
        nota: meta.nota.trim(),
        episodiId: meta.episodiId,
        sessioId: tipusVincle === 'sessio' ? idVincle! : null,
        valoracioId: tipusVincle === 'valoracio' ? idVincle! : null,
        mida: bytes.length,
        afegitAt: araIso(),
        anullat: null,
        ...fitxer,
      },
      bytes,
    )
  }
}

function FormulariDocument({
  context,
  titolInicial,
  ambTitol = true,
  onCancellar,
  onDesar,
}: {
  context: ContextDocuments
  titolInicial: string
  ambTitol?: boolean
  onCancellar(): void
  onDesar(meta: Meta): Promise<void>
}) {
  const [meta, setMeta] = useState<Meta>({
    tipus: 'informe',
    titol: titolInicial,
    data: avui(),
    nota: '',
    episodiId: context.episodiId,
    vincle: context.vinclePerDefecte ?? '',
  })
  const [desant, setDesant] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canviar = (c: Partial<Meta>) => setMeta((m) => ({ ...m, ...c }))
  const potDesar = !desant && (!ambTitol || meta.titol.trim() !== '') && /^\d{4}-\d{2}-\d{2}$/.test(meta.data)
  return (
    <form
      className="formulari formulari-document"
      onSubmit={(e) => {
        e.preventDefault()
        if (!potDesar) return
        setDesant(true)
        setError(null)
        onDesar({ ...meta, titol: meta.titol.trim() })
          .catch(() => setError(t.app.errorInesperat))
          .finally(() => setDesant(false))
      }}
    >
      <Camp etiqueta={d.tipusCamp}>
        <select
          value={meta.tipus}
          onChange={(e) => {
            const tipus = e.target.value as TipusDocument
            // Sense títol escrit, el del tipus
            canviar({ tipus, titol: !meta.titol.trim() || TIPUS_DOCUMENT.some((x) => d.tipus[x] === meta.titol) ? d.tipus[tipus] : meta.titol })
          }}
        >
          {TIPUS_DOCUMENT.map((x) => (
            <option key={x} value={x}>
              {d.tipus[x]}
            </option>
          ))}
        </select>
      </Camp>
      {ambTitol ? (
        <Camp etiqueta={d.titolCamp}>
          <input value={meta.titol} onChange={(e) => canviar({ titol: e.target.value })} />
        </Camp>
      ) : (
        <p className="detall">{d.titolsDeFitxer}</p>
      )}
      <Camp etiqueta={d.dataCamp}>
        <input type="date" value={meta.data} onChange={(e) => canviar({ data: e.target.value })} />
      </Camp>
      {context.episodis && (
        <Camp etiqueta={d.episodi}>
          <select value={meta.episodiId ?? ''} onChange={(e) => canviar({ episodiId: e.target.value || null })}>
            <option value="">{d.capEpisodi}</option>
            {context.episodis.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </Camp>
      )}
      {context.vincles && context.vincles.length > 0 && (
        <Camp etiqueta={d.vincle}>
          <select value={meta.vincle} onChange={(e) => canviar({ vincle: e.target.value })}>
            <option value="">{d.capVincle}</option>
            {context.vincles.map((v) => (
              <option key={v.valor} value={v.valor}>
                {v.text}
              </option>
            ))}
          </select>
        </Camp>
      )}
      <Camp etiqueta={d.nota}>
        <textarea rows={2} value={meta.nota} onChange={(e) => canviar({ nota: e.target.value })} />
      </Camp>
      {error && <p role="alert">{error}</p>}
      <div className="accions accions-esquerra">
        <Boto type="submit" disabled={!potDesar}>
          {desant ? d.desant : d.desar}
        </Boto>
        <Boto variant="discret" onClick={onCancellar}>
          {t.app.cancellar}
        </Boto>
      </div>
    </form>
  )
}

