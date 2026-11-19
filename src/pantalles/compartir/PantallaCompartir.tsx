// «Compartir → Qi» (etapa 4E): els fitxers rebuts d'una altra app (la galeria,
// WhatsApp…). Un cop desbloquejada l'app, es tria el pacient (amb cerca) i,
// després, el tipus i la data; es desen xifrats com qualsevol document i
// s'esborren de la base de dades temporal. «Descartar» també els esborra.

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { DesarFitxers, triarFitxers } from '../../documents/AfegirDocuments'
import { comAFitxer, esborrarCompartits, llegirCompartits } from '../../documents/compartits'
import { episodisActius, nomEpisodi } from '../../domini/episodi'
import { nomComplet, type Pacient } from '../../domini/pacient'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const d = t.documents
const normal = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('ca')

export function PantallaCompartir() {
  const magatzem = useMagatzem()
  const navegar = useNavigate()
  const [carrega] = useCarrega(async () => {
    const [compartits, pacients] = await Promise.all([llegirCompartits(), magatzem.llistarPacients()])
    const { bons, errors } = await triarFitxers(compartits.map(comAFitxer))
    return { compartits, bons, errors, pacients: pacients.filter((p) => !p.arxivat) }
  }, [magatzem])
  const [cerca, setCerca] = useState('')
  const [pacient, setPacient] = useState<Pacient | null>(null)
  const [context, setContext] = useState<{ episodiId: string | null; episodis: { id: string; nom: string }[] } | null>(null)
  const [desats, setDesats] = useState<number | null>(null)

  const trobats = useMemo(() => {
    if (carrega.estat !== 'llest') return []
    const c = normal(cerca.trim())
    return carrega.dades.pacients.filter((p) => !c || normal(nomComplet(p)).includes(c)).slice(0, 20)
  }, [carrega, cerca])

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error') return <p role="alert">{t.app.errorInesperat}</p>
  const { compartits, bons, errors } = carrega.dades

  const triar = async (p: Pacient) => {
    const episodis = await magatzem.llistarEpisodis(p.id)
    setContext({
      episodiId: episodisActius(episodis)[0]?.id ?? null,
      episodis: [...episodis]
        .sort((a, b) => b.dataInici.localeCompare(a.dataInici))
        .map((e) => ({ id: e.id, nom: `${nomEpisodi(e) || d.episodi} · ${new Date(`${e.dataInici}T12:00:00`).toLocaleDateString('ca')}` })),
    })
    setPacient(p)
  }
  const descartar = async () => {
    await esborrarCompartits(compartits.map((c) => c.id))
    void navegar('/')
  }

  return (
    <main className="pantalla pantalla-compartir">
      <h1>{d.compartitTitol}</h1>
      {desats !== null && pacient ? (
        <div className="avis-suau avis-galeria" role="status">
          <p>
            {desats === 1 ? d.desat : formatar(d.desats, { n: String(desats) })} {d.avisGaleria}
          </p>
          <Link className="boto boto-secundari" to={`/pacients/${pacient.id}/documents`}>
            {d.titol}
          </Link>
        </div>
      ) : compartits.length === 0 ? (
        <p className="detall">{d.compartitCap}</p>
      ) : (
        <>
          <p className="detall">{d.compartitDesc}</p>
          <ul className="fitxers-triats" aria-label={d.fitxersTriats}>
            {compartits.map((c) => (
              <li key={c.id}>{c.nom}</li>
            ))}
          </ul>
          {errors.length > 0 && (
            <ul className="errors-fitxers" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <section className="panell" aria-label={d.triaPacient}>
            <Camp etiqueta={d.cercaPacient}>
              <input type="search" value={cerca} autoFocus onChange={(e) => setCerca(e.target.value)} />
            </Camp>
            {trobats.length === 0 ? (
              <p className="detall">{d.capPacient}</p>
            ) : (
              <ul className="llista-pacients-compartir">
                {trobats.map((p) => (
                  <li key={p.id}>
                    <Boto variant={pacient?.id === p.id ? 'principal' : 'secundari'} onClick={() => void triar(p)}>
                      {nomComplet(p)}
                    </Boto>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="accions accions-esquerra">
            <Boto variant="discret" onClick={() => void descartar()}>
              {d.descartar}
            </Boto>
          </div>
        </>
      )}
      {pacient && context && desats === null && bons.length > 0 && (
        <DesarFitxers
          context={{ pacientId: pacient.id, ...context }}
          triats={bons}
          origen="compartit"
          onCancellar={() => setPacient(null)}
          onDesats={(n) => {
            void esborrarCompartits(compartits.map((c) => c.id)).then(() => setDesats(n))
          }}
        />
      )}
    </main>
  )
}
