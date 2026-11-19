// Ajustos > Visita: temps de retenció per defecte, so en acabar (volum i
// «Provar el so») i control
// d'agulles (comuns a tots els dispositius, com l'horari).

import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { desarAjustosVisita, llegirAjustosVisita, type AjustosVisita } from '../../db/ajustosVisita'
import { formatar, t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { soAvis } from '../../visita/so'

export function PantallaAjustVisita() {
  const { db } = useSessio()
  const [carrega, substituir] = useCarrega(() => llegirAjustosVisita(db), [db])
  const a = t.ajustVisita
  const canviar = (nous: AjustosVisita) => {
    substituir(nous)
    void desarAjustosVisita(db, nous)
  }
  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{a.titol}</h1>
      {carrega.estat !== 'llest' ? (
        <Indicador text={t.app.carregant} />
      ) : (
        <section className="panell formulari">
          <Camp etiqueta={a.minuts}>
            <input
              type="number"
              min={1}
              max={120}
              value={carrega.dades.minutsRetencio}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isInteger(n) && n >= 1 && n <= 120) canviar({ ...carrega.dades, minutsRetencio: n })
              }}
            />
          </Camp>
          <label className="casella">
            <input type="checkbox" checked={carrega.dades.so} onChange={(e) => canviar({ ...carrega.dades, so: e.target.checked })} />
            {a.so}
          </label>
          <div className="camp camp-volum">
            <label htmlFor="volum-so">{formatar(a.volum, { n: String(carrega.dades.volum) })}</label>
            <div className="fila-volum">
              <input
                id="volum-so"
                type="range"
                min={0}
                max={100}
                step={5}
                value={carrega.dades.volum}
                disabled={!carrega.dades.so}
                onChange={(e) => canviar({ ...carrega.dades, volum: Number(e.target.value) })}
              />
              <Boto variant="secundari" disabled={!carrega.dades.so} title={a.provarAjuda} onClick={() => soAvis(carrega.dades.volum)}>
                {a.provar}
              </Boto>
            </div>
          </div>
          <label className="casella">
            <input
              type="checkbox"
              checked={carrega.dades.controlAgulles}
              onChange={(e) => canviar({ ...carrega.dades, controlAgulles: e.target.checked })}
            />
            {a.controlAgulles}
          </label>
          <p className="detall">{a.controlAgullesDesc}</p>
        </section>
      )}
    </main>
  )
}
