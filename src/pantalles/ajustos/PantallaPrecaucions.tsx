// Ajustos → Precaucions per revisar: la doctora confirma cada precaució
// proposada («D'acord») o la reescriu («Canviar»).

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { formatar, t } from '../../i18n/t'
import { usePrecaucions } from '../../mapa/usePrecaucions'
import { ambPrecaucions, cataleg, nomMeridia, puntsAmbPrecaucio } from '../../punts/cataleg'

export function PantallaPrecaucions() {
  const { revisions, confirmar } = usePrecaucions()
  const [editant, setEditant] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [embaras, setEmbaras] = useState(false)

  const codis = puntsAmbPrecaucio(cataleg).map((p) => p.codi)
  const efectiu = ambPrecaucions(cataleg, revisions ?? [])
  const punts = efectiu.punts.filter((p) => codis.includes(p.codi))
  const confirmades = punts.filter((p) => p.precaucions.confirmada).length

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{t.precaucions.titol}</h1>
      <p className="detall">{t.precaucions.intro}</p>
      {revisions === null ? (
        <Indicador text={t.app.carregant} />
      ) : (
        <>
          <p role="status">{formatar(t.precaucions.progres, { n: String(confirmades), total: String(punts.length) })}</p>
          <ul className="llista-precaucions" aria-label={t.precaucions.titol}>
            {punts.map((p) => {
              const obert = editant === p.codi
              return (
                <li key={p.codi} className={p.precaucions.confirmada ? 'confirmada' : ''} aria-label={p.codi}>
                  <div className="capcalera-precaucio">
                    <span className="codi">{p.codi}</span>
                    <span className="pinyin">
                      {p.pinyin} · {nomMeridia(efectiu, p.meridia)}
                    </span>
                    <span className="etiqueta">
                      {p.precaucions.confirmada ? t.precaucions.confirmada : t.precaucions.pendent}
                    </span>
                  </div>
                  {!obert && (
                    <>
                      <p>
                        {p.precaucions.embaras && <strong>{t.mapa.precaucioEmbaras}. </strong>}
                        {p.precaucions.nota}
                      </p>
                      <div className="accions accions-esquerra">
                        <Boto
                          variant={p.precaucions.confirmada ? 'discret' : 'principal'}
                          disabled={p.precaucions.confirmada}
                          onClick={() => void confirmar(p.codi, p.precaucions)}
                        >
                          {t.precaucions.dacord}
                        </Boto>
                        <Boto
                          variant="secundari"
                          onClick={() => {
                            setEditant(p.codi)
                            setNota(p.precaucions.nota)
                            setEmbaras(p.precaucions.embaras)
                          }}
                        >
                          {t.precaucions.canviar}
                        </Boto>
                      </div>
                    </>
                  )}
                  {obert && (
                    <form
                      className="formulari"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void confirmar(p.codi, { embaras, nota }).then(() => setEditant(null))
                      }}
                    >
                      <div className="camp">
                        <label htmlFor={`nota-${p.codi}`}>{t.precaucions.text}</label>
                        <textarea id={`nota-${p.codi}`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
                      </div>
                      <label className="casella">
                        <input type="checkbox" checked={embaras} onChange={(e) => setEmbaras(e.target.checked)} />
                        {t.mapa.precaucioEmbaras}
                      </label>
                      <div className="accions accions-esquerra">
                        <Boto type="submit">{t.precaucions.desar}</Boto>
                        <Boto variant="discret" onClick={() => setEditant(null)}>
                          {t.app.cancellar}
                        </Boto>
                      </div>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </main>
  )
}
