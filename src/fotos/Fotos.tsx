// Fotos clíniques (etapa 4C): fer una foto amb la càmera de l'app (la foto no
// passa per la galeria del dispositiu; si no hi ha càmera, es tria un fitxer),
// la galeria amb «Comparar» (dues al costat, abans i després) i el visor, que
// baixa la imatge de Drive si cal. Esborrar demana el motiu i queda registrat.
// Sense el consentiment d'imatges vigent no es pot fer cap foto.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Boto } from '../components/Boto'
import { Camp } from '../components/Camp'
import { estatDelTipus } from '../domini/consentiment'
import { visibles, ZONES_FOTO, type Foto, type ZonaFoto } from '../domini/foto'
import { araIso } from '../domini/registre'
import { formatar, t } from '../i18n/t'
import { useMagatzem } from '../sessio/ContextSessio'
import { useSincronia } from '../sincronia/ContextSincronia'
import { baixarImatge, esborrarImatgeDrive } from './driveImatges'
import { prepararImatge, urlJpeg, type ImatgePreparada } from './processar'

const f = t.fotos
const quan = (iso: string) => new Date(iso).toLocaleString('ca', { dateStyle: 'medium', timeStyle: 'short' })

/** «Fer una foto», o l'avís i «Signar-lo ara» si no hi ha el consentiment d'imatges vigent */
export function BotoFerFoto({
  pacientId,
  episodiId,
  sessioId,
  tornar,
  onDesada,
}: {
  pacientId: string
  episodiId: string | null
  sessioId: string | null
  /** On tornar després de signar el consentiment */
  tornar: string
  onDesada(): void
}) {
  const magatzem = useMagatzem()
  const [estat, setEstat] = useState<'tancat' | 'comprovant' | 'sense' | 'camera'>('tancat')
  const obrir = async () => {
    setEstat('comprovant')
    const c = await magatzem.consentimentsDe(pacientId)
    setEstat(estatDelTipus(c, 'imatges') === 'vigent' ? 'camera' : 'sense')
  }
  return (
    <>
      <Boto onClick={() => void obrir()} disabled={estat === 'comprovant'}>
        {f.ferFoto}
      </Boto>
      {estat === 'sense' && (
        <div className="avis-sense-imatges" role="alert">
          <p>{f.senseConsentiment}</p>
          <Link className="boto boto-secundari" to={`/pacients/${pacientId}/consentiments/imatges/signar?tornar=${encodeURIComponent(tornar)}`}>
            {f.signarAra}
          </Link>
        </div>
      )}
      {estat === 'camera' && (
        <FerFoto
          onCancellar={() => setEstat('tancat')}
          onDesar={async (img, zona, nota) => {
            await magatzem.afegirFoto(
              pacientId,
              { episodiId, sessioId, zona, nota, presaAt: araIso(), amplada: img.amplada, alcada: img.alcada, mida: img.jpeg.length, miniatura: img.miniatura, esborrada: null },
              img.jpeg,
            )
            setEstat('tancat')
            onDesada()
          }}
        />
      )}
    </>
  )
}

function FerFoto({ onCancellar, onDesar }: { onCancellar(): void; onDesar(img: ImatgePreparada, zona: ZonaFoto | null, nota: string): Promise<void> }) {
  const video = useRef<HTMLVideoElement>(null)
  const [senseCamera, setSenseCamera] = useState(() => !navigator.mediaDevices?.getUserMedia)
  const [img, setImg] = useState<ImatgePreparada | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [zona, setZona] = useState<ZonaFoto | ''>('')
  const [nota, setNota] = useState('')
  const [preparant, setPreparant] = useState(false)

  // La càmera de l'app (la del darrere si n'hi ha); s'atura en sortir o en fer la foto
  useEffect(() => {
    if (img) return
    let flux: MediaStream | null = null
    let viu = true
    if (!navigator.mediaDevices?.getUserMedia) return
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
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
  }, [img])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  const preparar = async (origen: Blob | HTMLVideoElement) => {
    setPreparant(true)
    try {
      const p = await prepararImatge(origen)
      setImg(p)
      setUrl(urlJpeg(p.jpeg))
    } finally {
      setPreparant(false)
    }
  }

  return (
    <div className="fons-dialeg">
      <section className="dialeg dialeg-foto" role="dialog" aria-modal="true" aria-label={f.camera}>
        <h2>{f.camera}</h2>
        <p className="detall">{f.privacitat}</p>
        {!img ? (
          <>
            {senseCamera ? <p className="avis-suau">{f.senseCamera}</p> : <video ref={video} className="video-camera" playsInline muted aria-label={f.camera} />}
            <div className="accions accions-esquerra">
              {!senseCamera && (
                <Boto disabled={preparant} onClick={() => video.current && void preparar(video.current)}>
                  {preparant ? f.desant : f.capturar}
                </Boto>
              )}
              <label className="boto boto-secundari triar-fitxer">
                {f.triarFitxer}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void preparar(e.target.files[0])} />
              </label>
              <Boto variant="discret" onClick={onCancellar}>
                {t.app.cancellar}
              </Boto>
            </div>
          </>
        ) : (
          <>
            {url && <img className="previsualitzacio-foto" src={url} alt={f.camera} data-amplada={img.amplada} data-alcada={img.alcada} />}
            <Camp etiqueta={f.zona}>
              <select value={zona} onChange={(e) => setZona(e.target.value as ZonaFoto | '')}>
                <option value="">{f.capZona}</option>
                {ZONES_FOTO.map((z) => (
                  <option key={z} value={z}>
                    {f.zones[z]}
                  </option>
                ))}
              </select>
            </Camp>
            <Camp etiqueta={f.nota}>
              <textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Camp>
            <div className="accions accions-esquerra">
              <Boto onClick={() => void onDesar(img, zona || null, nota.trim())}>{f.desar}</Boto>
              <Boto variant="secundari" onClick={() => setImg(null)}>
                {f.tornarAFer}
              </Boto>
              <Boto variant="discret" onClick={onCancellar}>
                {t.app.cancellar}
              </Boto>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** La imatge sencera: del dispositiu o, si no hi és, de Drive (i es desa per a la propera vegada) */
function useImatge(id: string): { url: string | null; estat: 'carregant' | 'llest' | 'no' } {
  const magatzem = useMagatzem()
  const { driveImatges } = useSincronia()
  const [r, setR] = useState<{ url: string | null; estat: 'carregant' | 'llest' | 'no' }>({ url: null, estat: 'carregant' })
  useEffect(() => {
    let viu = true
    let url: string | null = null
    void (async () => {
      let jpeg = await magatzem.imatgeDe(id)
      if (!jpeg) {
        const d = driveImatges()
        const text = d ? await baixarImatge(d, id).catch(() => null) : null
        if (text) {
          await magatzem.desarImatgeBaixada(id, text)
          jpeg = await magatzem.imatgeDe(id)
        }
      }
      if (!viu) return
      url = jpeg ? urlJpeg(jpeg) : null
      setR({ url, estat: jpeg ? 'llest' : 'no' })
    })()
    return () => {
      viu = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, magatzem, driveImatges])
  return r
}

function ImatgeFoto({ foto, titol }: { foto: Foto; titol?: ReactNode }) {
  const { url, estat } = useImatge(foto.id)
  return (
    <figure className="imatge-foto">
      {estat === 'llest' && url ? (
        <img src={url} alt={formatar(f.fotoDe, { zona: foto.zona ? f.zones[foto.zona] : '', quan: quan(foto.presaAt) })} />
      ) : (
        <div className="imatge-pendent">
          <img src={foto.miniatura} alt="" aria-hidden="true" />
          <p className="detall">{estat === 'carregant' ? f.obrint : f.noDisponible}</p>
        </div>
      )}
      <figcaption>
        {titol}
        {foto.zona ? `${f.zones[foto.zona]} · ` : ''}
        {quan(foto.presaAt)}
        {foto.nota && <span className="detall"> · {foto.nota}</span>}
      </figcaption>
    </figure>
  )
}

/** Galeria (miniatures), «Comparar» i el visor amb «Esborrar»; les esborrades, a part (registre) */
export function GaleriaFotos({ fotos, numeroSessio, onCanvi }: { fotos: readonly Foto[]; numeroSessio?: (sessioId: string) => number | undefined; onCanvi(): void }) {
  const magatzem = useMagatzem()
  const { driveImatges } = useSincronia()
  const [oberta, setOberta] = useState<Foto | null>(null)
  const [comparant, setComparant] = useState(false)
  const [triades, setTriades] = useState<Foto[]>([])
  const [esborrant, setEsborrant] = useState(false)
  const [motiu, setMotiu] = useState('')
  const llista = visibles(fotos)
  const esborrades = fotos.filter((x) => x.esborrada)

  if (llista.length === 0 && esborrades.length === 0) return <p className="detall">{f.capFoto}</p>
  const tocar = (x: Foto) => {
    if (!comparant) return setOberta(x)
    setTriades((t) => (t.includes(x) ? t.filter((y) => y !== x) : [...t, x].slice(-2)))
  }
  // Per comparar: la més antiga, «abans»
  const parell = [...triades].sort((a, b) => a.presaAt.localeCompare(b.presaAt))

  return (
    <div className="galeria-fotos">
      {llista.length > 1 && (
        <div className="accions accions-esquerra">
          <Boto variant="secundari" aria-pressed={comparant} onClick={() => (setComparant((c) => !c), setTriades([]))}>
            {comparant ? f.deixarDeComparar : f.comparar}
          </Boto>
          {comparant && <span className="detall">{f.triaDues}</span>}
        </div>
      )}
      <ul className="miniatures-fotos">
        {llista.map((x) => (
          <li key={x.id}>
            <button type="button" className="miniatura-foto" aria-pressed={comparant ? triades.includes(x) : undefined} onClick={() => tocar(x)}>
              <img src={x.miniatura} alt={formatar(f.fotoDe, { zona: x.zona ? f.zones[x.zona] : '', quan: quan(x.presaAt) })} />
              <span className="peu-miniatura">
                {x.zona ? f.zones[x.zona] : ''}
                {x.sessioId && numeroSessio?.(x.sessioId) ? ` · ${formatar(f.deSessio, { n: String(numeroSessio(x.sessioId)) })}` : ''}
                <span className="detall"> {new Date(x.presaAt).toLocaleDateString('ca')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {comparant && parell.length === 2 && (
        <div className="comparar-fotos" aria-label={f.comparar} role="group">
          <ImatgeFoto foto={parell[0]!} titol={<strong>{f.abans} · </strong>} />
          <ImatgeFoto foto={parell[1]!} titol={<strong>{f.despres} · </strong>} />
        </div>
      )}
      {esborrades.length > 0 && (
        <details className="fotos-esborrades">
          <summary>
            {f.esborrades} ({esborrades.length})
          </summary>
          <ul>
            {esborrades.map((x) => (
              <li key={x.id}>{formatar(f.esborradaEl, { quan: quan(x.esborrada!.at), motiu: x.esborrada!.motiu || '—' })}</li>
            ))}
          </ul>
        </details>
      )}

      {oberta && (
        <div className="fons-dialeg" onClick={(e) => e.target === e.currentTarget && setOberta(null)}>
          <section className="dialeg dialeg-foto" role="dialog" aria-modal="true" aria-label={f.titol}>
            <ImatgeFoto foto={oberta} />
            {esborrant ? (
              <div className="formulari">
                <Camp etiqueta={f.motiuEsborrar}>
                  <input value={motiu} autoFocus onChange={(e) => setMotiu(e.target.value)} />
                </Camp>
                <div className="accions accions-esquerra">
                  <Boto
                    onClick={() =>
                      void (async () => {
                        await magatzem.esborrarFoto(oberta.id, motiu)
                        const d = driveImatges()
                        if (d) await esborrarImatgeDrive(d, oberta.id).catch(() => {})
                        setOberta(null)
                        setEsborrant(false)
                        setMotiu('')
                        onCanvi()
                      })()
                    }
                  >
                    {f.confirmarEsborrar}
                  </Boto>
                  <Boto variant="discret" onClick={() => setEsborrant(false)}>
                    {t.app.cancellar}
                  </Boto>
                </div>
              </div>
            ) : (
              <div className="accions">
                <Boto variant="discret" onClick={() => setEsborrant(true)}>
                  {f.esborrar}
                </Boto>
                <Boto onClick={() => setOberta(null)}>{f.tancar}</Boto>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

/** A la visita (pestanya Exploració): fer fotos de la sessió i veure-les */
export function FotosSessio({ pacientId, episodiId, sessioId }: { pacientId: string; episodiId: string; sessioId: string }) {
  const magatzem = useMagatzem()
  const [versio, setVersio] = useState(0)
  const [fotos, setFotos] = useState<Foto[]>([])
  useEffect(() => {
    let viu = true
    void magatzem.fotosDe(pacientId).then((x) => viu && setFotos(x.filter((y) => y.sessioId === sessioId)))
    return () => {
      viu = false
    }
  }, [magatzem, pacientId, sessioId, versio])
  return (
    <section className="fotos-sessio" aria-label={f.titol}>
      <div className="capcalera-fotos-sessio">
        <h2>{f.titol}</h2>
        <BotoFerFoto pacientId={pacientId} episodiId={episodiId} sessioId={sessioId} tornar={`/visita/${sessioId}`} onDesada={() => setVersio((n) => n + 1)} />
      </div>
      {fotos.length > 0 && <GaleriaFotos fotos={fotos} onCanvi={() => setVersio((n) => n + 1)} />}
    </section>
  )
}
