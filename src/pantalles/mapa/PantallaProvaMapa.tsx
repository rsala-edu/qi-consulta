// Pantalla de prova del marcatge de punts (etapa 2d). No desa res: quan
// tinguem les sessions, aquest mateix flux anirà dins la pantalla de sessió.

import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import {
  COLOR_TECNICA,
  COSTATS_MARCAT,
  desmarcar,
  marcar,
  nouPuntMarcat,
  puntMarcat,
  tecnicaDelMarcador,
  TECNIQUES_DEL_MAPA,
  type CostatMarcat,
  type Mapa,
  type PuntMarcat,
  type Tecnica,
} from '../../domini/puntMarcat'
import { formatar, t } from '../../i18n/t'
import { BarraVistes } from '../../mapa/components/BarraVistes'
import { Visor2D } from '../../mapa/components/Visor2D'
import { desarMode, modeInicial, type ModeMapa } from '../../mapa/modeMapa'
import { ErrorCos3D, Visor3D, type ControlVisor, type MarcadorVisor, type TocPell } from '../../mapa/components/Visor3D'
import { posicio3D, posicioDesDePunt } from '../../mapa/geometria/baricentriques'
import { etiquetesDelPunt } from '../../mapa/etiquetaPunt'
import { idMarcador, llegirIdMarcador, puntsSobreModel, recorregutsMeridia } from '../../mapa/marcadors'
import type { ModelCos } from '../../mapa/model'
import { useCalibracions } from '../../mapa/useCalibracions'
import { notaSenseCategoria } from '../../mapa/precaucio'
import { usePrecaucions } from '../../mapa/usePrecaucions'
import { useModelCos } from '../../mapa/useModelCos'
import { REVISIO_BUIDA, ambPrecaucions, cataleg, cercarPunts, costatsDe, nomMeridia, posicioDe } from '../../punts/cataleg'
import type { CostatPosicio } from '../../punts/esquema'
import { LlistaMarcats } from './LlistaMarcats'
import { PanellLateral, type PestanyaPanell } from './PanellLateral'
import { nomAmple } from './tecniques'
import { MarcatgeOrella } from './MarcatgeOrella'

const TECNIQUES = TECNIQUES_DEL_MAPA.cos

/** Punt que una pestanya ha de mostrar (des de la llista de marcats); `n` fa que es repeteixi */
type Peticio = { codi: string; n: number } | null

export function PantallaProvaMapa() {
  // Els punts del cos i de l'orella van junts, com a la sessió
  const [marcats, setMarcats] = useState<PuntMarcat[]>([])
  return (
    <main className="pantalla-mapa">
      <MapaTractament
        titol={<h1>{t.mapa.titolProva}</h1>}
        avis={<p className="avis">{t.mapa.avisProva}</p>}
        marcats={marcats}
        setMarcats={setMarcats}
      />
    </main>
  )
}

/**
 * El mapa (cos 3D i orella) amb la llista de punts marcats. El fan servir la
 * pantalla Mapa (punts en memòria) i la pestanya Tractament de la visita
 * (punts desats a la sessió).
 */
export function MapaTractament({
  titol,
  avis,
  marcats,
  setMarcats,
}: {
  titol?: ReactNode
  avis?: ReactNode
  marcats: PuntMarcat[]
  setMarcats: Dispatch<SetStateAction<PuntMarcat[]>>
}) {
  const carrega = useModelCos()
  const [pestanya, setPestanya] = useState<Mapa>('cos')
  const [peticions, setPeticions] = useState<Record<Mapa, Peticio>>({ cos: null, orella: null })
  const veure = (m: PuntMarcat) => {
    setPestanya(m.mapa)
    setPeticions((p) => ({ ...p, [m.mapa]: { codi: m.codi, n: (p[m.mapa]?.n ?? 0) + 1 } }))
  }

  return (
    <>
      <div className="capcalera-mapa">
        {titol}
        <div className="segmentat pestanyes-mapa" role="tablist" aria-label={t.mapa.quinMapa}>
          {(['cos', 'orella'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`pestanya-${m}`}
              aria-controls={`mapa-${m}`}
              aria-selected={pestanya === m}
              onClick={() => setPestanya(m)}
            >
              {m === 'cos' ? t.mapa.pestanyaCos : t.orella.titol}
            </button>
          ))}
        </div>
        {avis}
      </div>
      {/* El cos es queda muntat (i carregat) quan es mira l'orella */}
      <div id="mapa-cos" role="tabpanel" aria-labelledby="pestanya-cos" className="panell-pestanya" hidden={pestanya !== 'cos'}>
        {/* El cercador i la llista funcionen encara que el cos no es pugui carregar */}
        <Marcatge
          model={carrega.estat === 'llest' ? carrega.dades : null}
          carregant={carrega.estat === 'carregant'}
          marcats={marcats}
          setMarcats={setMarcats}
          peticio={peticions.cos}
          onVeure={veure}
        />
      </div>
      {pestanya === 'orella' && (
        <div id="mapa-orella" role="tabpanel" aria-labelledby="pestanya-orella" className="panell-pestanya">
          <MarcatgeOrella marcats={marcats} setMarcats={setMarcats} peticio={peticions.orella} onVeure={veure} />
        </div>
      )}
    </>
  )
}

interface FitxaOberta {
  codi: string
  costat: CostatMarcat
  tecnica: Tecnica
  /** El marcador que s'ha tocat (per corregir-ne la posició) */
  tocat: { costat: CostatPosicio; index: number }
}

/** Punt (i costat i subpunt) que la doctora està corregint */
interface Correccio {
  codi: string
  costat: CostatPosicio
  index: number
}

interface PropsMarcatge {
  /** null mentre es carrega o si no s'ha pogut carregar */
  model: ModelCos | null
  carregant: boolean
  marcats: PuntMarcat[]
  setMarcats: Dispatch<SetStateAction<PuntMarcat[]>>
  peticio: Peticio
  onVeure(m: PuntMarcat): void
}

function Marcatge({ model, carregant, marcats, setMarcats, peticio, onVeure }: PropsMarcatge) {
  const visor = useRef<ControlVisor>(null)
  const { efectiu: calibrat, desar, restablir } = useCalibracions(model?.topologia ?? '')
  const { revisio } = usePrecaucions()
  const efectiu = useMemo(() => ambPrecaucions(calibrat, revisio ?? REVISIO_BUIDA), [calibrat, revisio])
  const [correccio, setCorreccio] = useState<Correccio | null>(null)
  const [meridia, setMeridia] = useState('')
  const [consulta, setConsulta] = useState('')
  const [fitxa, setFitxa] = useState<FitxaOberta | null>(null)
  const [mode, setModeEstat] = useState<ModeMapa>(modeInicial)
  const setMode = (m: ModeMapa) => {
    setModeEstat(m)
    desarMode(m)
    // La correcció de posicions només es fa en 3D
    if (m === '2d') setCorreccio(null)
  }

  const tots = useMemo(() => (model ? puntsSobreModel(efectiu, model) : []), [efectiu, model])
  const visibles = useMemo(() => (meridia ? tots.filter((p) => p.punt.meridia === meridia) : tots), [tots, meridia])
  const recorreguts = useMemo(
    () =>
      meridia ? recorregutsMeridia(tots, meridia, cataleg.meridians.find((m) => m.codi === meridia)?.recorregut) : [],
    [tots, meridia],
  )

  const marcadors: MarcadorVisor[] = useMemo(
    () =>
      visibles.map((p) => {
        const tecnica = tecnicaDelMarcador(marcats, p.punt.codi, p.costat)
        return {
          id: p.id,
          punt: p.posicio,
          normal: p.normal,
          color: tecnica && COLOR_TECNICA[tecnica],
          destacat: correccio ? p.id === idMarcador(correccio.codi, correccio.costat, correccio.index) : fitxa?.codi === p.punt.codi,
          etiquetes: etiquetesDelPunt(p.punt, p.index),
        }
      }),
    [visibles, marcats, fitxa?.codi, correccio],
  )

  function obrirFitxa(codi: string, costatTocat: CostatPosicio = 'E', index = 0) {
    const existent = puntMarcat(marcats, codi)
    const costat: CostatMarcat =
      existent?.costat ?? (costatTocat === 'E' || costatTocat === 'D' ? costatTocat : 'bilateral')
    setFitxa({ codi, costat, tecnica: existent?.tecnica ?? 'agulla', tocat: { costat: costatTocat, index } })
    // La fitxa és a la pestanya «Punt»
    setPestanyaPanell('punt')
  }

  function anarAlPunt(codi: string) {
    const p = tots.find((x) => x.punt.codi === codi)
    if (p) visor.current?.anarA(p.posicio, p.normal)
    obrirFitxa(codi, p?.costat, p?.index)
  }

  function corregir(punt: TocPell, immediat: boolean) {
    if (!correccio || !model) return
    const { codi, costat, index } = correccio
    const pos = posicioDesDePunt(model.geometria, punt.triangle, punt.punt)
    desar(codi, costat, posicio3D(model.topologia, costat, pos, 'doctora', index), immediat, index)
  }

  function començarCorreccio(c: Correccio) {
    setCorreccio(c)
    const p = tots.find((x) => x.id === idMarcador(c.codi, c.costat, c.index))
    if (p) visor.current?.anarA(p.posicio, p.normal)
  }

  const resultats = consulta.trim() ? cercarPunts(efectiu, consulta).slice(0, 8) : []
  const puntFitxa = efectiu.punts.find((p) => p.codi === (correccio?.codi ?? fitxa?.codi))
  const origenDe = (codi: string, costat: CostatPosicio, index = 0) => {
    const p = efectiu.punts.find((x) => x.codi === codi)
    return p && model ? posicioDe(p, model.topologia, costat, index)?.origen : undefined
  }
  const corregitPerLaDoctora = (codi: string) =>
    efectiu.punts
      .find((x) => x.codi === codi)
      ?.posicions.some((q) => q.topologia === model?.topologia && q.origen === 'doctora') ?? false
  const jaMarcat = fitxa && puntMarcat(marcats, fitxa.codi)

  // Columna dreta: «Punt» o «Marcats». Si es demana un punt des de la llista
  // (també des de la de l'orella), es torna a «Punt»
  const [pestanyaPanell, setPestanyaPanell] = useState<PestanyaPanell>('punt')
  const [peticioPanell, setPeticioPanell] = useState(0)
  if (peticio && peticio.n !== peticioPanell) {
    setPeticioPanell(peticio.n)
    setPestanyaPanell('punt')
  }

  // Des de la llista de marcats (també quan es ve de la pestanya de l'orella)
  const darreraPeticio = useRef(0)
  useEffect(() => {
    if (!peticio || peticio.n === darreraPeticio.current) return
    darreraPeticio.current = peticio.n
    anarAlPunt(peticio.codi)
  })

  return (
    <div className="disseny-mapa">
      <div className="columna-visor">
        <div className="zona-visor">
          {model && !model.definitiu && <p className="avis avis-flotant">{t.mapa.maniquiProvisional}</p>}
          {model && tots.length === 0 && <p className="avis avis-flotant avis-segon">{t.mapa.sensePosicions}</p>}
          {!model && (carregant ? <Indicador text={t.mapa.carregantModel} /> : <ErrorCos3D />)}
          {model && mode === '2d' && (
            <Visor2D
              ref={visor}
              geometria={model.geometria}
              marcadors={marcadors}
              etiquetesSempre={meridia !== ''}
              onTocarMarcador={(id) => {
                const { codi, costat, index } = llegirIdMarcador(id)
                obrirFitxa(codi, costat, index)
              }}
            />
          )}
          {model && mode === '3d' && <Visor3D
            ref={visor}
            onUsar2D={() => setMode('2d')}
            geometria={model.geometria}
            marcadors={marcadors}
            recorreguts={recorreguts}
            etiquetesSempre={meridia !== ''}
            modeToc={correccio ? 'pell' : 'marcador'}
            onTocarMarcador={(id) => {
              const { codi, costat, index } = llegirIdMarcador(id)
              obrirFitxa(codi, costat, index)
            }}
            onTocarPell={(toc) => corregir(toc, true)}
            arrossegable={correccio ? idMarcador(correccio.codi, correccio.costat, correccio.index) : null}
            onArrossegar={(toc) => corregir(toc, false)}
          />}
        </div>
        {/* Fora del dibuix, perquè no tapin el cos */}
        <div className="barra-visor">
          <div className="segmentat mode-mapa" role="radiogroup" aria-label={t.mapa.modeMapa}>
            {(['3d', '2d'] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
                {m === '3d' ? t.mapa.mode3d : t.mapa.mode2d}
              </button>
            ))}
          </div>
          <BarraVistes visor={visor} />
          <ul className="llegenda" aria-label={t.mapa.tecnicaTitol}>
            {TECNIQUES.map((tec) => (
              <li key={tec}>
                <span className="punt-color" style={{ background: COLOR_TECNICA[tec] }} />
                {t.mapa.tecnica[tec]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <PanellLateral
        mapa="cos"
        pestanya={pestanyaPanell}
        onPestanya={setPestanyaPanell}
        total={marcats.length}
        punt={
          <>
        <div className="barra-cerca">
          <input
            type="search"
            aria-label={t.mapa.cercar}
            placeholder={t.mapa.cercar}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultats[0]) {
                anarAlPunt(resultats[0].codi)
                setConsulta('')
              }
            }}
          />
          <select aria-label={t.mapa.meridia} value={meridia} onChange={(e) => setMeridia(e.target.value)}>
            <option value="">{t.mapa.tots}</option>
            {cataleg.meridians.map((m) => (
              <option key={m.codi} value={m.codi}>
                {m.codi} · {m.nom}
              </option>
            ))}
          </select>
        </div>

        {consulta.trim() !== '' && (
          <ul className="llista-punts" aria-label={t.mapa.cercar}>
            {resultats.length === 0 && <li className="buit">{t.mapa.capResultat}</li>}
            {resultats.map((p) => {
              const teLloc = tots.some((x) => x.punt.codi === p.codi)
              return (
                <li key={p.codi}>
                  <button
                    type="button"
                    onClick={() => {
                      anarAlPunt(p.codi)
                      setConsulta('')
                    }}
                  >
                    <span className="codi">{p.codi}</span>
                    <span className="pinyin">{p.pinyin}</span>
                    {!teLloc && <span className="detall">{t.mapa.sensePosicio}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {correccio && (
          <section className="fitxa-punt" aria-label={formatar(t.mapa.corregint, { codi: correccio.codi })}>
            <h2>{formatar(t.mapa.corregint, { codi: correccio.codi })}</h2>
            <p>{t.mapa.instruccionsCorregir}</p>
            {puntFitxa && costatsDe(cataleg, puntFitxa).length > 1 && (
              <div className="segmentat" role="radiogroup" aria-label={t.mapa.costatTitol}>
                {(['E', 'D'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={correccio.costat === c}
                    onClick={() => començarCorreccio({ ...correccio, costat: c })}
                  >
                    {t.mapa.costat[c]}
                  </button>
                ))}
              </div>
            )}
            {puntFitxa?.subpunts && (
              <label className="camp">
                <span>{t.mapa.subpunt}</span>
                <select
                  value={correccio.index}
                  onChange={(e) => començarCorreccio({ ...correccio, index: Number(e.target.value) })}
                >
                  {puntFitxa.subpunts.map((nom, i) => (
                    <option key={nom} value={i}>
                      {nom}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <p className="detall" role="status">
              {t.mapa.origen[origenDe(correccio.codi, correccio.costat, correccio.index) ?? 'oms']}
            </p>
            <div className="accions accions-esquerra">
              <Boto onClick={() => setCorreccio(null)}>{t.mapa.fet}</Boto>
              <Boto
                variant="discret"
                disabled={origenDe(correccio.codi, correccio.costat, correccio.index) !== 'doctora'}
                onClick={() => void restablir(correccio.codi, correccio.costat, correccio.index)}
              >
                {t.mapa.restablir}
              </Boto>
            </div>
          </section>
        )}

        {!correccio && fitxa && puntFitxa && (
          <section className="fitxa-punt" aria-label={puntFitxa.codi}>
            <h2>
              {puntFitxa.codi} · {puntFitxa.pinyin} <span lang="zh">{puntFitxa.hanzi}</span>
            </h2>
            <p className="detall">
              {t.mapa.meridia}: {nomMeridia(efectiu, puntFitxa.meridia)}
              {puntFitxa.nomCatala && ` · ${puntFitxa.nomCatala}`}
            </p>
            <p>{puntFitxa.localitzacio || <span className="detall">{t.mapa.localitzacioPendent}</span>}</p>
            {puntFitxa.subpunts && (
              <p className="detall">
                {formatar(t.mapa.subpunts, { n: String(puntFitxa.subpunts.length) })}: {puntFitxa.subpunts.join(' · ')}
              </p>
            )}
            {puntFitxa.precaucions.categories.length > 0 && (
              <div className="avis" role="note">
                <span className="etiqueta etiqueta-precaucio">
                  {[
                    t.precaucions.precaucio,
                    ...puntFitxa.precaucions.categories.map((x) => t.precaucions.categories[x]),
                  ].join(' · ')}
                </span>
                {puntFitxa.precaucions.nota && (
                  <span>
                    {notaSenseCategoria(
                      puntFitxa.precaucions.nota,
                      puntFitxa.precaucions.categories.map((x) => t.precaucions.categories[x]),
                    )}
                  </span>
                )}
                {puntFitxa.precaucions.confirmada && <span className="detall">{t.precaucions.confirmada}</span>}
              </div>
            )}

            {corregitPerLaDoctora(puntFitxa.codi) && (
              <p className="etiqueta-origen">{t.mapa.origen.doctora}</p>
            )}

            <div className="segmentat" role="radiogroup" aria-label={t.mapa.costatTitol}>
              {COSTATS_MARCAT.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={fitxa.costat === c}
                  onClick={() => setFitxa({ ...fitxa, costat: c })}
                >
                  {t.mapa.costat[c]}
                </button>
              ))}
            </div>
            <div className="segmentat segmentat-graella" role="radiogroup" aria-label={t.mapa.tecnicaTitol}>
              {TECNIQUES.map((tec) => (
                <button
                  key={tec}
                  type="button"
                  role="radio"
                  className={nomAmple(t.mapa.tecnica[tec])}
                  aria-checked={fitxa.tecnica === tec}
                  onClick={() => setFitxa({ ...fitxa, tecnica: tec })}
                >
                  <span className="punt-color" style={{ background: COLOR_TECNICA[tec] }} />
                  {t.mapa.tecnica[tec]}
                </button>
              ))}
            </div>
            <div className="accions accions-esquerra">
              <Boto
                onClick={() => {
                  setMarcats((l) => marcar(l, nouPuntMarcat(fitxa.codi, fitxa.costat, fitxa.tecnica)))
                  setFitxa(null)
                }}
              >
                {jaMarcat ? t.mapa.actualitzar : t.mapa.marcar}
              </Boto>
              {jaMarcat && (
                <Boto
                  variant="secundari"
                  onClick={() => {
                    setMarcats((l) => desmarcar(l, fitxa.codi))
                    setFitxa(null)
                  }}
                >
                  {t.mapa.desmarcar}
                </Boto>
              )}
              <Boto variant="discret" onClick={() => setFitxa(null)}>
                {t.mapa.tancar}
              </Boto>
            </div>
            {model && mode === '2d' && <p className="detall">{t.mapa.correccioNomes3d}</p>}
            {model && mode === '3d' && (
            <div className="accions accions-esquerra">
              <Boto
                variant="discret"
                onClick={() =>
                  començarCorreccio({
                    codi: fitxa.codi,
                    // El costat triat a la fitxa; si és bilateral, el del marcador tocat
                    costat:
                      costatsDe(cataleg, puntFitxa).length === 1
                        ? 'C'
                        : fitxa.costat !== 'bilateral'
                          ? fitxa.costat
                          : fitxa.tocat.costat === 'D'
                            ? 'D'
                            : 'E',
                    index: fitxa.tocat.index,
                  })
                }
              >
                {t.mapa.corregir}
              </Boto>
            </div>
            )}
          </section>
        )}

          </>
        }
        marcats={
        <LlistaMarcats
          titolOcult
          marcats={marcats}
          onVeure={(m) => {
            setPestanyaPanell('punt')
            onVeure(m)
          }}
          onTreure={(m) => setMarcats((l) => desmarcar(l, m.codi, m.mapa))}
          onTreureTots={() => setMarcats([])}
        />
        }
      />
    </div>
  )
}
