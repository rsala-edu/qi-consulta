import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { dadesDePacient, nomComplet } from '../../domini/pacient'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { FormulariPacient } from '../pacients/FormulariPacient'
import { useFitxaPacient } from './PantallaFitxaPacient'
import { RevisioConflictes } from '../../components/RevisioConflictes'
import type { CampEnConflicte } from '../../db/magatzem'
import { ambValor } from '../../sincronia/fusioCamps'
import { useCarrega } from '../../sessio/useCarrega'

export function PestanyaDades() {
  const magatzem = useMagatzem()
  const { pacient, actualitzarPacient } = useFitxaPacient()
  const [arxivant, setArxivant] = useState(false)
  const [recuperacions, setRecuperacions] = useState(0)
  const [carrega, substituir] = useCarrega(() => magatzem.conflictesDe(pacient.id), [magatzem, pacient.id])
  const conflictes = carrega.estat === 'llest' ? carrega.dades : []
  const resolt = async (c: CampEnConflicte) => {
    await magatzem.resoldreConflicte(c.conflicteId, c.camp)
    substituir(conflictes.filter((x) => !(x.conflicteId === c.conflicteId && x.camp === c.camp)))
  }

  const { id, arxivat } = pacient

  async function canviarArxiu() {
    if (!arxivat && !window.confirm(t.fitxa.confirmarArxivar)) return
    setArxivant(true)
    try {
      actualitzarPacient(await magatzem.arxivarPacient(id, !arxivat))
    } finally {
      setArxivant(false)
    }
  }

  return (
    <section>
      <AvisDuplicat />
      <RevisioConflictes
        conflictes={conflictes}
        etiquetes={t.camps.pacient}
        onQuedar={resolt}
        onRecuperar={async (c) => {
          const dades = ambValor(dadesDePacient(pacient), c.camp, c.valor) as ReturnType<typeof dadesDePacient>
          actualitzarPacient(await magatzem.actualitzarPacient(id, dades))
          setRecuperacions((n) => n + 1)
          await resolt(c)
        }}
      />
      <FormulariPacient
        // Es torna a muntar si es recupera una versió anterior d'un camp. Els
        // canvis d'un altre dispositiu els aplica el formulari mateix (només
        // als camps que no s'estan escrivint)
        key={`${id}|${recuperacions}`}
        valorsInicials={dadesDePacient(pacient)}
        esborrany={{
          clau: `pacient:${id}:dades`,
          descripcio: formatar(t.esborranys.dadesDe, { nom: nomComplet(pacient) }),
        }}
        onDesar={async (noves) => actualitzarPacient(await magatzem.actualitzarPacient(id, noves, dadesDePacient(pacient)))}
      />
      <div className="zona-arxiu">
        {!pacient.ajuntadaAmb || pacient.ajuntadaAmb.desfetAt !== null ? (
          <Link className="boto boto-discret" to={`/pacients/${id}/ajuntar`}>
            {t.ajuntar.ajuntarAmbAltra}
          </Link>
        ) : null}
        <Boto variant="discret" onClick={canviarArxiu} disabled={arxivant}>
          {arxivat ? t.fitxa.desarxivar : t.fitxa.arxivar}
        </Boto>
      </div>
    </section>
  )
}

/** Fitxa que pot ser la mateixa persona que una altra (dades de dos dispositius) */
function AvisDuplicat() {
  const magatzem = useMagatzem()
  const { pacient, actualitzarPacient } = useFitxaPacient()
  const ids = pacient.revisarDuplicat ?? []
  const [altres] = useCarrega(
    async () => (await Promise.all(ids.map((x) => magatzem.obtenirPacient(x)))).filter((x) => x !== undefined),
    [magatzem, ids.join('|')],
  )
  if (ids.length === 0) return null
  return (
    <div className="avis avis-duplicat" role="note">
      <p>
        <span className="etiqueta etiqueta-precaucio">{t.pacients.possibleDuplicat}</span> {t.pacients.avisDuplicat}
      </p>
      {altres.estat === 'llest' &&
        altres.dades.map((a) => (
          <p key={a.id} className="accions accions-esquerra">
            <Link to={`/pacients/${a.id}/dades`}>{formatar(t.pacients.veureAltra, { nom: nomComplet(a) })}</Link>
            <Link className="boto boto-secundari" to={`/pacients/${pacient.id}/ajuntar/${a.id}`}>
              {t.pacients.ajuntarAmbAquesta}
            </Link>
            <Boto
              variant="discret"
              onClick={() => void magatzem.descartarDuplicat(pacient.id, a.id).then(actualitzarPacient)}
            >
              {t.pacients.noEsLaMateixa}
            </Boto>
          </p>
        ))}
    </div>
  )
}
