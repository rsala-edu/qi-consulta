// Pantalla de prova del marcatge de punts (etapa 2d). No desa res: quan
// tinguem les sessions, aquest mateix flux anirà dins la pantalla de sessió.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { llistarCalibratge, type Calibracio } from '../../db/calibratge'
import {
  COLOR_TECNICA,
  COSTATS_MARCAT,
  desmarcar,
  marcar,
  nouPuntMarcat,
  tecnicaDelMarcador,
  TECNIQUES,
  type CostatMarcat,
  type PuntMarcat,
  type Tecnica,
} from '../../domini/puntMarcat'
import { t } from '../../i18n/t'
import { Visor3D, type ControlVisor, type MarcadorVisor } from '../../mapa/components/Visor3D'
import { llegirIdMarcador, puntsSobreModel, recorregutsMeridia } from '../../mapa/marcadors'
import type { ModelCos } from '../../mapa/model'
import { useModelCos } from '../../mapa/useModelCos'
import { ambCalibratge, cataleg, cercarPunts, nomMeridia } from '../../punts/cataleg'
import type { CostatPosicio } from '../../punts/esquema'
import { useSessio } from '../../sessio/ContextSessio'

export function PantallaProvaMapa() {
  const carrega = useModelCos()
  return (
    <main className="pantalla-mapa">
      <div className="capcalera-mapa">
        <h1>{t.mapa.titolProva}</h1>
        <p className="avis">{t.mapa.avisProva}</p>
      </div>
      {carrega.estat === 'carregant' && <Indicador text={t.mapa.carregantModel} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && <Marcatge model={carrega.dades} />}
    </main>
  )
}

interface FitxaOberta {
  codi: string
  costat: CostatMarcat
  tecnica: Tecnica
}

function Marcatge({ model }: { model: ModelCos }) {
  const { db } = useSessio()
  const visor = useRef<ControlVisor>(null)
  const [calibracions, setCalibracions] = useState<Calibracio[]>([])
  const [meridia, setMeridia] = useState('')
  const [consulta, setConsulta] = useState('')
  const [marcats, setMarcats] = useState<PuntMarcat[]>([])
  const [fitxa, setFitxa] = useState<FitxaOberta | null>(null)

  useEffect(() => {
    void llistarCalibratge(db, model.topologia).then(setCalibracions)
  }, [db, model.topologia])

  const efectiu = useMemo(() => ambCalibratge(cataleg, calibracions), [calibracions])
  const tots = useMemo(() => puntsSobreModel(efectiu, model), [efectiu, model])
  const visibles = useMemo(() => (meridia ? tots.filter((p) => p.punt.meridia === meridia) : tots), [tots, meridia])
  const recorreguts = useMemo(() => (meridia ? recorregutsMeridia(tots, meridia) : []), [tots, meridia])

  const marcadors: MarcadorVisor[] = useMemo(
    () =>
      visibles.map((p) => {
        const tecnica = tecnicaDelMarcador(marcats, p.punt.codi, p.costat)
        return {
          id: p.id,
          punt: p.posicio,
          normal: p.normal,
          color: tecnica && COLOR_TECNICA[tecnica],
          destacat: fitxa?.codi === p.punt.codi,
          etiqueta: p.punt.codi,
          etiquetaLlarga: `${p.punt.codi} · ${p.punt.pinyin}`,
        }
      }),
    [visibles, marcats, fitxa?.codi],
  )

  function obrirFitxa(codi: string, costatTocat?: CostatPosicio) {
    const existent = marcats.find((m) => m.codi === codi)
    const costat: CostatMarcat = existent?.costat ?? (costatTocat === 'E' || costatTocat === 'D' ? costatTocat : 'bilateral')
    setFitxa({ codi, costat, tecnica: existent?.tecnica ?? 'agulla' })
  }

  function anarAlPunt(codi: string) {
    const p = tots.find((x) => x.punt.codi === codi)
    if (p) visor.current?.anarA(p.posicio, p.normal)
    obrirFitxa(codi, p?.costat)
  }

  const resultats = consulta.trim() ? cercarPunts(efectiu, consulta).slice(0, 8) : []
  const puntFitxa = fitxa && efectiu.punts.find((p) => p.codi === fitxa.codi)
  const jaMarcat = fitxa && marcats.some((m) => m.codi === fitxa.codi)

  return (
    <div className="disseny-mapa">
      <div className="zona-visor">
        {!model.definitiu && <p className="avis avis-flotant">{t.mapa.maniquiProvisional}</p>}
        {tots.length === 0 && <p className="avis avis-flotant avis-segon">{t.mapa.sensePosicions}</p>}
        <Visor3D
          ref={visor}
          geometria={model.geometria}
          marcadors={marcadors}
          recorreguts={recorreguts}
          modeToc="marcador"
          onTocarMarcador={(id) => {
            const { codi, costat } = llegirIdMarcador(id)
            obrirFitxa(codi, costat)
          }}
        />
        <ul className="llegenda" aria-label={t.mapa.tecnicaTitol}>
          {TECNIQUES.map((tec) => (
            <li key={tec}>
              <span className="punt-color" style={{ background: COLOR_TECNICA[tec] }} />
              {t.mapa.tecnica[tec]}
            </li>
          ))}
        </ul>
      </div>

      <aside className="panell-mapa">
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

        {fitxa && puntFitxa && (
          <section className="fitxa-punt" aria-label={puntFitxa.codi}>
            <h2>
              {puntFitxa.codi} · {puntFitxa.pinyin} <span lang="zh">{puntFitxa.hanzi}</span>
            </h2>
            <p className="detall">
              {t.mapa.meridia}: {nomMeridia(efectiu, puntFitxa.meridia)}
              {puntFitxa.nomCatala && ` · ${puntFitxa.nomCatala}`}
            </p>
            <p>{puntFitxa.localitzacio || <span className="detall">{t.mapa.localitzacioPendent}</span>}</p>
            {(puntFitxa.precaucions.embaras || puntFitxa.precaucions.nota) && (
              <p className="avis" role="note">
                {puntFitxa.precaucions.embaras && <strong>{t.mapa.precaucioEmbaras}. </strong>}
                {puntFitxa.precaucions.nota}
              </p>
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
            <div className="segmentat segmentat-ample" role="radiogroup" aria-label={t.mapa.tecnicaTitol}>
              {TECNIQUES.map((tec) => (
                <button
                  key={tec}
                  type="button"
                  role="radio"
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
          </section>
        )}

        <section>
          <h2>{t.mapa.marcats}</h2>
          {marcats.length === 0 && <p className="detall">{t.mapa.capMarcat}</p>}
          <ul className="llista-marcats" aria-label={t.mapa.marcats}>
            {marcats.map((m) => {
              const p = efectiu.punts.find((x) => x.codi === m.codi)
              return (
                <li key={m.codi}>
                  <span className="punt-color" style={{ background: COLOR_TECNICA[m.tecnica] }} />
                  <span className="codi">{m.codi}</span>
                  <span className="pinyin">{p?.pinyin}</span>
                  <span className="detall">
                    {t.mapa.costat[m.costat]} · {t.mapa.tecnica[m.tecnica]}
                  </span>
                  <Boto variant="discret" onClick={() => anarAlPunt(m.codi)}>
                    {t.mapa.veure}
                  </Boto>
                  <Boto variant="discret" onClick={() => setMarcats((l) => desmarcar(l, m.codi))}>
                    {t.mapa.treure}
                  </Boto>
                </li>
              )
            })}
          </ul>
        </section>
      </aside>
    </div>
  )
}
