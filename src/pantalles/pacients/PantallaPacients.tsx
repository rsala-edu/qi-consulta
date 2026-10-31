import { useState } from 'react'
import { Link } from 'react-router'
import { Indicador } from '../../components/Indicador'
import { cercarPacients } from '../../domini/cercaPacients'
import { nomComplet } from '../../domini/pacient'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

export function PantallaPacients() {
  const magatzem = useMagatzem()
  const [carrega] = useCarrega(() => magatzem.llistarPacients(), [magatzem])
  const [consulta, setConsulta] = useState('')
  const [incloureArxivats, setIncloureArxivats] = useState(false)

  const pacients = carrega.estat === 'llest' ? carrega.dades : []
  const resultats = cercarPacients(pacients, consulta, { incloureArxivats })

  return (
    <main className="pantalla">
      <div className="capcalera-pantalla">
        <h1>{t.pacients.titol}</h1>
        <Link className="boto boto-principal" to="/pacients/nou">
          {t.pacients.nou}
        </Link>
      </div>

      <div className="barra-cerca">
        <input
          type="search"
          aria-label={t.pacients.cercar}
          placeholder={t.pacients.cercar}
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          autoComplete="off"
        />
        <label className="casella">
          <input
            type="checkbox"
            checked={incloureArxivats}
            onChange={(e) => setIncloureArxivats(e.target.checked)}
          />
          {t.pacients.mostrarArxivats}
        </label>
      </div>

      {carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}
      {carrega.estat === 'error' && <p role="alert">{t.app.errorInesperat}</p>}
      {carrega.estat === 'llest' && (
        <>
          {pacients.length === 0 && <p className="buit">{t.pacients.cap}</p>}
          {pacients.length > 0 && resultats.length === 0 && <p className="buit">{t.pacients.capResultat}</p>}
          <ul className="llista-pacients" aria-label={t.pacients.titol}>
            {resultats.map((p) => (
              <li key={p.id}>
                <Link to={`/pacients/${p.id}`}>
                  <span className="nom">{nomComplet(p)}</span>
                  <span className="detall">{p.telefon}</span>
                  {p.arxivat && <span className="etiqueta">{t.pacients.arxivat}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
