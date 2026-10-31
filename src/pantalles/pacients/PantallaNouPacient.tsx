import { Link, useNavigate } from 'react-router'
import { dadesPacientBuides } from '../../domini/pacient'
import { t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { FormulariPacient } from './FormulariPacient'

export function PantallaNouPacient() {
  const magatzem = useMagatzem()
  const navegar = useNavigate()

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/pacients">
        ← {t.app.tornar}
      </Link>
      <h1>{t.pacients.titolNou}</h1>
      <FormulariPacient
        valorsInicials={dadesPacientBuides()}
        onDesar={async (dades) => {
          const p = await magatzem.crearPacient(dades)
          // Primera visita: després de les dades, la fitxa clínica
          navegar(`/pacients/${p.id}/fitxa-clinica`, { replace: true })
        }}
      />
    </main>
  )
}
