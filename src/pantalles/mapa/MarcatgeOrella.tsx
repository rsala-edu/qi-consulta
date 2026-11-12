// Mapa de l'orella (escola xinesa, GB/T 13734-2008): orella esquerra o dreta,
// zoom, marcatge amb les tècniques de l'orella i correcció de la posició.

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { LlegendaColors } from '../../mapa/components/LlegendaColors'
import { Boto } from '../../components/Boto'
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
  type PuntMarcat,
  type Tecnica,
} from '../../domini/puntMarcat'
import { formatar, t } from '../../i18n/t'
import { cercarPuntsOrella, NOMS_ZONES, posicioOrella, PUNTS_ORELLA, puntOrella } from '../../orella/cataleg'
import { VisorOrella, type ControlOrella, type PuntDibuix } from '../../orella/components/VisorOrella'
import { ZONES_ORELLA, type ZonaOrella } from '../../orella/dibuix'
import { useCorreccionsOrella } from '../../orella/useCorreccionsOrella'
import type { CostatOrella } from '../../orella/vista'
import { LlistaMarcats } from './LlistaMarcats'
import { PanellLateral, type PestanyaPanell } from './PanellLateral'
import { nomAmple } from './tecniques'

const TECNIQUES = TECNIQUES_DEL_MAPA.orella

interface FitxaOberta {
  codi: string
  costat: CostatMarcat
  tecnica: Tecnica
}

interface Props {
  marcats: PuntMarcat[]
  setMarcats: Dispatch<SetStateAction<PuntMarcat[]>>
  /** Punt que s'ha de mostrar (des de la llista de marcats) */
  peticio: { codi: string; n: number } | null
  onVeure(m: PuntMarcat): void
}

export function MarcatgeOrella({ marcats, setMarcats, peticio, onVeure }: Props) {
  const visor = useRef<ControlOrella>(null)
  const { correccions, desar, treure } = useCorreccionsOrella()
  const [costatVist, setCostatVist] = useState<CostatOrella>('E')
  const [zona, setZona] = useState<ZonaOrella | ''>('')
  const [zones, setZones] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [fitxa, setFitxa] = useState<FitxaOberta | null>(null)
  const [corregint, setCorregint] = useState<string | null>(null)

  const visibles = useMemo(() => (zona ? PUNTS_ORELLA.filter((p) => p.zona === zona) : PUNTS_ORELLA), [zona])
  const punts: PuntDibuix[] = useMemo(
    () =>
      visibles.map((p) => {
        const pos = posicioOrella(p, correccions)
        const tecnica = tecnicaDelMarcador(marcats, p.codi, costatVist, 'orella')
        return {
          id: p.codi,
          x: pos.x,
          y: pos.y,
          color: tecnica && COLOR_TECNICA[tecnica],
          destacat: (corregint ?? fitxa?.codi) === p.codi,
          etiqueta: p.codi,
          etiquetaLlarga: `${p.codi} · ${p.nom}`,
        }
      }),
    [visibles, correccions, marcats, costatVist, fitxa?.codi, corregint],
  )

  function obrirFitxa(codi: string) {
    const existent = puntMarcat(marcats, codi, 'orella')
    setFitxa({ codi, costat: existent?.costat ?? costatVist, tecnica: existent?.tecnica ?? 'agulla' })
    // La fitxa és a la pestanya «Punt»
    setPestanyaPanell('punt')
  }

  function anarAlPunt(codi: string) {
    const p = puntOrella(codi)
    if (!p) return
    if (zona && p.zona !== zona) setZona('')
    const pos = posicioOrella(p, correccions)
    visor.current?.anarA(pos.x, pos.y)
    setCorregint(null)
    obrirFitxa(codi)
  }

  // Des de la llista de marcats (també quan es ve de la pestanya del cos):
  // primer l'estat (l'orella marcada i la fitxa), després la càmera
  const [pestanyaPanell, setPestanyaPanell] = useState<PestanyaPanell>('punt')
  const [peticioVista, setPeticioVista] = useState(0)
  if (peticio && peticio.n !== peticioVista) {
    setPeticioVista(peticio.n)
    setPestanyaPanell('punt')
    const m = puntMarcat(marcats, peticio.codi, 'orella')
    if (m && m.costat !== 'bilateral') setCostatVist(m.costat)
    if (zona && puntOrella(peticio.codi)?.zona !== zona) setZona('')
    setCorregint(null)
    obrirFitxa(peticio.codi)
  }
  const correccionsRef = useRef(correccions)
  useEffect(() => {
    correccionsRef.current = correccions
  })
  useEffect(() => {
    const p = peticio && puntOrella(peticio.codi)
    if (!p) return
    const pos = posicioOrella(p, correccionsRef.current)
    visor.current?.anarA(pos.x, pos.y)
  }, [peticio])

  const resultats = consulta.trim() ? cercarPuntsOrella(consulta).slice(0, 8) : []
  const puntFitxa = puntOrella(corregint ?? fitxa?.codi ?? '')
  const jaMarcat = fitxa && puntMarcat(marcats, fitxa.codi, 'orella')

  return (
    <div className="disseny-mapa">
      <div className="columna-visor">
        <div className="zona-visor">
          <VisorOrella
            ref={visor}
            costat={costatVist}
            punts={punts}
            modeToc={corregint ? 'posicio' : 'punt'}
            onTocarPunt={obrirFitxa}
            onTocarPosicio={(p) => corregint && desar(corregint, p.x, p.y)}
            arrossegable={corregint}
            onArrossegar={(p) => corregint && desar(corregint, p.x, p.y, false)}
            // En corregir la posició d'un punt, les zones sempre es veuen
            zones={zones || !!corregint}
          />
        </div>
        <div className="barra-visor">
          <div className="visor3d-vistes" role="toolbar" aria-label={t.orella.controls}>
            <div className="segmentat" role="radiogroup" aria-label={t.orella.quinaOrella}>
              {(['E', 'D'] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={costatVist === c} onClick={() => setCostatVist(c)}>
                  {c === 'E' ? t.orella.esquerra : t.orella.dreta}
                </button>
              ))}
            </div>
            <button type="button" className="boto boto-secundari" aria-label={t.orella.ampliar} onClick={() => visor.current?.ampliar()}>
              +
            </button>
            <button type="button" className="boto boto-secundari" aria-label={t.orella.reduir} onClick={() => visor.current?.reduir()}>
              −
            </button>
            <button type="button" className="boto boto-secundari" onClick={() => visor.current?.restablir()}>
              {t.orella.sencera}
            </button>
            <button type="button" className="boto boto-secundari" aria-pressed={zones} onClick={() => setZones((z) => !z)}>
              {zones ? t.orella.amagarZones : t.orella.mostrarZones}
            </button>
          </div>
          <LlegendaColors
            tecniques={TECNIQUES.map((tecnica) => ({ tecnica, nom: t.orella.tecnica[tecnica as keyof typeof t.orella.tecnica] }))}
          />
        </div>
      </div>

      <PanellLateral
        mapa="orella"
        pestanya={pestanyaPanell}
        onPestanya={setPestanyaPanell}
        total={marcats.length}
        punt={
          <>
        <p className="detall">{t.orella.estandard}</p>
        <div className="barra-cerca">
          <input
            type="search"
            aria-label={t.orella.cercarEtiqueta}
            placeholder={t.orella.cercar}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && resultats[0]) {
                anarAlPunt(resultats[0].codi)
                setConsulta('')
              }
            }}
          />
          <select aria-label={t.orella.zona} value={zona} onChange={(e) => setZona(e.target.value as ZonaOrella | '')}>
            <option value="">{t.orella.totesLesZones}</option>
            {ZONES_ORELLA.map((z) => (
              <option key={z} value={z}>
                {z} · {NOMS_ZONES[z]}
              </option>
            ))}
          </select>
        </div>

        {consulta.trim() !== '' && (
          <ul className="llista-punts" aria-label={t.orella.cercar}>
            {resultats.length === 0 && <li className="buit">{t.mapa.capResultat}</li>}
            {resultats.map((p) => (
              <li key={p.codi}>
                <button
                  type="button"
                  onClick={() => {
                    anarAlPunt(p.codi)
                    setConsulta('')
                  }}
                >
                  <span className="codi">{p.codi}</span>
                  <span className="pinyin">{p.nom}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {corregint && puntFitxa && (
          <section className="fitxa-punt" aria-label={formatar(t.mapa.corregint, { codi: corregint })}>
            <h2>{formatar(t.mapa.corregint, { codi: corregint })}</h2>
            <p>{t.orella.instruccionsCorregir}</p>
            <p className="detall" role="status">
              {correccions.has(corregint) ? t.mapa.origen.doctora : t.orella.posicioEstandard}
            </p>
            <div className="accions accions-esquerra">
              <Boto onClick={() => setCorregint(null)}>{t.mapa.fet}</Boto>
              <Boto variant="discret" disabled={!correccions.has(corregint)} onClick={() => void treure(corregint)}>
                {t.orella.tornarEstandard}
              </Boto>
            </div>
          </section>
        )}

        {!corregint && fitxa && puntFitxa && (
          <section className="fitxa-punt" aria-label={puntFitxa.codi}>
            <h2>
              {puntFitxa.codi} · {puntFitxa.pinyin} <span lang="zh">{puntFitxa.hanzi}</span>
            </h2>
            <p className="detall">
              {puntFitxa.nom} · {t.orella.zona}: {NOMS_ZONES[puntFitxa.zona]}
            </p>
            <p>{puntFitxa.localitzacio}</p>
            {puntFitxa.caraInterna && <p className="detall">{t.orella.caraInterna}</p>}
            {puntFitxa.codiPerConfirmar && <p className="etiqueta-origen">{t.orella.codiPerConfirmar}</p>}
            {correccions.has(puntFitxa.codi) && <p className="etiqueta-origen">{t.mapa.origen.doctora}</p>}

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
                  className={nomAmple(t.orella.tecnica[tec as keyof typeof t.orella.tecnica])}
                  aria-checked={fitxa.tecnica === tec}
                  onClick={() => setFitxa({ ...fitxa, tecnica: tec })}
                >
                  <span className="punt-color" style={{ background: COLOR_TECNICA[tec] }} />
                  {t.orella.tecnica[tec as keyof typeof t.orella.tecnica]}
                </button>
              ))}
            </div>
            <div className="accions accions-esquerra">
              <Boto
                onClick={() => {
                  setMarcats((l) => marcar(l, nouPuntMarcat(fitxa.codi, fitxa.costat, fitxa.tecnica, 'orella')))
                  setFitxa(null)
                }}
              >
                {jaMarcat ? t.mapa.actualitzar : t.mapa.marcar}
              </Boto>
              {jaMarcat && (
                <Boto
                  variant="secundari"
                  onClick={() => {
                    setMarcats((l) => desmarcar(l, fitxa.codi, 'orella'))
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
            <div className="accions accions-esquerra">
              <Boto
                variant="discret"
                onClick={() => {
                  setCorregint(fitxa.codi)
                  setFitxa(null)
                }}
              >
                {t.mapa.corregir}
              </Boto>
            </div>
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
