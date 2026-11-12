// Formulari d'una cita (nova o existent): pacient, dia, hora, durada, estat,
// motiu i notes. El tipus (primera visita o seguiment) es calcula sol; la
// casella «Nou episodi» en fa una primera visita. Avisa si se solapa amb una
// altra cita, si és fora d'horari i si l'hora ja ha passat (llavors es
// registra com a visita ja feta).

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { Episodi } from '../../domini/episodi'
import { useFormulariBrut } from '../../sincronia/revisio'
import { z } from 'zod'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { avisHorari, hhmm, type Horari } from '../../domini/agenda'
import { cercarPacients, pacientsRecents } from '../../domini/cercaPacients'
import {
  DURADA_PER_DEFECTE,
  horaPassada,
  ESTATS_CITA,
  esquemaDadesCita,
  solapaments,
  type Cita,
  type DadesCita,
  type TipusCita,
} from '../../domini/cita'
import { tipusCalculats } from '../../domini/tipusVisita'
import { dadesPacientBuides, esquemaDadesPacient, nomComplet, type Pacient } from '../../domini/pacient'
import { formatar, hora as horaDe, t } from '../../i18n/t'

const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

const esquemaFormulari = esquemaDadesCita.omit({ inici: true, sessioId: true }).extend({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.errors.dataInvalida),
  hora: z.string().regex(/^\d{2}:\d{2}$/, t.errors.horaInvalida),
  nouEpisodi: z.boolean(),
  episodiId: z.string().nullable(),
})

type ValorsFormulari = z.infer<typeof esquemaFormulari>

interface Props {
  inicial: DadesCita
  /** Si és una cita que ja existeix */
  id?: string
  pacients: readonly Pacient[]
  /** A la fitxa del pacient el pacient no es pot canviar */
  pacientFix?: boolean
  /** Les altres cites, per avisar dels solapaments */
  altres: readonly Cita[]
  onDesar(dades: DadesCita): Promise<void>
  onCancellar(): void
  onEsborrar?(): Promise<void>
  onCrearPacient?(nom: string, telefon: string): Promise<Pacient>
  /** Per avisar (sense impedir-ho) d'una cita en un dia tancat o fora d'horari */
  horari?: Horari
  diesTancats?: ReadonlySet<string>
  /** L'hora actual (per a les proves) */
  ara?: Date
  /** Els episodis actius d'un pacient: si n'hi ha més d'un, la cita deixa triar a quin va */
  carregarEpisodis?(pacientId: string): Promise<readonly Pick<Episodi, 'id' | 'motiu'>[]>
}

export function FormulariCita({
  inicial,
  id,
  pacients,
  pacientFix = false,
  altres,
  onDesar,
  onCancellar,
  onEsborrar,
  onCrearPacient,
  horari,
  diesTancats = new Set<string>(),
  ara: araProp,
  carregarEpisodis,
}: Props) {
  // L'hora d'obrir el formulari
  const [araObrir] = useState(() => new Date())
  const ara = araProp ?? araObrir
  const c = t.cites
  const [nous, setNous] = useState<Pacient[]>([])
  const tots = [...pacients, ...nous]
  const [errorDesar, setErrorDesar] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, dirtyFields, isDirty },
  } = useForm<ValorsFormulari>({
    resolver: zodResolver(esquemaFormulari),
    defaultValues: {
      pacientId: inicial.pacientId,
      dia: inicial.inici.slice(0, 10),
      hora: inicial.inici.slice(11, 16),
      durada: inicial.durada,
      tipus: inicial.tipus,
      estat: inicial.estat,
      motiu: inicial.motiu,
      notes: inicial.notes,
      nouEpisodi: inicial.nouEpisodi ?? false,
      episodiId: inicial.episodiId ?? null,
    },
  })
  // Amb canvis sense desar, les pantalles no es refresquen soles (revisio.tsx)
  useFormulariBrut(isDirty)
  // Els episodis actius del pacient triat (si n'hi ha més d'un, es pot triar)
  const [episodis, setEpisodis] = useState<readonly Pick<Episodi, 'id' | 'motiu'>[]>([])
  const [pacientId, dia, hora, durada, estat, nouEpisodi] = useWatch({
    control,
    name: ['pacientId', 'dia', 'hora', 'durada', 'estat', 'nouEpisodi'],
  })
  useEffect(() => {
    let actiu = true
    if (!pacientId || !carregarEpisodis) return setEpisodis([])
    void carregarEpisodis(pacientId).then((l) => {
      if (!actiu) return
      setEpisodis(l)
      // Per defecte, el que ja tenia la cita o el més recent
      if (l.length > 0 && !l.some((e) => e.id === getValues('episodiId'))) setValue('episodiId', l[0]!.id)
    })
    return () => {
      actiu = false
    }
  }, [pacientId, carregarEpisodis, getValues, setValue])

  const pacient = tots.find((p) => p.id === pacientId)
  const inici = `${dia}T${hora}`
  const encavalcades =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inici) && Number.isFinite(durada) && durada > 0
      ? solapaments({ id, inici, durada, estat }, altres)
      : []
  // Programada a una hora que ja ha passat: es registra com a visita ja feta
  const passada = estat === 'programada' && DATA_HORA.test(inici) && horaPassada(inici, ara)
  const estatFinal = passada ? 'feta' : estat
  // El tipus es calcula sol (la més antiga és la primera visita); les fetes no canvien
  const tipus: TipusCita =
    id && inicial.estat === 'feta'
      ? inicial.tipus
      : (tipusCalculats([
          ...altres.filter((x) => x.id !== id),
          // Una cita que es marca (o es registra) ara com a feta es calcula com les programades
          {
            id: id ?? '·nova',
            pacientId,
            inici,
            tipus: inicial.tipus,
            estat: estatFinal === 'feta' ? 'programada' : estatFinal,
            nouEpisodi,
          },
        ]).get(id ?? '·nova') ?? inicial.tipus)
  // Si la durada no s'ha tocat, segueix la del tipus (60 o 40 minuts). En una
  // cita nova, des del principi; en una que ja existeix, només si canvia el tipus
  const tipusAnterior = useRef(id ? tipus : inicial.tipus)
  useEffect(() => {
    if (tipusAnterior.current === tipus) return
    tipusAnterior.current = tipus
    if (!dirtyFields.durada) setValue('durada', DURADA_PER_DEFECTE[tipus])
  }, [tipus, dirtyFields.durada, setValue])
  const avis =
    horari && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inici) && Number.isFinite(durada) && durada > 0
      ? avisHorari({ inici, durada }, horari, diesTancats)
      : null

  const nomDe = (pid: string) => {
    const p = tots.find((x) => x.id === pid)
    return p ? nomComplet(p) : '—'
  }

  async function enviar(v: ValorsFormulari) {
    setErrorDesar(false)
    const { dia: d, hora: h, ...resta } = v
    try {
      await onDesar({ ...resta, tipus, estat: estatFinal, inici: `${d}T${h}`, sessioId: inicial.sessioId })
    } catch {
      setErrorDesar(true)
    }
  }

  return (
    <form className="formulari formulari-cita" onSubmit={handleSubmit(enviar)} noValidate>
      {pacient ? (
        <div className="pacient-triat">
          <span className="detall">{c.pacient}</span>
          <strong>{nomComplet(pacient)}</strong>
          {!pacientFix && !id && (
            <Boto variant="discret" onClick={() => setValue('pacientId', '', { shouldDirty: true })}>
              {c.canviarPacient}
            </Boto>
          )}
        </div>
      ) : (
        <TriarPacient
          pacients={tots}
          recents={[...nous.map((p) => p.id).reverse(), ...pacientsRecents(altres, ara)]}
          error={errors.pacientId?.message}
          onTriar={(p) => setValue('pacientId', p.id, { shouldDirty: true, shouldValidate: true })}
          onCrear={
            onCrearPacient &&
            (async (nom, telefon) => {
              const p = await onCrearPacient(nom, telefon)
              setNous((l) => [...l, p])
              setValue('pacientId', p.id, { shouldDirty: true, shouldValidate: true })
            })
          }
        />
      )}

      <div className="graella">
        <Camp etiqueta={c.data} error={errors.dia?.message}>
          <input type="date" {...register('dia')} />
        </Camp>
        <Camp etiqueta={c.hora} error={errors.hora?.message}>
          <input type="time" step={300} {...register('hora')} />
        </Camp>
        <div className="camp tipus-calculat">
          <span className="etiqueta-camp">{c.tipus}</span>
          <output aria-label={c.tipus}>{c.tipusNoms[tipus]}</output>
        </div>
        <Camp etiqueta={c.durada} error={errors.durada?.message}>
          <input type="number" min={5} max={480} step={5} {...register('durada', { valueAsNumber: true })} />
        </Camp>
        {id && (
          <Camp etiqueta={c.estat}>
            <select {...register('estat')}>
              {ESTATS_CITA.map((x) => (
                <option key={x} value={x}>
                  {c.estats[x]}
                </option>
              ))}
            </select>
          </Camp>
        )}
        <Camp etiqueta={c.motiu} error={errors.motiu?.message} ample>
          <input autoComplete="off" {...register('motiu')} />
        </Camp>
        <Camp etiqueta={c.notes} ample>
          <textarea rows={2} {...register('notes')} />
        </Camp>
        {!(id && inicial.estat === 'feta') && (
          <label className="casella camp-ample">
            <input type="checkbox" {...register('nouEpisodi')} />
            {c.nouEpisodi}
          </label>
        )}
        {!nouEpisodi && episodis.length > 1 && (
          <Camp etiqueta={c.episodi} ample>
            <select {...register('episodiId', { setValueAs: (v: string) => v || null })}>
              {episodis.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.motiu}
                </option>
              ))}
            </select>
          </Camp>
        )}
      </div>

      {passada && (
        <p className="avis avis-passat" role="status">
          {c.horaPassada}
        </p>
      )}
      {encavalcades.length > 0 && (
        <p className="avis" role="alert">
          {formatar(c.solapa, {
            llista: encavalcades
              .map((x) => formatar(c.solapaCita, { nom: nomDe(x.pacientId), hora: horaDe(x.inici) }))
              .join(c.solapaI),
          })}
        </p>
      )}
      {avis && horari && (
        <p className="avis avis-horari" role="status">
          {formatar(c.avisHorari[avis], { horari: `${hhmm(horari.inici)}–${hhmm(horari.fi)}` })}
        </p>
      )}
      {errorDesar && <p role="alert">{t.app.errorInesperat}</p>}

      <div className="accions accions-esquerra">
        <Boto type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.app.desant : passada ? c.registrarFeta : t.app.desar}
        </Boto>
        <Boto variant="discret" onClick={onCancellar}>
          {t.app.cancellar}
        </Boto>
        {onEsborrar && (
          <Boto
            variant="discret"
            className="a-la-dreta"
            onClick={() => {
              if (window.confirm(c.confirmarEsborrar)) void onEsborrar()
            }}
          >
            {c.esborrar}
          </Boto>
        )}
      </div>
    </form>
  )
}

function TriarPacient({
  pacients,
  recents,
  error,
  onTriar,
  onCrear,
}: {
  pacients: readonly Pacient[]
  /** Els ids dels pacients vistos fa menys temps, del més recent al més antic */
  recents: readonly string[]
  error?: string
  onTriar(p: Pacient): void
  onCrear?: (nom: string, telefon: string) => Promise<void>
}) {
  const c = t.cites
  const [consulta, setConsulta] = useState('')
  const [obert, setObert] = useState(false)
  const [creant, setCreant] = useState(false)
  const [nom, setNom] = useState('')
  const [telefon, setTelefon] = useState('')
  const [errorNou, setErrorNou] = useState<string | null>(null)
  const idLlista = useId()
  // Primer els recents i després tots els altres per ordre alfabètic (sense repetir-ne cap)
  const trobats = cercarPacients(pacients, consulta, { incloureArxivats: false })
  const delsRecents = recents.map((id) => trobats.find((p) => p.id === id)).filter((p): p is Pacient => !!p)
  const resta = trobats.filter((p) => !recents.includes(p.id))

  async function crear() {
    const v = esquemaDadesPacient.safeParse({ ...dadesPacientBuides(), nom, telefon })
    if (!v.success) {
      setErrorNou(v.error.issues[0]?.message ?? t.app.errorInesperat)
      return
    }
    setErrorNou(null)
    await onCrear!(v.data.nom, v.data.telefon)
  }

  const opcio = (p: Pacient) => (
    <li key={p.id}>
      <button
        type="button"
        // Abans que el camp perdi el focus i es tanqui la llista
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onTriar(p)}
      >
        <span className="nom">{nomComplet(p)}</span>
        <span className="detall">{p.telefon}</span>
      </button>
    </li>
  )

  return (
    <fieldset className="triar-pacient">
      <legend>{c.pacient}</legend>
      <div className="desplegable-pacient">
        <input
          type="search"
          aria-label={c.cercarPacient}
          aria-controls={idLlista}
          placeholder={c.cercarPacient}
          value={consulta}
          onFocus={() => setObert(true)}
          onClick={() => setObert(true)}
          onBlur={() => setObert(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && obert) {
              e.preventDefault()
              e.stopPropagation()
              setObert(false)
            }
          }}
          onChange={(e) => {
            setConsulta(e.target.value)
            setObert(true)
          }}
          autoComplete="off"
        />
        {obert && (
          <div className="llista-pacients" id={idLlista}>
            {trobats.length === 0 && <p className="detall">{c.capPacient}</p>}
            {delsRecents.length > 0 && (
              <>
                <p className="titol-grup">{c.recents}</p>
                <ul className="resultats-pacient" aria-label={c.recents}>
                  {delsRecents.map(opcio)}
                </ul>
              </>
            )}
            {resta.length > 0 && (
              <>
                {delsRecents.length > 0 && <p className="titol-grup">{c.totsPacients}</p>}
                <ul className="resultats-pacient" aria-label={c.totsPacients}>
                  {resta.map(opcio)}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="camp-error" role="alert">
          {error}
        </p>
      )}
      {onCrear && !creant && (
        <button
          type="button"
          className="enllac enllac-pacient-nou"
          onClick={() => {
            setCreant(true)
            // El que ja s'ha escrit a la cerca és, segurament, el nom
            if (!/^[\d\s+.-]*$/.test(consulta)) setNom(consulta.trim())
          }}
        >
          {c.pacientNou}
        </button>
      )}
      {onCrear && creant && (
        <div className="pacient-nou">
          <div className="graella">
            <Camp etiqueta={c.nomPacientNou} error={errorNou ?? undefined}>
              <input autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
            </Camp>
            <Camp etiqueta={c.telefonPacientNou}>
              <input type="tel" autoComplete="off" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </Camp>
          </div>
          <div className="accions accions-esquerra">
            <Boto variant="secundari" onClick={() => void crear()}>
              {c.crearPacient}
            </Boto>
            <Boto variant="discret" onClick={() => setCreant(false)}>
              {t.app.cancellar}
            </Boto>
          </div>
        </div>
      )}
    </fieldset>
  )
}
