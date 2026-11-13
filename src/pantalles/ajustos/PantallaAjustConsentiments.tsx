// Ajustos > Consentiments (etapa 4A): les plantilles de cada tipus amb les
// seves versions. La que és esborrany o pendent de revisió s'edita; en
// aprovar-la es crea una versió nova que ja no es pot editar (i és la que es fa
// signar). Per canviar-ne una d'aprovada, «Editar» crea un esborrany nou.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { aprovadaDe, editableDe, TIPUS_CONSENTIMENT, versionsDe, type Plantilla } from '../../domini/consentiment'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const c = t.consentiments

export function PantallaAjustConsentiments() {
  const magatzem = useMagatzem()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(() => magatzem.plantillesConsentiment(), [magatzem, versio])
  const recarregar = () => setVersio((n) => n + 1)
  return (
    <main className="pantalla pantalla-ajust-consentiments">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{c.titol}</h1>
      <p className="detall">{c.ajustDesc}</p>
      {carrega.estat !== 'llest' ? (
        <Indicador text={t.app.carregant} />
      ) : (
        TIPUS_CONSENTIMENT.map((tipus) => {
          const versions = versionsDe(carrega.dades, tipus)
          const editable = editableDe(carrega.dades, tipus)
          const aprovada = aprovadaDe(carrega.dades, tipus)
          return (
            <section key={tipus} className="panell plantilla-consentiment" aria-label={c.tipus[tipus]}>
              <h2>{c.tipus[tipus]}</h2>
              {editable ? (
                <EditorPlantilla key={editable.id + editable.modificatAt} plantilla={editable} onCanviada={recarregar} />
              ) : (
                aprovada && (
                  <div className="accions accions-esquerra">
                    <Boto variant="secundari" onClick={() => void magatzem.nouEsborranyPlantilla(aprovada.id).then(recarregar)}>
                      {c.editarNova}
                    </Boto>
                    <Boto variant="discret" onClick={() => void magatzem.retirarPlantilla(aprovada.id).then(recarregar)}>
                      {c.retirar}
                    </Boto>
                  </div>
                )
              )}
              <h3>{c.versions}</h3>
              <ul className="versions-plantilla">
                {versions.map((p) => (
                  <li key={p.id} className={`versio-${p.estat}`}>
                    {formatar(c.versioCurta, { n: String(p.versio), estat: c.estatsPlantilla[p.estat], dia: new Date(p.data).toLocaleDateString('ca') })}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </main>
  )
}

function EditorPlantilla({ plantilla, onCanviada }: { plantilla: Plantilla; onCanviada(): void }) {
  const magatzem = useMagatzem()
  const [titol, setTitol] = useState(plantilla.titol)
  const [text, setText] = useState(plantilla.text)
  const [estat, setEstat] = useState(plantilla.estat)
  const [desada, setDesada] = useState(false)
  const { id: _i, creatAt: _c, modificatAt: _m, ...dades } = plantilla
  const desar = () => magatzem.desarPlantilla(plantilla.id, { ...dades, titol, text, estat })
  return (
    <div className="formulari editor-plantilla">
      {plantilla.nota && (
        <p className="avis-suau" role="note">
          {plantilla.nota}
        </p>
      )}
      <p className="detall">
        {formatar(c.versioCurta, { n: String(plantilla.versio), estat: c.estatsPlantilla[plantilla.estat], dia: new Date(plantilla.data).toLocaleDateString('ca') })}
      </p>
      <Camp etiqueta={c.titolPlantilla}>
        <input value={titol} onChange={(e) => setTitol(e.target.value)} />
      </Camp>
      <Camp etiqueta={c.textPlantilla} ample>
        <textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} />
      </Camp>
      <Camp etiqueta={c.estatPlantilla}>
        <select value={estat} onChange={(e) => setEstat(e.target.value as typeof estat)}>
          {(['esborrany', 'pendent'] as const).map((x) => (
            <option key={x} value={x}>
              {c.estatsPlantilla[x]}
            </option>
          ))}
        </select>
      </Camp>
      <div className="accions accions-esquerra">
        <Boto
          variant="secundari"
          onClick={() =>
            void desar().then(() => {
              setDesada(true)
              onCanviada()
            })
          }
        >
          {c.desarPlantilla}
        </Boto>
        <Boto onClick={() => void desar().then(() => magatzem.aprovarPlantilla(plantilla.id)).then(onCanviada)}>{c.aprovar}</Boto>
        {desada && <span role="status">{c.desada}</span>}
      </div>
    </div>
  )
}
