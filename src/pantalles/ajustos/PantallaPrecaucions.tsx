// Ajustos → Precaucions per revisar: la doctora confirma les precaucions per
// categories (embaràs, grans vasos, ull…). Dins de cada categoria pot
// desplegar la llista de punts i fer una excepció per a un punt concret.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { formatar, t } from '../../i18n/t'
import { usePrecaucions } from '../../mapa/usePrecaucions'
import { ambPrecaucions, cataleg, nomMeridia, puntsDeCategoria } from '../../punts/cataleg'
import { CATEGORIES_PRECAUCIO, type CategoriaPrecaucio } from '../../punts/esquema'

export function PantallaPrecaucions() {
  const { revisio, confirmar, tornarAPendent, desarExcepcio, treureExcepcio } = usePrecaucions()
  const [oberta, setOberta] = useState<CategoriaPrecaucio | null>(null)
  const [editant, setEditant] = useState<string | null>(null)
  const [nota, setNota] = useState('')
  const [categories, setCategories] = useState<CategoriaPrecaucio[]>([])

  if (revisio === null)
    return (
      <main className="pantalla">
        <Indicador text={t.app.carregant} />
      </main>
    )

  const efectiu = ambPrecaucions(cataleg, revisio)
  const perCodi = new Map(efectiu.punts.map((p) => [p.codi, p]))
  const excepcions = new Set(revisio.excepcions.map((e) => e.codi))
  const ambPunts = CATEGORIES_PRECAUCIO.filter((c) => puntsDeCategoria(cataleg, c, revisio).length > 0)
  const confirmades = ambPunts.filter((c) => revisio.categories.includes(c)).length

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{t.precaucions.titol}</h1>
      <p className="detall">{t.precaucions.intro}</p>
      <p role="status">{formatar(t.precaucions.progres, { n: String(confirmades), total: String(ambPunts.length) })}</p>
      <ul className="llista-precaucions" aria-label={t.precaucions.titol}>
        {ambPunts.map((cat) => {
          const nom = t.precaucions.categories[cat]
          const confirmada = revisio.categories.includes(cat)
          const punts = puntsDeCategoria(cataleg, cat, revisio)
          const desplegada = oberta === cat
          return (
            <li key={cat} className={confirmada ? 'confirmada' : ''} aria-label={nom}>
              <div className="capcalera-precaucio">
                <span className="codi">{nom}</span>
                <span className="etiqueta">{confirmada ? t.precaucions.confirmada : t.precaucions.pendent}</span>
              </div>
              <p>{t.precaucions.descripcions[cat]}</p>
              <div className="accions accions-esquerra">
                {confirmada ? (
                  <Boto variant="discret" onClick={() => void tornarAPendent(cat)}>
                    {t.precaucions.tornarAPendent}
                  </Boto>
                ) : (
                  <Boto onClick={() => void confirmar(cat)}>{t.precaucions.dacord}</Boto>
                )}
                <Boto variant="secundari" aria-expanded={desplegada} onClick={() => setOberta(desplegada ? null : cat)}>
                  {formatar(desplegada ? t.precaucions.amagarPunts : t.precaucions.veurePunts, { n: String(punts.length) })}
                </Boto>
              </div>

              {desplegada && (
                <ul className="punts-categoria" aria-label={formatar(t.precaucions.puntsDe, { categoria: nom })}>
                  {punts.map((original) => {
                    const p = perCodi.get(original.codi)!
                    const clau = `${cat}-${p.codi}`
                    const teExcepcio = excepcions.has(p.codi)
                    const altres = p.precaucions.categories.filter((x) => x !== cat)
                    return (
                      <li key={p.codi} aria-label={p.codi}>
                        <div className="capcalera-precaucio">
                          <span className="codi">{p.codi}</span>
                          <span className="pinyin">
                            {p.pinyin} · {nomMeridia(efectiu, p.meridia)}
                          </span>
                          {teExcepcio && <span className="etiqueta">{t.precaucions.excepcio}</span>}
                        </div>
                        {teExcepcio && !p.precaucions.categories.includes(cat) && (
                          <p className="detall">{t.precaucions.foraDeCategoria}</p>
                        )}
                        {altres.length > 0 && (
                          <p className="detall">
                            {t.precaucions.tambe}: {altres.map((x) => t.precaucions.categories[x]).join(' · ')}
                          </p>
                        )}
                        {editant !== clau && (
                          <>
                            {p.precaucions.nota && <p>{p.precaucions.nota}</p>}
                            <div className="accions accions-esquerra">
                              <Boto
                                variant="secundari"
                                onClick={() => {
                                  setEditant(clau)
                                  setNota(p.precaucions.nota)
                                  setCategories(p.precaucions.categories)
                                }}
                              >
                                {teExcepcio ? t.precaucions.canviarExcepcio : t.precaucions.ferExcepcio}
                              </Boto>
                              {teExcepcio && (
                                <Boto variant="discret" onClick={() => void treureExcepcio(p.codi)}>
                                  {t.precaucions.treureExcepcio}
                                </Boto>
                              )}
                            </div>
                          </>
                        )}
                        {editant === clau && (
                          <form
                            className="formulari"
                            onSubmit={(e) => {
                              e.preventDefault()
                              void desarExcepcio(p.codi, { categories, nota }).then(() => setEditant(null))
                            }}
                          >
                            <div className="camp">
                              <label htmlFor={`nota-${clau}`}>{t.precaucions.text}</label>
                              <textarea id={`nota-${clau}`} rows={3} value={nota} onChange={(e) => setNota(e.target.value)} />
                            </div>
                            <fieldset className="casella-grup">
                              <legend>{t.precaucions.categoriesDelPunt}</legend>
                              {CATEGORIES_PRECAUCIO.map((x) => (
                                <label key={x} className="casella">
                                  <input
                                    type="checkbox"
                                    checked={categories.includes(x)}
                                    onChange={(e) =>
                                      setCategories((l) => (e.target.checked ? [...l, x] : l.filter((y) => y !== x)))
                                    }
                                  />
                                  {t.precaucions.categories[x]}
                                </label>
                              ))}
                            </fieldset>
                            <div className="accions accions-esquerra">
                              <Boto type="submit">{t.precaucions.desarExcepcio}</Boto>
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
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
