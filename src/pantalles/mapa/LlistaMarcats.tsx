// Punts marcats de la sessió: els del cos i els de l'orella en una sola
// llista (com sortiran a la sessió i a l'historial a l'etapa 3).

import { Boto } from '../../components/Boto'
import { COLOR_TECNICA, type PuntMarcat } from '../../domini/puntMarcat'
import { nomTecnica } from './tecniques'
import { t } from '../../i18n/t'
import { puntOrella } from '../../orella/cataleg'
import { cataleg } from '../../punts/cataleg'

interface Props {
  marcats: readonly PuntMarcat[]
  onVeure(m: PuntMarcat): void
  onTreure(m: PuntMarcat): void
}

export function LlistaMarcats({ marcats, onVeure, onTreure }: Props) {
  return (
    <section>
      <h2>{t.mapa.marcats}</h2>
      {marcats.length === 0 && <p className="detall">{t.mapa.capMarcat}</p>}
      <ul className="llista-marcats" aria-label={t.mapa.marcats}>
        {marcats.map((m) => {
          const nom =
            m.mapa === 'orella' ? puntOrella(m.codi)?.nom : cataleg.punts.find((x) => x.codi === m.codi)?.pinyin
          return (
            <li key={`${m.mapa}|${m.codi}`}>
              <span className="punt-color" style={{ background: COLOR_TECNICA[m.tecnica] }} />
              <span className="codi">{m.codi}</span>
              <span className="pinyin">{nom}</span>
              <span className="detall">
                {m.mapa === 'orella' ? `${t.orella.titol} · ` : ''}
                {t.mapa.costat[m.costat]} · {nomTecnica(m)}
              </span>
              <Boto variant="discret" onClick={() => onVeure(m)}>
                {t.mapa.veure}
              </Boto>
              <Boto variant="discret" onClick={() => onTreure(m)}>
                {t.mapa.treure}
              </Boto>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
