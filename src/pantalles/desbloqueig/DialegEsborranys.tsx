import { Boto } from '../../components/Boto'
import { dataHora, formatar, t } from '../../i18n/t'
import { useEsborranys } from '../../sessio/ContextEsborranys'

/** En desbloquejar, ofereix recuperar els formularis que no es van desar. */
export function DialegEsborranys() {
  const { pendents, recuperar, descartar, tancarAvis } = useEsborranys()
  if (!pendents || pendents.length === 0) return null

  return (
    <div className="fons-dialeg">
      <div className="dialeg" role="dialog" aria-modal="true" aria-labelledby="titol-esborranys">
        <h2 id="titol-esborranys">{t.esborranys.titol}</h2>
        <p>{t.esborranys.intro}</p>
        <ul className="llista-esborranys">
          {pendents.map((e) => (
            <li key={e.clau}>
              <div>
                <div className="nom">{e.descripcio}</div>
                <div className="detall">{formatar(t.esborranys.darrerCanvi, { data: dataHora(e.modificatAt) })}</div>
              </div>
              <div className="botons">
                <Boto variant="discret" onClick={() => void descartar(e)} aria-label={`${t.esborranys.descartar}: ${e.descripcio}`}>
                  {t.esborranys.descartar}
                </Boto>
                <Boto onClick={() => recuperar(e)} aria-label={`${t.esborranys.recuperar}: ${e.descripcio}`}>
                  {t.esborranys.recuperar}
                </Boto>
              </div>
            </li>
          ))}
        </ul>
        <div className="accions">
          <Boto variant="secundari" onClick={tancarAvis}>
            {t.esborranys.araNo}
          </Boto>
        </div>
      </div>
    </div>
  )
}
