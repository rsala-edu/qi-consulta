// «És la mateixa persona: ajuntar les fitxes» (part 2).
//
// /pacients/:id/ajuntar           → triar l'altra fitxa
// /pacients/:id/ajuntar/:altreId  → comparació a dues columnes i confirmar
//
// Per defecte es queda la fitxa des d'on s'ha vingut (`:id`); «Que es quedi
// l'altra» ho intercanvia.

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Boto } from '../../components/Boto'
import { Indicador } from '../../components/Indicador'
import { citesRepetides, compararFitxes, dadesAjuntades, type CampComparat, type Costat } from '../../domini/ajuntar'
import { cercarPacients } from '../../domini/cercaPacients'
import { nomComplet, type Pacient } from '../../domini/pacient'
import type { InformeAjuntament } from '../../db/magatzem'
import { diaLlarg, formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const a = t.ajuntar

/** El que es passa a la fitxa que es queda per mostrar-ho en arribar-hi */
export interface EstatAjuntades {
  ajuntades: InformeAjuntament
}

export function PantallaAjuntar() {
  const { id = '', altreId } = useParams()
  return altreId ? <Comparacio id={id} altreId={altreId} /> : <TriarAltra id={id} />
}

function TriarAltra({ id }: { id: string }) {
  const magatzem = useMagatzem()
  const [carrega] = useCarrega(() => magatzem.llistarPacients(), [magatzem])
  const [consulta, setConsulta] = useState('')
  if (carrega.estat !== 'llest') return <main className="pantalla">{carrega.estat === 'carregant' && <Indicador text={t.app.carregant} />}</main>
  const aquest = carrega.dades.find((p) => p.id === id)
  if (!aquest) return <main className="pantalla"><p role="alert">{t.pacients.sensePacient}</p></main>
  // Sense cerca: primer les fitxes més semblants (llinatges, data de naixement, telèfon, nom)
  const semblanca = (p: Pacient) => {
    const igual = (x: string, y: string) => x !== '' && x.trim().toLowerCase() === y.trim().toLowerCase()
    return (
      (igual(p.llinatges, aquest.llinatges) ? 2 : 0) +
      (igual(p.dataNaixement, aquest.dataNaixement) ? 2 : 0) +
      (igual(p.telefon.replace(/\s/g, ''), aquest.telefon.replace(/\s/g, '')) ? 2 : 0) +
      (igual(p.nom, aquest.nom) ? 1 : 0)
    )
  }
  const trobats = cercarPacients(
    carrega.dades.filter((p) => p.id !== id),
    consulta,
  )
  const altres = consulta ? trobats : [...trobats].sort((x, y) => semblanca(y) - semblanca(x))
  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to={`/pacients/${id}/dades`}>
        ← {nomComplet(aquest)}
      </Link>
      <h1>{a.titol}</h1>
      <p>{formatar(a.triarAltra, { nom: nomComplet(aquest) })}</p>
      <div className="barra-cerca">
        <input type="search" aria-label={a.cercar} placeholder={a.cercar} value={consulta} onChange={(e) => setConsulta(e.target.value)} autoComplete="off" />
      </div>
      {altres.length === 0 && <p className="buit">{a.capAltra}</p>}
      <ul className="llista-pacients" aria-label={a.titol}>
        {altres.map((p) => (
          <li key={p.id}>
            <Link to={`/pacients/${id}/ajuntar/${p.id}`}>
              <span className="nom">{nomComplet(p)}</span>
              <span className="detall">{[p.dataNaixement, p.telefon].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}

const etiquetaCamp = (c: CampComparat): string => {
  if (c.grup === 'pacient') return t.camps.pacient[c.camp as keyof typeof t.camps.pacient]
  const f = t.camps.fitxaClinica
  const [grup, sub] = c.camp.split('.') as [string, string | undefined]
  if (!sub) return f[grup as keyof typeof f]
  if (sub === 'altres') return f.altresContraindicacions
  return `${f[grup as keyof typeof f]} · ${f[sub as keyof typeof f]}`
}

const mostrar = (c: CampComparat, v: string | boolean): string => {
  if (typeof v === 'boolean') return v ? a.si : '—'
  if (c.camp === 'sexe') return t.camps.sexes[v as keyof typeof t.camps.sexes]
  return v === '' ? a.buit : v
}

function Comparacio({ id, altreId }: { id: string; altreId: string }) {
  const magatzem = useMagatzem()
  const navegar = useNavigate()
  const [intercanviat, setIntercanviat] = useState(false)
  const [tries, setTries] = useState<Record<string, Costat>>({})
  const [ajuntant, setAjuntant] = useState(false)
  const [error, setError] = useState(false)
  const quedaId = intercanviat ? altreId : id
  const treuId = intercanviat ? id : altreId

  const [carrega] = useCarrega(async () => {
    const fitxa = async (pid: string) => {
      const p = await magatzem.obtenirPacient(pid)
      if (!p) return null
      const cites = await magatzem.citesDelPacient(pid)
      return {
        pacient: p,
        dades: await magatzem.dadesPerAjuntar(pid),
        cites,
        episodis: (await magatzem.llistarEpisodis(pid)).length,
        sessions: await magatzem.sessionsDelPacient(pid),
      }
    }
    const [q, tr] = await Promise.all([fitxa(quedaId), fitxa(treuId)])
    if (!q || !tr) return null
    let addendes = 0
    for (const s of tr.sessions) addendes += (await magatzem.addendesDe(s.id)).length
    return { q, tr, addendes }
  }, [magatzem, quedaId, treuId])

  const llest = carrega.estat === 'llest' ? carrega.dades : null
  const camps = useMemo(() => (llest ? compararFitxes(llest.q.dades, llest.tr.dades) : []), [llest])

  if (carrega.estat === 'carregant') return <main className="pantalla"><Indicador text={t.app.carregant} /></main>
  if (!llest) return <main className="pantalla"><p role="alert">{t.pacients.sensePacient}</p></main>
  const { q, tr, addendes } = llest
  const repetides = citesRepetides(q.cites, tr.cites).length

  const iguals = camps.filter((c) => c.estat === 'igual' && c.queda !== '' && c.queda !== false)
  const nomesUna = camps.filter((c) => c.estat === 'nomesQueda' || c.estat === 'nomesTreu')
  const diferents = camps.filter((c) => c.estat === 'diferent')

  async function confirmar() {
    setAjuntant(true)
    setError(false)
    try {
      const informe = await magatzem.ajuntarPacients(quedaId, treuId, dadesAjuntades(camps, tries))
      void navegar(`/pacients/${quedaId}/dades`, { state: { ajuntades: informe } satisfies EstatAjuntades })
    } catch {
      setError(true)
      setAjuntant(false)
    }
  }

  const columna = (x: typeof q, titol: string) => (
    <div className="columna-ajuntar">
      <p className="etiqueta">{titol}</p>
      <h2>{nomComplet(x.pacient)}</h2>
      <p className="detall">{formatar(a.creada, { dia: diaLlarg(x.pacient.creatAt.slice(0, 10)) })}</p>
      <p className="detall">
        {formatar(a.resumFitxa, { cites: String(x.cites.length), sessions: String(x.sessions.length) })}
      </p>
    </div>
  )

  return (
    <main className="pantalla pantalla-ajuntar">
      <Link className="enllac-tornar" to={`/pacients/${id}/dades`}>
        ← {nomComplet(q.pacient.id === id ? q.pacient : tr.pacient)}
      </Link>
      <h1>{a.titol}</h1>
      <p>{a.explicacio}</p>

      <div className="dues-columnes" aria-label={a.titol}>
        {columna(q, a.esQueda)}
        {columna(tr, a.sHiAjunta)}
      </div>
      <p className="accions accions-esquerra">
        <Boto
          variant="discret"
          onClick={() => {
            setIntercanviat((x) => !x)
            setTries({})
          }}
        >
          {a.intercanviar}
        </Boto>
      </p>

      {diferents.length > 0 && (
        <section aria-label={a.diferents}>
          <h2>{a.diferents}</h2>
          {diferents.map((c) => {
            const clau = `${c.grup}:${c.camp}`
            const triat = tries[clau] ?? c.perDefecte
            return (
              <fieldset key={clau} className="camp-ajuntar">
                <legend>{etiquetaCamp(c)}</legend>
                <div className="dues-columnes">
                  {(['queda', 'treu'] as const).map((costat) => (
                    <label key={costat} className="opcio-ajuntar">
                      <input
                        type="radio"
                        name={clau}
                        checked={triat === costat}
                        onChange={() => setTries((x) => ({ ...x, [clau]: costat }))}
                      />
                      <span>{mostrar(c, c[costat])}</span>
                      {c.perDefecte === costat && <span className="detall"> ({a.mesRecent})</span>}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </section>
      )}

      {nomesUna.length > 0 && (
        <section aria-label={a.nomesUna}>
          <h2>{a.nomesUna}</h2>
          <dl className="camps-ajuntar">
            {nomesUna.map((c) => (
              <div key={`${c.grup}:${c.camp}`} className={`dues-columnes ${c.estat}`}>
                <dt>{etiquetaCamp(c)}</dt>
                <dd>{mostrar(c, c.estat === 'nomesQueda' ? c.queda : c.treu)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-label={a.iguals}>
        <h2>{a.iguals}</h2>
        {iguals.length === 0 && <p className="buit">{a.capIgual}</p>}
        <dl className="camps-ajuntar">
          {iguals.map((c) => (
            <div key={`${c.grup}:${c.camp}`}>
              <dt>{etiquetaCamp(c)}</dt>
              <dd>{mostrar(c, c.queda)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="resum-ajuntar" role="note">
        <p>
          {formatar(a.esMouran, {
            nom: nomComplet(q.pacient),
            cites: String(tr.cites.length - (repetides > 0 ? repetidesDeTreu(q.cites, tr.cites) : 0)),
            episodis: String(tr.episodis),
            sessions: String(tr.sessions.length),
            addendes: String(addendes),
          })}
        </p>
        {repetides > 0 && <p>{formatar(a.repetidesAvis, { n: String(repetides) })}</p>}
      </div>
      {error && <p role="alert">{a.error}</p>}
      <div className="accions">
        <Boto onClick={() => void confirmar()} disabled={ajuntant}>
          {ajuntant ? a.ajuntant : a.confirmar}
        </Boto>
      </div>
    </main>
  )
}

/** Quantes de les cites repetides que es treuen són de la fitxa que s'hi ajunta */
function repetidesDeTreu(queden: Parameters<typeof citesRepetides>[0], venen: Parameters<typeof citesRepetides>[1]): number {
  const ids = new Set(venen.map((c) => c.id))
  return citesRepetides(queden, venen).filter((r) => ids.has(r.treure.id)).length
}

/** Avís a la fitxa arxivada: «Ajuntada amb …» i «Desfer» (30 dies) */
export function AvisAjuntada({ pacient, onDesfet }: { pacient: Pacient; onDesfet(): void }) {
  const magatzem = useMagatzem()
  const aj = pacient.ajuntadaAmb
  const [carrega] = useCarrega(async () => (aj ? magatzem.obtenirPacient(aj.pacientId) : undefined), [magatzem, aj?.pacientId])
  const [desfent, setDesfent] = useState(false)
  if (!aj || aj.desfetAt !== null) return null
  const altre = carrega.estat === 'llest' ? carrega.dades : undefined
  const nom = altre ? nomComplet(altre) : '…'
  const finsA = new Date(Date.parse(aj.at) + 30 * 24 * 3600 * 1000)
  const potDesfer = Date.now() < finsA.getTime()
  const dia = (d: Date) => diaLlarg(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  return (
    <div className="avis avis-ajuntada" role="note">
      <p>
        <span className="etiqueta">{t.pacients.ajuntada}</span> {formatar(a.ajuntadaAmb, { nom, dia: dia(new Date(aj.at)) })}
      </p>
      <p className="accions accions-esquerra">
        {altre && <Link to={`/pacients/${altre.id}/dades`}>{formatar(a.veureFitxa, { nom })}</Link>}
        {potDesfer && (
          <Boto
            variant="discret"
            disabled={desfent}
            onClick={async () => {
              if (!window.confirm(a.confirmarDesfer)) return
              setDesfent(true)
              try {
                await magatzem.desferAjuntament(pacient.id)
                onDesfet()
              } finally {
                setDesfent(false)
              }
            }}
          >
            {formatar(a.desfer, { dia: `${finsA.getDate()} ${t.dates.mesos[finsA.getMonth()]}` })}
          </Boto>
        )}
      </p>
    </div>
  )
}
