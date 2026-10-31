// Eina interna de calibratge: col·locar els punts del catàleg sobre la pell
// del model (raycast), arrossegar-los i exportar el catàleg amb les posicions.
// Les posicions es guarden al dispositiu fins que s'exporten.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { desarCalibracio, descartarCalibratge, llistarCalibratge, type Calibracio } from '../../db/calibratge'
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
import { useModelCos } from '../../mapa/useModelCos'
import { ambCalibratge, cataleg, exportarCataleg, posicioDe } from '../../punts/cataleg'
import type { CostatPosicio } from '../../punts/esquema'
import { useSessio } from '../../sessio/ContextSessio'

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
  const { db } = useSessio()
  const visor = useRef<ControlVisor>(null)
  const [calibracions, setCalibracions] = useState<Calibracio[]>([])
  const [meridia, setMeridia] = useState(cataleg.meridians[0]!.codi)
  const [seleccionat, setSeleccionat] = useState<string | null>(null)
  const [costat, setCostat] = useState<CostatPosicio>('E')
  const [missatge, setMissatge] = useState('')

  useEffect(() => {
    void llistarCalibratge(db, model.topologia).then(setCalibracions)
  }, [db, model.topologia])

  const efectiu = useMemo(() => ambCalibratge(cataleg, calibracions), [calibracions])
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

  // Desa a l'estat de seguida i a la base de dades (amb un petit retard en arrossegar)
  const pendents = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const aplicar = useCallback(
    (codi: string, c: CostatPosicio, posicio: Calibracio['posicio'], immediat = true) => {
      const nova: Calibracio = { codi, topologia: model.topologia, costat: c, posicio }
      setCalibracions((l) => [...l.filter((k) => !(k.codi === codi && k.costat === c)), nova])
      const clau = idMarcador(codi, c)
      clearTimeout(pendents.current.get(clau))
      const desar = () => void desarCalibracio(db, model.topologia, codi, c, posicio)
      if (immediat) desar()
      else pendents.current.set(clau, setTimeout(desar, 250))
    },
    [db, model.topologia],
  )

  useEffect(() => {
    const p = pendents.current
    return () => p.forEach((id) => clearTimeout(id))
  }, [])

  const colocar = (toc: TocPell, immediat: boolean) => {
    if (!seleccionat) return
    const pos = posicioDesDePunt(model.geometria, toc.triangle, toc.punt)
    aplicar(seleccionat, costat, posicio3D(model.topologia, costat, pos), immediat)
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
    const blob = new Blob([exportarCataleg(efectiu)], { type: 'application/json' })
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
    await descartarCalibratge(db, model.topologia)
    setCalibracions([])
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
          {formatar(t.calibratge.progres, { n: String(n) })}
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
                    aplicar(punt.codi, oposat, posicio3D(model.topologia, oposat, mirall))
                  }}
                >
                  {t.calibratge.copiarOposat}
                </Boto>
              )}
              <Boto variant="discret" disabled={!posActual} onClick={() => aplicar(punt.codi, costat, null)}>
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
