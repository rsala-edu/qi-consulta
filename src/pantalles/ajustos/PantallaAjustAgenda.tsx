// Ajustos → Agenda: horari de consulta i dies laborables. L'agenda mostra
// aquestes hores (amb mitja hora de marge) i avisa de les cites de fora.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { desarHorari, llegirHorari } from '../../db/agenda'
import { hhmm, minutsDe, type Horari } from '../../domini/agenda'
import { t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

/** De dilluns a diumenge */
const ORDRE_DIES = [1, 2, 3, 4, 5, 6, 0]

export function PantallaAjustAgenda() {
  const { db } = useSessio()
  const [carrega] = useCarrega(() => llegirHorari(db), [db])
  const a = t.ajustAgenda
  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{a.titol}</h1>
      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'llest' && <FormulariHorari inicial={carrega.dades} onDesar={(h) => desarHorari(db, h)} />}
    </main>
  )
}

function FormulariHorari({ inicial, onDesar }: { inicial: Horari; onDesar(h: Horari): Promise<void> }) {
  const a = t.ajustAgenda
  const [inici, setInici] = useState(hhmm(inicial.inici))
  const [fi, setFi] = useState(hhmm(inicial.fi))
  const [dies, setDies] = useState(new Set(inicial.dies))
  const [desat, setDesat] = useState(false)
  const error = minutsDe(fi) <= minutsDe(inici)

  return (
    <section className="panell" aria-label={a.horari}>
      <h2>{a.horari}</h2>
      <p className="detall">{a.horariDesc}</p>
      <div className="fila-camps">
        <Camp etiqueta={a.inici}>
          <input type="time" step={900} value={inici} onChange={(e) => (setInici(e.target.value), setDesat(false))} />
        </Camp>
        <Camp etiqueta={a.fi} error={error ? a.errorHores : undefined}>
          <input type="time" step={900} value={fi} onChange={(e) => (setFi(e.target.value), setDesat(false))} />
        </Camp>
      </div>
      <fieldset className="dies-laborables">
        <legend>{a.dies}</legend>
        {ORDRE_DIES.map((d) => (
          <label key={d} className="casella">
            <input
              type="checkbox"
              checked={dies.has(d)}
              onChange={(e) => {
                const nous = new Set(dies)
                if (e.target.checked) nous.add(d)
                else nous.delete(d)
                setDies(nous)
                setDesat(false)
              }}
            />
            {a.diesSetmana[d]}
          </label>
        ))}
      </fieldset>
      <p className="detall">{a.tancatsDesc}</p>
      <div className="accions accions-esquerra">
        <Boto
          disabled={error}
          onClick={() =>
            void onDesar({ inici: minutsDe(inici), fi: minutsDe(fi), dies: [...dies] }).then(() => setDesat(true))
          }
        >
          {t.app.desar}
        </Boto>
        {desat && <span role="status">{a.desat}</span>}
      </div>
    </section>
  )
}
