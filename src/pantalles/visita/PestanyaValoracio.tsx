// Pestanya «Valoració» de la visita (etapa 3B): motiu de consulta, anamnesi i
// constitució. Es fa a la primera visita de l'episodi; a les de seguiment es
// veu la darrera versió i es pot revisar (cosa que en fa una versió nova).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Boto } from '../../components/Boto'
import { RevisioConflictes } from '../../components/RevisioConflictes'
import { GrupCataleg, type Especials } from '../../cataleg/components/Cataleg'
import { etiquetaCami } from '../../cataleg/index'
import type { AjustosCatalegs } from '../../cataleg/motor'
import type { Grup } from '../../cataleg/tipus'
import type { CampEnConflicte } from '../../db/magatzem'
import type { Sessio } from '../../domini/sessio'
import { novaValoracio, type DadesValoracio, type Valoracio } from '../../domini/valoracio'
import { dataHora, formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { ambValor } from '../../sincronia/fusioCamps'
import { useAutodesat } from './useAutodesat'

const v = t.valoracio

const dadesDe = (x: Valoracio): DadesValoracio => {
  const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...d } = x
  return d
}

export function PestanyaValoracio({
  sessio,
  valoracions,
  conflictes,
  grups,
  ajustos,
  sexe,
  editableSessio,
  especials,
  onRecarregar,
  onDades,
}: {
  sessio: Sessio
  valoracions: readonly Valoracio[]
  conflictes: readonly CampEnConflicte[]
  grups: readonly Grup[]
  ajustos: AjustosCatalegs
  sexe?: string
  editableSessio: boolean
  especials?: Especials
  onRecarregar(): void
  /** El que hi ha ara a la valoració (per a l'avís d'embaràs de la capçalera) */
  onDades?(d: DadesValoracio): void
}) {
  const magatzem = useMagatzem()
  const darrera = valoracions.at(-1)
  const [vista, setVista] = useState<number | null>(null)
  const mostrada = vista === null ? darrera : valoracions.find((x) => x.versio === vista)
  const esDarrera = !mostrada || mostrada === darrera
  // Es pot editar la versió que s'ha fet en aquesta sessió (o, a la primera visita, la primera)
  const propia = darrera ? darrera.sessioId === sessio.id : sessio.numero === 1
  const editable = editableSessio && esDarrera && propia
  // Estable entre renders: si canviés a cada render, es prendria per una versió nova arribada d'un altre dispositiu
  const [nova] = useState(() => novaValoracio(sessio.episodiId, 1, sessio.id))
  const base: DadesValoracio = useMemo(() => (mostrada ? dadesDe(mostrada) : nova), [mostrada, nova])

  // Una valoració nova es crea en el primer canvi; després, només es desa el que canvia
  const existeix = useRef(!!mostrada)
  const [creada, setCreada] = useState(!!mostrada)
  const { dades, setDades, desant, pendent } = useAutodesat<DadesValoracio>(
    base,
    async (d, inicial) => {
      const desada = dadesDe(await magatzem.desarValoracio(d, existeix.current ? inicial : undefined))
      existeix.current = true
      setCreada(true)
      return desada
    },
    editable,
  )
  useEffect(() => {
    if (mostrada) existeix.current = true
  }, [mostrada])
  useEffect(() => {
    if (esDarrera) onDades?.(dades)
  }, [dades, esDarrera, onDades])
  const [revisant, setRevisant] = useState(false)

  return (
    <div className="pestanya-valoracio">
      <div className="barra-valoracio">
        <p className="detall">
          {darrera
            ? formatar(v.versio, { n: String((mostrada ?? darrera).versio), quan: dataHora((mostrada ?? darrera).creadaAt) })
            : sessio.numero === 1
              ? v.primeraVisita
              : v.capValoracio}
          {editable && <span role="status"> · {desant ? t.visita.desant : pendent ? '' : darrera || creada ? t.visita.desat : ''}</span>}
        </p>
        {valoracions.length > 1 && (
          <label className="camp camp-en-linia">
            <span>{v.veureVersio}</span>
            <select value={vista ?? darrera!.versio} onChange={(e) => setVista(Number(e.target.value))}>
              {valoracions.map((x) => (
                <option key={x.id} value={x.versio}>
                  {formatar(v.versioCurta, { n: String(x.versio) })}
                </option>
              ))}
            </select>
          </label>
        )}
        {editableSessio && esDarrera && !propia && (
          <Boto
            variant="secundari"
            disabled={revisant}
            onClick={async () => {
              setRevisant(true)
              try {
                await magatzem.revisarValoracio(sessio.episodiId, sessio.id)
                setVista(null)
                onRecarregar()
              } finally {
                setRevisant(false)
              }
            }}
          >
            {darrera ? v.revisar : v.fer}
          </Boto>
        )}
      </div>

      {mostrada && (
        <RevisioConflictes
          conflictes={conflictes}
          etiquetes={Object.fromEntries(conflictes.map((c) => [c.camp, etiquetaCami(c.camp) ?? c.camp]))}
          onQuedar={async (c) => {
            await magatzem.resoldreConflicte(c.conflicteId, c.camp)
            onRecarregar()
          }}
          onRecuperar={async (c) => {
            setDades((d) => ambValor(d as never, c.camp, c.valor) as unknown as DadesValoracio)
            await magatzem.resoldreConflicte(c.conflicteId, c.camp)
            onRecarregar()
          }}
        />
      )}

      {(mostrada || editable) &&
        grups.map((g) => (
          <GrupCataleg
            key={g.id}
            grup={g}
            ambTitol
            seccions={dades.seccions}
            onCanviar={(seccions) => setDades((d) => ({ ...d, seccions }))}
            ajustos={ajustos}
            context={{ sexe }}
            editable={editable}
            especials={especials}
          />
        ))}
    </div>
  )
}
