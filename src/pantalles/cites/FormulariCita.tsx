// Formulari d'una cita (nova o existent): pacient, dia, hora, durada, estat,
// motiu i notes. El tipus (primera visita o seguiment) es calcula sol; la
// casella «Nou episodi» en fa una primera visita. Avisa si se solapa amb una
// altra cita, si és fora d'horari i si l'hora ja ha passat (llavors es
// registra com a visita ja feta).

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { avisHorari, hhmm, type Horari } from '../../domini/agenda'
import { cercarPacients } from '../../domini/cercaPacients'
import {
  DURADA_PER_DEFECTE,
  horaPassada,
  ESTATS_CITA,
  esquemaDadesCita,
  fiDe,
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
    control,
    formState: { errors, isSubmitting, dirtyFields },
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
    },
  })
  const [pacientId, dia, hora, durada, estat, nouEpisodi] = useWatch({
    control,
    name: ['pacientId', 'dia', 'hora', 'durada', 'estat', 'nouEpisodi'],
  })

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
      </div>

      {passada && (
        <p className="avis avis-passat" role="status">
          {c.horaPassada}
        </p>
      )}
      {encavalcades.length > 0 && (
        <p className="avis" role="alert">
          {formatar(c.solapa, {
            llista: encavalcades.map((x) => `${nomDe(x.pacientId)} (${horaDe(x.inici)}–${horaDe(fiDe(x))})`).join(', '),
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
  error,
  onTriar,
  onCrear,
}: {
  pacients: readonly Pacient[]
  error?: string
  onTriar(p: Pacient): void
  onCrear?: (nom: string, telefon: string) => Promise<void>
}) {
  const c = t.cites
  const [consulta, setConsulta] = useState('')
  const [nom, setNom] = useState('')
  const [telefon, setTelefon] = useState('')
  const [errorNou, setErrorNou] = useState<string | null>(null)
  const resultats = consulta.trim() === '' ? [] : cercarPacients(pacients, consulta, { incloureArxivats: false }).slice(0, 6)

  async function crear() {
    const v = esquemaDadesPacient.safeParse({ ...dadesPacientBuides(), nom, telefon })
    if (!v.success) {
      setErrorNou(v.error.issues[0]?.message ?? t.app.errorInesperat)
      return
    }
    setErrorNou(null)
    await onCrear!(v.data.nom, v.data.telefon)
  }

  return (
    <fieldset className="triar-pacient">
      <legend>{c.pacient}</legend>
      <input
        type="search"
        aria-label={c.cercarPacient}
        placeholder={c.cercarPacient}
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        autoComplete="off"
      />
      {error && (
        <p className="camp-error" role="alert">
          {error}
        </p>
      )}
      {consulta.trim() !== '' && resultats.length === 0 && <p className="detall">{c.capPacient}</p>}
      {resultats.length > 0 && (
        <ul className="resultats-pacient" aria-label={c.cercarPacient}>
          {resultats.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onTriar(p)}>
                <span className="nom">{nomComplet(p)}</span>
                <span className="detall">{p.telefon}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {onCrear && (
        <details className="pacient-nou">
          <summary>{c.pacientNou}</summary>
          <div className="graella">
            <Camp etiqueta={c.nomPacientNou} error={errorNou ?? undefined}>
              <input autoComplete="off" value={nom} onChange={(e) => setNom(e.target.value)} />
            </Camp>
            <Camp etiqueta={c.telefonPacientNou}>
              <input type="tel" autoComplete="off" value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </Camp>
          </div>
          <Boto variant="secundari" onClick={() => void crear()}>
            {c.crearPacient}
          </Boto>
        </details>
      )}
    </fieldset>
  )
}
