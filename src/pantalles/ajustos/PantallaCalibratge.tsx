// Eina interna de calibratge: col·locar els punts del catàleg sobre la pell
// del model (raycast), arrossegar-los i exportar el catàleg amb les posicions.
// Les posicions es guarden al dispositiu fins que s'exporten.

import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { formatar, t } from '../../i18n/t'
import { Visor3D, type ControlVisor, type MarcadorVisor, type TocPell } from '../../mapa/components/Visor3D'
import {
  COSTAT_OPOSAT,
  posicio3D,
  posicioDesDePunt,
  posicioMirall,
} from '../../mapa/geometria/baricentriques'
import { idMarcador, puntsSobreModel } from '../../mapa/marcadors'
import type { ModelCos } from '../../mapa/model'
import { useCalibracions } from '../../mapa/useCalibracions'
import { useModelCos } from '../../mapa/useModelCos'
import { usePrecaucions } from '../../mapa/usePrecaucions'
import { ambPrecaucions, cataleg, exportarCataleg, posicioDe } from '../../punts/cataleg'
import type { CostatPosicio } from '../../punts/esquema'

export function PantallaCalibratge() {
  const carrega = useModelCos()
  return (
    <main className="pantalla-mapa">
      <div className="capcalera-mapa">
        <Link className="enllac-tornar" to="/ajustos">
          ← {t.ajustos.titol}
        </Link>
        <h1>{t.calibratge.titol}</h1>
      </div>
      {carrega.estat === 'carregant' && <Indicador text={t.mapa.carregantModel} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && <Calibratge model={carrega.dades} />}
    </main>
  )
}

function Calibratge({ model }: { model: ModelCos }) {
  const visor = useRef<ControlVisor>(null)
  const { calibracions, efectiu, desar, descartarTot } = useCalibracions(model.topologia)
  const { revisions } = usePrecaucions()
  const [meridia, setMeridia] = useState(cataleg.meridians[0]!.codi)
  const [seleccionat, setSeleccionat] = useState<string | null>(null)
  const [costat, setCostat] = useState<CostatPosicio>('E')
  const [missatge, setMissatge] = useState('')

  const puntsMeridia = efectiu.punts.filter((p) => p.meridia === meridia)
  const bilateral = cataleg.meridians.find((m) => m.codi === meridia)?.bilateral ?? true
  const costats: CostatPosicio[] = bilateral ? ['E', 'D'] : ['C']
  const punt = efectiu.punts.find((p) => p.codi === seleccionat)
  const sobreModel = useMemo(() => puntsSobreModel(efectiu, model), [efectiu, model])
  const idSeleccionat = seleccionat ? idMarcador(seleccionat, costat) : null

  const marcadors: MarcadorVisor[] = useMemo(
    () =>
      sobreModel.map((p) => ({
        id: p.id,
        punt: p.posicio,
        normal: p.normal,
        color: p.punt.codi === seleccionat ? '#2f6b55' : undefined,
        destacat: p.id === idSeleccionat,
        etiqueta: `${p.punt.codi} ${p.costat}`,
        etiquetaLlarga: `${p.punt.codi} ${p.costat} · ${p.punt.pinyin}`,
      })),
    [sobreModel, seleccionat, idSeleccionat],
  )

  const colocar = (toc: TocPell, immediat: boolean) => {
    if (!seleccionat) return
    const pos = posicioDesDePunt(model.geometria, toc.triangle, toc.punt)
    desar(seleccionat, costat, posicio3D(model.topologia, costat, pos, 'manual'), immediat)
  }

  const triar = (codi: string, c: CostatPosicio = costat) => {
    setSeleccionat(codi)
    setCostat(c)
    setMissatge('')
    const actual = sobreModel.find((p) => p.id === idMarcador(codi, c))
    if (actual) visor.current?.anarA(actual.posicio, actual.normal)
  }

  const index = puntsMeridia.findIndex((p) => p.codi === seleccionat)
  const posActual = punt ? posicioDe(punt, model.topologia, costat) : undefined
  const n = sobreModel.length

  function exportar() {
    const blob = new Blob([exportarCataleg(ambPrecaucions(efectiu, revisions ?? []))], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cataleg.json'
    a.click()
    URL.revokeObjectURL(url)
    setMissatge(t.calibratge.exportat)
  }

  async function descartar() {
    if (!window.confirm(t.calibratge.confirmarDescartar)) return
    await descartarTot()
  }

  return (
    <div className="disseny-mapa">
      <div className="zona-visor">
        {!model.definitiu && <p className="avis avis-flotant">{t.mapa.maniquiProvisional}</p>}
        <Visor3D
          ref={visor}
          geometria={model.geometria}
          marcadors={marcadors}
          modeToc="pell"
          onTocarPell={(toc) => colocar(toc, true)}
          arrossegable={posActual ? idSeleccionat : null}
          onArrossegar={(toc) => colocar(toc, false)}
        />
      </div>

      <aside className="panell-mapa">
        <p className="detall">
          {t.calibratge.model}: {model.definitiu ? t.calibratge.definitiu : t.calibratge.provisional} ·{' '}
          {n === 1 ? t.calibratge.progres.u : formatar(t.calibratge.progres.altres, { n: String(n) })}
        </p>
        <p>{t.calibratge.instruccions}</p>

        <label className="camp">
          <span>{t.mapa.meridia}</span>
          <select value={meridia} onChange={(e) => setMeridia(e.target.value)}>
            {cataleg.meridians.map((m) => (
              <option key={m.codi} value={m.codi}>
                {m.codi} · {m.nom}
              </option>
            ))}
          </select>
        </label>

        <ul className="llista-punts" aria-label={t.calibratge.llistaPunts}>
          {puntsMeridia.map((p) => (
            <li key={p.codi}>
              <button
                type="button"
                className={p.codi === seleccionat ? 'actiu' : ''}
                aria-pressed={p.codi === seleccionat}
                onClick={() => triar(p.codi)}
              >
                <span className="codi">{p.codi}</span>
                <span className="pinyin">{p.pinyin}</span>
                <span className="estat-costats">
                  {costats.map((c) => (
                    <span key={c} className={posicioDe(p, model.topologia, c) ? 'fet' : ''}>
                      {c}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {punt ? (
          <div className="punt-seleccionat">
            <h2>
              {punt.codi} · {punt.pinyin} <span lang="zh">{punt.hanzi}</span>
            </h2>
            <div className="segmentat" role="radiogroup" aria-label={t.mapa.costatTitol}>
              {costats.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={costat === c} onClick={() => triar(punt.codi, c)}>
                  {t.mapa.costat[c]}
                </button>
              ))}
            </div>
            <div className="accions accions-esquerra">
              {bilateral && (
                <Boto
                  variant="secundari"
                  disabled={!posActual}
                  onClick={() => {
                    if (!posActual) return
                    const oposat = COSTAT_OPOSAT[costat]
                    const mirall = posicioMirall(model.geometria, posActual)
                    desar(punt.codi, oposat, posicio3D(model.topologia, oposat, mirall, 'manual'))
                  }}
                >
                  {t.calibratge.copiarOposat}
                </Boto>
              )}
              <Boto variant="discret" disabled={!posActual} onClick={() => desar(punt.codi, costat, null)}>
                {t.calibratge.esborrar}
              </Boto>
            </div>
            <div className="accions accions-esquerra">
              <Boto variant="discret" disabled={index <= 0} onClick={() => triar(puntsMeridia[index - 1]!.codi)}>
                ← {t.calibratge.anterior}
              </Boto>
              <Boto
                variant="discret"
                disabled={index >= puntsMeridia.length - 1}
                onClick={() => triar(puntsMeridia[index + 1]!.codi)}
              >
                {t.calibratge.seguent} →
              </Boto>
            </div>
          </div>
        ) : (
          <p className="buit">{t.calibratge.capSeleccionat}</p>
        )}

        <div className="accions accions-esquerra">
          <Boto onClick={exportar}>{t.calibratge.exportar}</Boto>
          <Boto variant="discret" onClick={() => void descartar()} disabled={calibracions.length === 0}>
            {t.calibratge.descartar}
          </Boto>
        </div>
        <p className="avis-desat" role="status">
          {missatge}
        </p>
      </aside>
    </div>
  )
}
