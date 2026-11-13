// Ajustos > Consulta (etapa 4D): les dades de la capçalera dels informes.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { desarAjustosConsulta, llegirAjustosConsulta, type AjustosConsulta } from '../../db/ajustosConsulta'
import { t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const i = t.informes

export function PantallaAjustConsulta() {
  const { db } = useSessio()
  const [carrega] = useCarrega(() => llegirAjustosConsulta(db), [db])
  return (
    <main className="pantalla pantalla-ajust-consulta">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{i.consultaTitol}</h1>
      <p className="detall">{i.consultaDesc}</p>
      {carrega.estat !== 'llest' ? <Indicador text={t.app.carregant} /> : <Formulari inicial={carrega.dades} onDesar={(a) => desarAjustosConsulta(db, a)} />}
    </main>
  )
}

function Formulari({ inicial, onDesar }: { inicial: AjustosConsulta; onDesar(a: AjustosConsulta): Promise<void> }) {
  const [a, setA] = useState(inicial)
  const [desat, setDesat] = useState(false)
  const camp = (k: keyof AjustosConsulta, etiqueta: string) => (
    <Camp etiqueta={etiqueta}>
      <input
        value={a[k]}
        onChange={(e) => {
          setA({ ...a, [k]: e.target.value })
          setDesat(false)
        }}
      />
    </Camp>
  )
  return (
    <div className="formulari">
      {camp('nom', i.nom)}
      {camp('doctora', i.doctora)}
      {camp('collegiada', i.collegiada)}
      {camp('adreca', i.adreca)}
      {camp('telefon', i.telefon)}
      <div className="accions accions-esquerra">
        <Boto onClick={() => void onDesar(a).then(() => setDesat(true))}>{i.desar}</Boto>
        {desat && <span role="status">{i.desat}</span>}
      </div>
    </div>
  )
}
