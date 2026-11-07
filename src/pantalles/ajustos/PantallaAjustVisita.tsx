// Ajustos > Visita: temps de retenció per defecte, so en acabar i control
// d'agulles (comuns a tots els dispositius, com l'horari).

import { Link } from 'react-router'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { desarAjustosVisita, llegirAjustosVisita, type AjustosVisita } from '../../db/ajustosVisita'
import { t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

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
