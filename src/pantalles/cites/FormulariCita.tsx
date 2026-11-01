// Formulari d'una cita (nova o existent): pacient, dia, hora, durada, tipus,
// estat, motiu i notes. Avisa si se solapa amb una altra cita.

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { cercarPacients } from '../../domini/cercaPacients'
import {
  DURADA_PER_DEFECTE,
  ESTATS_CITA,
  esquemaDadesCita,
  fiDe,
  solapaments,
  TIPUS_CITA,
  type Cita,
  type DadesCita,
} from '../../domini/cita'
import { dadesPacientBuides, esquemaDadesPacient, nomComplet, type Pacient } from '../../domini/pacient'
import { formatar, hora as horaDe, t } from '../../i18n/t'

const esquemaFormulari = esquemaDadesCita.omit({ inici: true, sessioId: true }).extend({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t.errors.dataInvalida),
  hora: z.string().regex(/^\d{2}:\d{2}$/, t.errors.horaInvalida),
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
}: Props) {
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
    },
  })
  const [pacientId, dia, hora, durada, estat] = useWatch({
    control,
    name: ['pacientId', 'dia', 'hora', 'durada', 'estat'],
  })

  const pacient = tots.find((p) => p.id === pacientId)
  const inici = `${dia}T${hora}`
  const encavalcades =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(inici) && Number.isFinite(durada) && durada > 0
      ? solapaments({ id, inici, durada, estat }, altres)
      : []
  const nomDe = (pid: string) => {
    const p = tots.find((x) => x.id === pid)
    return p ? nomComplet(p) : '—'
  }

  async function enviar(v: ValorsFormulari) {
    setErrorDesar(false)
    const { dia: d, hora: h, ...resta } = v
    try {
      await onDesar({ ...resta, inici: `${d}T${h}`, sessioId: inicial.sessioId })
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
        <Camp etiqueta={c.tipus}>
          <select
            {...register('tipus', {
              // Si la durada no s'ha tocat, segueix la del tipus (60 o 40 minuts)
              onChange: (e: { target: { value: keyof typeof DURADA_PER_DEFECTE } }) => {
                if (!dirtyFields.durada) setValue('durada', DURADA_PER_DEFECTE[e.target.value])
              },
            })}
          >
            {TIPUS_CITA.map((x) => (
              <option key={x} value={x}>
                {c.tipusNoms[x]}
              </option>
            ))}
          </select>
        </Camp>
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
      </div>

      {encavalcades.length > 0 && (
        <p className="avis" role="alert">
          {formatar(c.solapa, {
            llista: encavalcades.map((x) => `${nomDe(x.pacientId)} (${horaDe(x.inici)}–${horaDe(fiDe(x))})`).join(', '),
          })}
        </p>
      )}
      {errorDesar && <p role="alert">{t.app.errorInesperat}</p>}

      <div className="accions accions-esquerra">
        <Boto type="submit" disabled={isSubmitting}>
          {isSubmitting ? t.app.desant : t.app.desar}
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
