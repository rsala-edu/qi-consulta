// Ajustos > Catàlegs: amagar seccions, camps i opcions que no es facin servir
// i canviar-ne l'ordre. No s'esborra res: el que ja està desat en una visita
// es continua veient encara que s'amagui. Al final, d'on surt cada catàleg.

import { useState } from 'react'
import { Link } from 'react-router'
import { Indicador } from '../../components/Indicador'
import { xines } from '../../cataleg/components/Cataleg'
import { FONTS } from '../../cataleg/fonts'
import { GRUPS } from '../../cataleg/index'
import { clauCamp, clauOpcio, ordenar, type AjustosCatalegs } from '../../cataleg/motor'
import type { Camp, Grup, Opcio, Seccio } from '../../cataleg/tipus'
import { desarAjustosCatalegs, llegirAjustosCatalegs } from '../../db/ajustosCatalegs'
import { formatar, t } from '../../i18n/t'
import { useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const a = t.ajustCatalegs

/** Mou un id una posició amunt o avall dins l'ordre (partint de l'ordre que es veu) */
function moure(ids: readonly string[], id: string, pas: -1 | 1): string[] {
  const r = [...ids]
  const i = r.indexOf(id)
  const j = i + pas
  if (i < 0 || j < 0 || j >= r.length) return r
  ;[r[i], r[j]] = [r[j]!, r[i]!]
  return r
}

export function PantallaAjustCatalegs() {
  const { db } = useSessio()
  const [carrega, substituir] = useCarrega(() => llegirAjustosCatalegs(db), [db])
  const canviar = (nous: AjustosCatalegs) => {
    substituir(nous)
    void desarAjustosCatalegs(db, nous)
  }
  return (
    <main className="pantalla pantalla-ajust-catalegs">
      <Link className="enllac-tornar" to="/ajustos">
        ← {t.ajustos.titol}
      </Link>
      <h1>{a.titol}</h1>
      <p className="detall">{a.explicacio}</p>
      {carrega.estat !== 'llest' ? (
        <Indicador text={t.app.carregant} />
      ) : (
        <>
          {GRUPS.map((g) => (
            <AjustGrup key={g.id} grup={g} ajustos={carrega.dades} canviar={canviar} />
          ))}
          <section className="fonts-catalegs" aria-label={a.fonts}>
            <h2>{a.fonts}</h2>
            <ul>
              {Object.entries(FONTS).map(([id, f]) => (
                <li key={id}>
                  <strong>{f.titol}</strong>
                  <span>{f.detall}</span>
                  <span className="detall">
                    {a.llicencia}: {f.llicencia}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

function Visible({ clau, nom, ajustos, canviar }: { clau: string; nom: string; ajustos: AjustosCatalegs; canviar(a: AjustosCatalegs): void }) {
  const amagat = ajustos.amagats.includes(clau)
  return (
    <label className="casella">
      <input
        type="checkbox"
        checked={!amagat}
        aria-label={formatar(a.mostrar, { nom })}
        onChange={() =>
          canviar({ ...ajustos, amagats: amagat ? ajustos.amagats.filter((x) => x !== clau) : [...ajustos.amagats, clau] })
        }
      />
      {nom}
    </label>
  )
}

function Fletxes({ nom, onMoure, primer, darrer }: { nom: string; onMoure(pas: -1 | 1): void; primer: boolean; darrer: boolean }) {
  return (
    <span className="fletxes">
      <button type="button" className="boto boto-discret" aria-label={formatar(a.amunt, { nom })} disabled={primer} onClick={() => onMoure(-1)}>
        ↑
      </button>
      <button type="button" className="boto boto-discret" aria-label={formatar(a.avall, { nom })} disabled={darrer} onClick={() => onMoure(1)}>
        ↓
      </button>
    </span>
  )
}

function AjustGrup({ grup, ajustos, canviar }: { grup: Grup; ajustos: AjustosCatalegs; canviar(a: AjustosCatalegs): void }) {
  const seccions = ordenar(grup.seccions, ajustos.ordreSeccions[grup.id])
  const ids = seccions.map((s) => s.id)
  return (
    <section className="ajust-grup" aria-label={grup.ca}>
      <h2>{grup.ca}</h2>
      <ul className="llista-ajust">
        {seccions.map((s, i) => (
          <AjustSeccio
            key={s.id}
            seccio={s}
            ajustos={ajustos}
            canviar={canviar}
            primer={i === 0}
            darrer={i === seccions.length - 1}
            onMoure={(pas) => canviar({ ...ajustos, ordreSeccions: { ...ajustos.ordreSeccions, [grup.id]: moure(ids, s.id, pas) } })}
          />
        ))}
      </ul>
    </section>
  )
}

function AjustSeccio({
  seccio,
  ajustos,
  canviar,
  primer,
  darrer,
  onMoure,
}: {
  seccio: Seccio
  ajustos: AjustosCatalegs
  canviar(a: AjustosCatalegs): void
  primer: boolean
  darrer: boolean
  onMoure(pas: -1 | 1): void
}) {
  const [obert, setObert] = useState(false)
  const nom = seccio.ca
  return (
    <li className="ajust-seccio">
      <div className="fila-ajust">
        <Visible clau={seccio.id} nom={nom} ajustos={ajustos} canviar={canviar} />
        {(seccio.pinyin || seccio.hanzi) && <span className="xines">{xines(seccio)}</span>}
        <Fletxes nom={nom} onMoure={onMoure} primer={primer} darrer={darrer} />
        <button type="button" className="boto boto-discret" aria-expanded={obert} onClick={() => setObert((x) => !x)}>
          {obert ? a.amagarOpcions : a.veureOpcions}
        </button>
      </div>
      {obert && (
        <ul className="llista-ajust interna" aria-label={formatar(a.campsDe, { nom })}>
          {seccio.camps.map((c) => (
            <AjustCamp key={c.id} seccio={seccio} camp={c} ajustos={ajustos} canviar={canviar} />
          ))}
        </ul>
      )}
    </li>
  )
}

function AjustCamp({ seccio, camp, ajustos, canviar }: { seccio: Seccio; camp: Camp; ajustos: AjustosCatalegs; canviar(a: AjustosCatalegs): void }) {
  const clau = clauCamp(seccio, camp)
  const opcions: readonly Opcio[] = camp.tipus === 'simple' || camp.tipus === 'multiple' ? ordenar(camp.opcions, ajustos.ordreOpcions[clau]) : []
  const ids = opcions.map((x) => x.id)
  return (
    <li>
      <div className="fila-ajust">
        <Visible clau={clau} nom={camp.ca} ajustos={ajustos} canviar={canviar} />
      </div>
      {opcions.length > 0 && (
        <ul className="llista-ajust interna">
          {opcions.map((op, i) => (
            <li key={op.id} className="fila-ajust">
              <Visible clau={clauOpcio(seccio, camp, op)} nom={op.ca} ajustos={ajustos} canviar={canviar} />
              <Fletxes
                nom={op.ca}
                primer={i === 0}
                darrer={i === opcions.length - 1}
                onMoure={(pas) => canviar({ ...ajustos, ordreOpcions: { ...ajustos.ordreOpcions, [clau]: moure(ids, op.id, pas) } })}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
