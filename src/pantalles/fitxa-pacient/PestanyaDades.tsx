import { useState } from 'react'
import { Boto } from '../../components/Boto'
import { dadesDePacient, nomComplet } from '../../domini/pacient'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { FormulariPacient } from '../pacients/FormulariPacient'
import { useFitxaPacient } from './PantallaFitxaPacient'

export function PestanyaDades() {
  const magatzem = useMagatzem()
  const { pacient, actualitzarPacient } = useFitxaPacient()
  const [arxivant, setArxivant] = useState(false)

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
      <FormulariPacient
        key={id}
        valorsInicials={dadesDePacient(pacient)}
        esborrany={{
          clau: `pacient:${id}:dades`,
          descripcio: formatar(t.esborranys.dadesDe, { nom: nomComplet(pacient) }),
        }}
        onDesar={async (noves) => actualitzarPacient(await magatzem.actualitzarPacient(id, noves))}
      />
      <div className="zona-arxiu">
        <Boto variant="discret" onClick={canviarArxiu} disabled={arxivant}>
          {arxivat ? t.fitxa.desarxivar : t.fitxa.arxivar}
        </Boto>
      </div>
    </section>
  )
}
