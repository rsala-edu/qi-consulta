// Pantalla de visita (etapa 3A). Capçalera fixa amb el pacient, l'episodi, el
// número de sessió, l'hora d'inici, el temporitzador de retenció i «Finalitzar
// visita». Quatre pestanyes que es poden recórrer en qualsevol ordre; tot es
// desa sol uns moments després de cada canvi (amb la cua de canvis i la fusió
// camp a camp, com la resta de l'app).
//
// Una sessió tancada es pot editar durant 24 hores; després és de només
// lectura i només s'hi poden afegir addendes.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useParams } from 'react-router'
import { Minigrafic } from '../../evolucio/Minigrafic'
import { nomEpisodi } from '../../domini/episodi'
import type { TipusCita } from '../../domini/cita'
import { BarraEscala } from '../../components/BarraEscala'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { RevisioConflictes } from '../../components/RevisioConflictes'
import { llegirAjustosVisita } from '../../db/ajustosVisita'
import { ErrorSessioBloquejada, type CampEnConflicte } from '../../db/magatzem'
import { diaDe, sumarDies } from '../../domini/cita'
import { nomComplet } from '../../domini/pacient'
import type { PuntMarcat } from '../../domini/puntMarcat'
import {
  agullesDelsPunts,
  agullesPosades,
  agullesQuadren,
  copiarTractament,
  diferenciaPunts,
  editableFins,
  esEditable,
  llistaPunts,
  mapaPunts,
  type DadesSessio,
  type Sessio,
} from '../../domini/sessio'
import { diaLlarg, formatar, hora, t } from '../../i18n/t'
import { useMagatzem, useSessio } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'
import { ambValor } from '../../sincronia/fusioCamps'
import { useFormulariBrut } from '../../sincronia/revisio'
import { MapaTractament } from '../mapa/PantallaProvaMapa'
import { Temporitzador } from './Temporitzador'
import { PestanyaValoracio } from './PestanyaValoracio'
import { ESPECIALS } from '../../cataleg/components/especials'
import { DIAGNOSTIC, EXPLORACIO, etiquetaCami, GRUPS_VALORACIO, ORL } from '../../cataleg/index'
import { orlActiu } from '../../cataleg/orl'
import { PlaTractament } from './PlaTractament'
import { ProperaCita } from './ProperaCita'
import { BlocMymop } from './BlocMymop'
import { BlocPgic } from './BlocPgic'
import { esActivada } from '../../cataleg/motor'
import type { Mymop } from '../../domini/escales'
import { GrupCataleg } from '../../cataleg/components/Cataleg'
import type { AjustosCatalegs } from '../../cataleg/motor'
import { llegirAjustosCatalegs } from '../../db/ajustosCatalegs'
import { hiHaEmbaras, type DadesValoracio, type Valoracio } from '../../domini/valoracio'
import { useRetencio } from '../../visita/retencio'
import { avisarSortidaVisita } from '../../visita/sortidaVisita'

type Pestanya = 'valoracio' | 'comEsta' | 'exploracio' | 'diagnostic' | 'orl' | 'tractament' | 'tancar'
const PESTANYES: readonly Pestanya[] = ['valoracio', 'comEsta', 'exploracio', 'diagnostic', 'orl', 'tractament', 'tancar']
/** Pestanyes que mostren la valoració de l'episodi (un sol component) */
const DE_VALORACIO: readonly Pestanya[] = ['valoracio', 'diagnostic', 'orl']
/** Temps entre l'últim canvi i el desat */
const ESPERA_DESAR = 600

const dadesDe = (s: Sessio): DadesSessio => {
  const { id: _i, creatAt: _c, modificatAt: _m, pacientId: _p, ...d } = s
  return d
}

/** «demà a les 17:20», «dijous 5 de novembre a les 17:20» */
function quanEs(d: Date, ara: Date): string {
  const dia = diaDe(d)
  const quin = dia === diaDe(ara) ? 'avui' : dia === sumarDies(diaDe(ara), 1) ? 'demà' : diaLlarg(dia)
  return `${quin} a les ${hora(`${dia}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)}`
}

export function PantallaVisita() {
  const { id = '' } = useParams()
  const magatzem = useMagatzem()
  const { db } = useSessio()
  const [versio, setVersio] = useState(0)
  const [carrega] = useCarrega(async () => {
    const sessio = await magatzem.obtenirSessio(id)
    if (!sessio) return null
    const [pacient, episodi, sessions, ajustos, addendes, conflictes, valoracions, catalegs, fitxa] = await Promise.all([
      magatzem.obtenirPacient(sessio.pacientId),
      magatzem.obtenirEpisodi(sessio.episodiId),
      magatzem.sessionsDelPacient(sessio.pacientId),
      llegirAjustosVisita(db),
      magatzem.addendesDe(id),
      magatzem.conflictesDe(id),
      magatzem.valoracionsDe(sessio.episodiId),
      llegirAjustosCatalegs(db),
      magatzem.obtenirFitxaClinica(sessio.pacientId),
    ])
    // La cita (el tipus real: primera visita o seguiment) i els motius de les cites de l'episodi
    const cites = await magatzem.citesDelPacient(sessio.pacientId)
    const cita = cites.find((c) => c.id === sessio.citaId) ?? null
    const motiusCites = cites
      .filter((c) => c.episodiId === sessio.episodiId)
      .sort((a, b) => a.inici.localeCompare(b.inici))
      .map((c) => c.motiu)
    // El MYMOP més recent de l'episodi (per comparar i per repetir els símptomes triats)
    const mymopAnterior =
      sessions.filter((s) => s.episodiId === sessio.episodiId && s.id !== id && s.iniciAt < sessio.iniciAt && s.mymop).at(-1)?.mymop ?? null
    // L'últim PGIC de l'episodi (punt petit a la barra)
    const pgicAnterior =
      sessions.filter((s) => s.episodiId === sessio.episodiId && s.id !== id && s.iniciAt < sessio.iniciAt && s.pgic !== null).at(-1)?.pgic ?? null
    const darreraValoracio = valoracions.at(-1)
    const conflictesValoracio = darreraValoracio ? await magatzem.conflictesDe(darreraValoracio.id) : []
    // L'última sessió d'abans del mateix episodi (per a l'escala i «Repetir el tractament»)
    const anterior =
      sessions.filter((s) => s.episodiId === sessio.episodiId && s.id !== id && s.iniciAt < sessio.iniciAt).at(-1) ?? null
    // L'escala de les sessions anteriors de l'episodi (minigràfic a «Com està»)
    const escalesAnteriors = sessions
      .filter((s) => s.episodiId === sessio.episodiId && s.id !== id && s.numero < sessio.numero)
      .sort((a, b) => a.numero - b.numero)
      .map((s) => s.comEsta.escala)
    return {
      sessio,
      pacient,
      episodi,
      anterior,
      escalesAnteriors,
      tipusCita: cita?.tipus ?? null,
      motiusCites,
      ajustos,
      addendes,
      conflictes,
      valoracions,
      conflictesValoracio,
      catalegs,
      embarasFitxa: fitxa.contraindicacions.embaras,
      mymopAnterior,
      pgicAnterior,
    }
  }, [magatzem, db, id, versio])

  // En tornar a carregar (conflictes, revisar la valoració…) es continua veient la visita: no es perd la pestanya
  type Dades = NonNullable<Extract<typeof carrega, { estat: 'llest' }>['dades']>
  const [ultimes, setUltimes] = useState<{ id: string; dades: Dades } | null>(null)
  if (carrega.estat === 'llest' && carrega.dades && ultimes?.dades !== carrega.dades) setUltimes({ id, dades: carrega.dades })
  const mostrades = carrega.estat === 'llest' ? carrega.dades : ultimes?.id === id ? ultimes.dades : null
  if (carrega.estat === 'carregant' && !mostrades) return <Indicador text={t.app.carregant} />
  if (!mostrades) return <p role="alert">{t.visita.noTrobada}</p>
  return <Visita key={id} {...mostrades} onRecarregar={() => setVersio((n) => n + 1)} />
}

function Visita({
  sessio,
  pacient,
  episodi,
  anterior,
  escalesAnteriors,
  tipusCita,
  motiusCites,
  ajustos,
  addendes,
  conflictes,
  valoracions,
  conflictesValoracio,
  catalegs,
  embarasFitxa,
  mymopAnterior,
  pgicAnterior,
  onRecarregar,
}: {
  sessio: Sessio
  pacient: Awaited<ReturnType<ReturnType<typeof useMagatzem>['obtenirPacient']>>
  episodi: Awaited<ReturnType<ReturnType<typeof useMagatzem>['obtenirEpisodi']>>
  anterior: Sessio | null
  escalesAnteriors: (number | null)[]
  tipusCita: TipusCita | null
  motiusCites: string[]
  ajustos: Awaited<ReturnType<typeof llegirAjustosVisita>>
  addendes: Awaited<ReturnType<ReturnType<typeof useMagatzem>['addendesDe']>>
  conflictes: CampEnConflicte[]
  valoracions: Valoracio[]
  conflictesValoracio: CampEnConflicte[]
  catalegs: AjustosCatalegs
  embarasFitxa: boolean
  mymopAnterior: Mymop | null
  pgicAnterior: number | null
  onRecarregar(): void
}) {
  const magatzem = useMagatzem()
  const retencioGlobal = useRetencio()
  const v = t.visita
  const [dades, setDadesEstat] = useState<DadesSessio>(() => dadesDe(sessio))
  // L'última versió desada: només es desa el que ha canviat respecte d'aquí
  const desada = useRef<DadesSessio>(dadesDe(sessio))
  const [pendent, setPendent] = useState(false)
  const [desant, setDesant] = useState(false)
  const [bloquejada, setBloquejada] = useState(() => !esEditable(sessio, Date.now()))
  // A la primera visita de l'episodi es comença per la valoració
  const [pestanya, setPestanya] = useState<Pestanya>(sessio.numero === 1 ? 'valoracio' : 'comEsta')
  // «⤢ Ampliar» (pestanya Tractament): el mapa ocupa tota la pantalla; només queda el temporitzador, en petit
  const [ampliat, setAmpliat] = useState(false)
  const mapaAmpliat = ampliat && pestanya === 'tractament'
  useEffect(() => {
    if (!mapaAmpliat) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAmpliat(false)
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [mapaAmpliat])
  // El que hi ha ara a la valoració (avís d'embaràs, mòdul ORL)
  const [valoracio, setValoracio] = useState<DadesValoracio | null>(() => valoracions.at(-1) ?? null)
  const canviValoracio = useCallback((d: DadesValoracio) => setValoracio(d), [])
  const embaras = embarasFitxa || hiHaEmbaras(valoracio)
  const motiuV = valoracio?.seccions['motiu:actual']?.valors?.motiu
  const diagV = valoracio?.seccions['motiu:diagnosticOccidental']?.valors
  const codiCim = (diagV?.cim11 as { codi?: string } | undefined)?.codi ?? null
  const ambOrl = orlActiu(
    valoracio?.orl ?? null,
    [episodi?.motiu ?? '', typeof motiuV === 'string' ? motiuV : '', typeof diagV?.text === 'string' ? diagV.text : ''],
    codiCim,
  )
  const pestanyes = PESTANYES.filter((p) => p !== 'orl' || ambOrl)
  const canviarPestanya = (p: Pestanya) => {
    setPestanya(p)
    // En tornar a «Com està», només es veuen els secundaris que tenen alguna cosa
    setSecundaris(0)
    setAfegit(false)
  }
  // Si es treu el mòdul ORL amb la pestanya oberta, es torna a la valoració
  if (pestanya === 'orl' && !ambOrl) setPestanya('valoracio')
  // El pla de tractament de l'episodi (es pot canviar a la pestanya Diagnòstic)
  const [pla, setPla] = useState(() => episodi?.pla ?? null)
  const [acabada, setAcabada] = useState(false)
  const [finalitzant, setFinalitzant] = useState(false)
  // Mentre hi ha canvis per desar, els d'un altre dispositiu no es posen a sobre
  useFormulariBrut(pendent)

  // Han arribat canvis d'un altre dispositiu (i aquí no hi ha res pendent)
  useEffect(() => {
    if (pendent) return
    const nova = dadesDe(sessio)
    if (JSON.stringify(nova) !== JSON.stringify(desada.current)) {
      desada.current = nova
      setDadesEstat(nova)
    }
    // Només quan arriba una sessió nova de la base de dades
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessio])

  const setDades: Dispatch<SetStateAction<DadesSessio>> = useCallback((u) => {
    setDadesEstat(u)
    setPendent(true)
  }, [])

  // L'últim que s'ha escrit (si s'escriu mentre es desa, encara queda pendent)
  const ultimes = useRef(dades)
  useEffect(() => {
    ultimes.current = dades
  }, [dades])

  // Es desa sol uns moments després de l'últim canvi
  useEffect(() => {
    if (!pendent || bloquejada) return
    const tmp = window.setTimeout(() => {
      setDesant(true)
      const aDesar = dades
      magatzem
        .actualitzarSessio(sessio.id, aDesar, desada.current)
        .then(
          (s) => {
            desada.current = dadesDe(s)
            // Comparar amb el d'ara, no amb el d'aquest moment: si no, un canvi fet
            // mentre es desava es quedaria sense desar
            setPendent(JSON.stringify(aDesar) !== JSON.stringify(ultimes.current))
          },
          (e: unknown) => {
            if (e instanceof ErrorSessioBloquejada) setBloquejada(true)
          },
        )
        .finally(() => setDesant(false))
    }, ESPERA_DESAR)
    return () => window.clearTimeout(tmp)
  }, [dades, pendent, bloquejada, magatzem, sessio.id])

  // En sortir de la visita (canviar de pantalla, bloquejar l'app) amb canvis
  // encara per desar, es desen de seguida: no es pot perdre res
  const perDesar = useRef<{ dades: DadesSessio; pendent: boolean; bloquejada: boolean }>({ dades, pendent, bloquejada })
  useEffect(() => {
    perDesar.current = { dades, pendent, bloquejada }
  }, [dades, pendent, bloquejada])
  useEffect(
    () => () => {
      const p = perDesar.current
      if (p.pendent && !p.bloquejada) void magatzem.actualitzarSessio(sessio.id, p.dades, desada.current).catch(() => {})
    },
    [magatzem, sessio.id],
  )
  // En sortir de la pantalla amb la visita encara en curs: avís suau (es pot reprendre des d'Avui).
  // Només si de debò s'ha sortit (l'adreça ja és una altra): la pantalla també es desmunta i es
  // torna a muntar sense sortir-ne (en recarregar-la, o el mode estricte de React)
  useEffect(
    () => () => {
      const encaraHiEs = decodeURIComponent(location.hash.split('?')[0] ?? '') === `#/visita/${sessio.id}`
      if (perDesar.current.dades.estat === 'enCurs' && !encaraHiEs) avisarSortidaVisita()
    },
    [sessio.id],
  )

  const editable = !bloquejada
  // «Afegir una addenda» (al costat de l'avís de sessió tancada): el formulari, just a sota
  const [addendaOberta, setAddendaOberta] = useState(false)
  // Símptomes secundaris a la vista: els que ja tenen alguna cosa, o els que s'han afegit
  const ambSecundari = (k: 'secundari1' | 'secundari2') => dades.comEsta[k].nom.trim() !== '' || dades.comEsta[k].escala !== null
  const [secundarisAfegits, setSecundaris] = useState(0)
  const [afegit, setAfegit] = useState(false)
  const secundaris = Math.max(secundarisAfegits, ambSecundari('secundari2') ? 2 : ambSecundari('secundari1') ? 1 : 0)
  const enCurs = dades.estat === 'enCurs'
  const fins = editableFins(dades)
  const marcats = llistaPunts(dades.punts)
  const setMarcats: Dispatch<SetStateAction<PuntMarcat[]>> = useCallback(
    (u) => setDades((d) => ({ ...d, punts: mapaPunts(typeof u === 'function' ? u(llistaPunts(d.punts)) : u) })),
    [setDades],
  )
  const etiquetes: Record<string, string> = {
    'comEsta.canvis': v.canvis,
    'comEsta.escala': v.escala,
    'tancar.recomanacions': v.recomanacions,
    'tancar.incidencies': v.incidencies,
  }

  return (
    <main className={`pantalla pantalla-visita${pestanya === 'tractament' ? ' amb-mapa' : ''}${mapaAmpliat ? ' ampliat' : ''}`}>
      <header className={`capcalera-visita${acabada ? ' retencio-acabada' : ''}`}>
        <div className="qui-visita">
          <h1>
            {pacient ? nomComplet(pacient) : '—'}
            {embaras && (
              <span className="etiqueta etiqueta-embaras" role="note" title={v.embarasDetall}>
                {v.embaras}
              </span>
            )}
          </h1>
          {/* L'hora d'inici, en passar-hi per sobre: la capçalera cap en una sola fila */}
          <p className="detall" title={formatar(v.inici, { hora: new Date(dades.iniciAt).toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' }) })}>
            {/* «Sessió 5 de 10 · Lumbàlgia · Seguiment»: la sessió primer, perquè no es talli mai */}
            {[
              pla?.sessions ? formatar(v.sessioDe, { n: String(dades.numero), total: String(pla.sessions) }) : formatar(v.sessio, { n: String(dades.numero) }),
              episodi ? nomEpisodi(episodi, motiusCites) : '',
              tipusCita ? t.cites.tipusNoms[tipusCita] : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {enCurs && (
          <Temporitzador
            sessioId={sessio.id}
            retencio={dades.retencio}
            minutsPerDefecte={ajustos.minutsRetencio}
            editable={editable}
            onCanviar={(retencio) => setDades((d) => ({ ...d, retencio }))}
            onAcabada={setAcabada}
          />
        )}
        <div className="accions-visita">
          {/* Una sessió tancada no es desa: no hi ha res a dir */}
          {editable && (
            <span className="detall" role="status">
              {desant ? v.desant : pendent ? '' : v.desat}
            </span>
          )}
          {enCurs && editable && (
            <Boto onClick={() => setFinalitzant((f) => !f)} aria-expanded={finalitzant}>
              {v.finalitzar}
            </Boto>
          )}
        </div>
      </header>

      {finalitzant && enCurs && (
        <Finalitzar
          dades={dades}
          controlAgulles={ajustos.controlAgulles}
          onFinalitzar={async (agulles) => {
            // Primer es desa el que hi hagi pendent
            const s = await magatzem.actualitzarSessio(sessio.id, dades, desada.current)
            desada.current = dadesDe(s)
            const tancada = await magatzem.finalitzarSessio(sessio.id, agulles)
            // La visita s'ha acabat: ja no hi ha cap retenció en marxa
            if (retencioGlobal.retencio?.sessioId === sessio.id) retencioGlobal.registrar(null)
            desada.current = dadesDe(tancada)
            setDadesEstat(dadesDe(tancada))
            setPendent(false)
            setFinalitzant(false)
          }}
          onCancellar={() => setFinalitzant(false)}
        />
      )}

      {/* (4A) Començada amb «Continuar igualment», sense el consentiment d'acupuntura vigent */}
      {dades.senseConsentiment && pestanya !== 'tractament' && (
        <p className="avis-suau avis-sense-consentiment" role="note">
          {formatar(t.consentiments.senseConsentimentSessio, { quan: new Date(dades.senseConsentiment).toLocaleString('ca', { dateStyle: 'short', timeStyle: 'short' }) })}
        </p>
      )}
      {!enCurs && (
        <div className="avis-sessio-tancada">
          <p className="avis" role="status">
            {bloquejada ? v.nomesLectura : fins ? `${v.tancada} ${formatar(v.editableFins, { quan: quanEs(fins, new Date()) })}` : v.tancada}
          </p>
          {bloquejada && !addendaOberta && (
            <Boto variant="secundari" onClick={() => setAddendaOberta(true)}>
              {v.afegirAddendaBoto}
            </Boto>
          )}
        </div>
      )}
      {!enCurs && bloquejada && addendaOberta && (
        <Addendes sessioId={sessio.id} addendes={addendes} bloquejada={bloquejada} onAfegida={onRecarregar} autoFocus onTancar={() => setAddendaOberta(false)} />
      )}

      <RevisioConflictes
        conflictes={conflictes}
        etiquetes={{ ...Object.fromEntries(conflictes.map((c) => [c.camp, etiquetaCami(c.camp) ?? c.camp])), ...etiquetes }}
        onQuedar={async (c) => {
          await magatzem.resoldreConflicte(c.conflicteId, c.camp)
          onRecarregar()
        }}
        onRecuperar={async (c) => {
          setDades((d) => ambValor(d as never, c.camp, c.valor) as unknown as DadesSessio)
          await magatzem.resoldreConflicte(c.conflicteId, c.camp)
          onRecarregar()
        }}
      />

      <div className="segmentat pestanyes-visita" role="tablist" aria-label={v.titol}>
        {pestanyes.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            id={`pestanya-${p}`}
            aria-controls={`visita-${p}`}
            aria-selected={pestanya === p}
            onClick={() => canviarPestanya(p)}
          >
            {v.pestanyes[p]}
          </button>
        ))}
      </div>

      {/* La valoració i el diagnòstic són el mateix registre: un sol component, sempre muntat (si es
          desmuntés en canviar de pestanya, en tornar mostraria la versió carregada en obrir la visita) */}
      <section
        id={`visita-${DE_VALORACIO.includes(pestanya) ? pestanya : 'valoracio'}`}
        role="tabpanel"
        aria-labelledby={`pestanya-${DE_VALORACIO.includes(pestanya) ? pestanya : 'valoracio'}`}
        className="panell"
        hidden={!DE_VALORACIO.includes(pestanya)}
      >
          <PestanyaValoracio
            sessio={sessio}
            valoracions={valoracions}
            conflictes={conflictesValoracio}
            grups={pestanya === 'diagnostic' ? [DIAGNOSTIC] : pestanya === 'orl' ? [ORL] : GRUPS_VALORACIO}
            nom={pestanya === 'diagnostic' || pestanya === 'orl' ? v.pestanyes[pestanya] : undefined}
            orlActiu={ambOrl}
            ajustos={catalegs}
            sexe={pacient?.sexe}
            editableSessio={editable}
            onRecarregar={onRecarregar}
            onDades={canviValoracio}
            especials={ESPECIALS}
          />
          {episodi && (
            <div hidden={pestanya !== 'diagnostic'}>
              <PlaTractament episodi={episodi} editable={editable} onPla={setPla} />
            </div>
          )}
      </section>

      {/* Tancada: tot es pot consultar. Al mapa (Tractament) es pot mirar (vistes, zoom, fitxes, marcats) però no marcar */}
      <fieldset className="contingut-visita" disabled={!editable && pestanya !== 'tractament'}>
        {pestanya === 'comEsta' && (
          <section id="visita-comEsta" role="tabpanel" aria-labelledby="pestanya-comEsta" className="panell">
            <Camp etiqueta={v.canvis}>
              <textarea
                rows={4}
                value={dades.comEsta.canvis}
                onChange={(e) => setDades((d) => ({ ...d, comEsta: { ...d.comEsta, canvis: e.target.value } }))}
              />
            </Camp>
            <BarraEscala
              etiqueta={v.escala}
              valor={dades.comEsta.escala}
              anterior={anterior?.comEsta.escala ?? null}
              extra={<Minigrafic valors={[...escalesAnteriors, dades.comEsta.escala]} />}
              disabled={!editable}
              onCanviar={(escala) => setDades((d) => ({ ...d, comEsta: { ...d.comEsta, escala } }))}
            />
            {/* MYMOP: requereix llicència; només si la doctora l'ha activat (o si ja n'hi ha de desat) */}
            {(esActivada(catalegs, 'mymop') || dades.mymop) && (
              <BlocMymop
                numero={dades.numero}
                mymop={dades.mymop}
                anterior={mymopAnterior}
                onCanviar={(mymop) => setDades((d) => ({ ...d, mymop }))}
              />
            )}
            {/* PGIC: activat per defecte (sense llicència), al mateix ritme que el MYMOP */}
            <BlocPgic
              numero={dades.numero}
              valor={dades.pgic}
              anterior={pgicAnterior}
              disabled={!editable}
              onCanviar={(pgic) => setDades((d) => ({ ...d, pgic }))}
            />
            {/* Símptomes secundaris: amagats fins que se n'afegeix un (fins a 2) */}
            {(['secundari1', 'secundari2'] as const).slice(0, secundaris).map((k, i) => (
              <div key={k} className="simptoma-secundari">
                <Camp etiqueta={`${formatar(v.secundari, { n: String(i + 1) })} · ${v.nomSimptoma}`}>
                  <input
                    value={dades.comEsta[k].nom}
                    autoFocus={i + 1 === secundaris && afegit}
                    onChange={(e) => setDades((d) => ({ ...d, comEsta: { ...d.comEsta, [k]: { ...d.comEsta[k], nom: e.target.value } } }))}
                  />
                </Camp>
                <BarraEscala
                  etiqueta={`${formatar(v.secundari, { n: String(i + 1) })} · ${v.escalaSimptoma}`}
                  valor={dades.comEsta[k].escala}
                  anterior={anterior?.comEsta[k].escala ?? null}
                  disabled={!editable}
                  onCanviar={(escala) => setDades((d) => ({ ...d, comEsta: { ...d.comEsta, [k]: { ...d.comEsta[k], escala } } }))}
                />
              </div>
            ))}
            {editable && secundaris < 2 && (
              <p className="accions accions-esquerra">
                <Boto
                  variant="discret"
                  onClick={() => {
                    setAfegit(true)
                    setSecundaris((n) => n + 1)
                  }}
                >
                  {v.afegirSecundari}
                </Boto>
              </p>
            )}
          </section>
        )}

        {pestanya === 'exploracio' && (
          <section id="visita-exploracio" role="tabpanel" aria-labelledby="pestanya-exploracio" className="panell">
            {anterior && Object.keys(anterior.exploracio.seccions).length > 0 && (
              <p className="accions accions-esquerra">
                <Boto
                  variant="secundari"
                  onClick={() => setDades((d) => ({ ...d, exploracio: { seccions: structuredClone(anterior.exploracio.seccions) } }))}
                >
                  {t.cataleg.totIgualQueUltima}
                </Boto>
              </p>
            )}
            <GrupCataleg
              grup={EXPLORACIO}
              seccions={dades.exploracio.seccions}
              anteriors={anterior?.exploracio.seccions}
              onCanviar={(seccions) => setDades((d) => ({ ...d, exploracio: { seccions } }))}
              ajustos={catalegs}
              editable={editable}
              especials={ESPECIALS}
            />
          </section>
        )}

        {pestanya === 'tractament' && (
          <section id="visita-tractament" role="tabpanel" aria-labelledby="pestanya-tractament" className="panell tractament-visita">
            <div className="pantalla-mapa mapa-visita">
              <MapaTractament
                nomesLectura={!editable}
                marcats={marcats}
                setMarcats={setMarcats}
                barra={<Tractament dades={dades} anterior={anterior} setDades={setDades} controlAgulles={ajustos.controlAgulles} editable={editable} />}
                cantonada={
                  <button type="button" className="boto-ampliar" aria-pressed={mapaAmpliat} onClick={() => setAmpliat((x) => !x)}>
                    {mapaAmpliat ? v.reduir : v.ampliar}
                  </button>
                }
              />
            </div>
          </section>
        )}

        {pestanya === 'tancar' && (
          <section id="visita-tancar" role="tabpanel" aria-labelledby="pestanya-tancar" className="panell">
            <Camp etiqueta={v.recomanacions}>
              <textarea
                rows={3}
                value={dades.tancar.recomanacions}
                onChange={(e) => setDades((d) => ({ ...d, tancar: { ...d.tancar, recomanacions: e.target.value } }))}
              />
            </Camp>
            <Camp etiqueta={v.incidencies}>
              <textarea
                rows={3}
                value={dades.tancar.incidencies}
                disabled={dades.tancar.capIncidencia}
                onChange={(e) => setDades((d) => ({ ...d, tancar: { ...d.tancar, incidencies: e.target.value } }))}
              />
            </Camp>
            <label className="casella">
              <input
                type="checkbox"
                checked={dades.tancar.capIncidencia}
                onChange={(e) => setDades((d) => ({ ...d, tancar: { ...d.tancar, capIncidencia: e.target.checked } }))}
              />
              {v.capIncidencia}
            </label>
          </section>
        )}
      </fieldset>

      {pestanya === 'tancar' && <ProperaCita sessio={sessio} />}

      <NavegacioPestanyes
        pestanyes={pestanyes}
        actual={pestanya}
        onAnar={(p) => {
          canviarPestanya(p)
          window.scrollTo(0, 0)
        }}
        onFinalitzar={
          enCurs && editable
            ? () => {
                setFinalitzant(true)
                window.scrollTo(0, 0)
              }
            : undefined
        }
      />

      {!enCurs && !addendaOberta && <Addendes sessioId={sessio.id} addendes={addendes} bloquejada={bloquejada} onAfegida={onRecarregar} />}

    </main>
  )
}

function Tractament({
  dades,
  anterior,
  setDades,
  controlAgulles,
  editable,
}: {
  dades: DadesSessio
  anterior: Sessio | null
  setDades: Dispatch<SetStateAction<DadesSessio>>
  controlAgulles: boolean
  editable: boolean
}) {
  const v = t.visita
  const [preguntant, setPreguntant] = useState(false)
  const teAnterior = !!anterior && Object.keys(anterior.punts).length > 0
  const repetir = (substituir: boolean) => {
    setDades((d) => ({ ...d, punts: copiarTractament(d.punts, anterior!.punts, substituir) }))
    setPreguntant(false)
  }
  const dif = anterior ? diferenciaPunts(dades.punts, anterior.punts) : null
  const auto = agullesDelsPunts(dades.punts)
  return (
    <div className="eines-tractament barra-tractament">
      {teAnterior && editable && (
        <>
          {/* A la tauleta vertical, la icona i «Repetir» (el nom accessible és el sencer) */}
          <Boto
            variant="secundari"
            className="boto-repetir"
            aria-label={v.repetir}
            title={v.repetir}
            onClick={() => (Object.keys(dades.punts).length > 0 ? setPreguntant(true) : repetir(true))}
          >
            <svg className="icona-repetir" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-llarg">{v.repetir}</span>
            <span className="text-curt">{v.repetirCurt}</span>
          </Boto>
          {preguntant && (
            <div className="pregunta-repetir" role="group" aria-label={v.repetirPregunta}>
              <p>{v.repetirPreguntaCurta}</p>
              <Boto variant="secundari" onClick={() => repetir(true)}>
                {v.substituir}
              </Boto>
              <Boto variant="secundari" onClick={() => repetir(false)}>
                {v.afegir}
              </Boto>
              <Boto variant="discret" onClick={() => setPreguntant(false)}>
                {t.app.cancellar}
              </Boto>
            </div>
          )}
        </>
      )}
      {dif && teAnterior && (
        <p className="detall" data-testid="diferencia-punts" title={formatar(v.diferencia, { mes: String(dif.mes), menys: String(dif.menys) })}>
          <span className="text-llarg">{v.diferenciaPrefix}</span>
          {formatar(v.diferenciaValor, { mes: String(dif.mes), menys: String(dif.menys) })}
        </p>
      )}
      {controlAgulles && (
        <div className="agulles-posades">
          <span className="etiqueta-camp">
            {v.agulles}
            <span className="text-llarg"> {v.posades}</span>
          </span>
          <Boto
            variant="discret"
            aria-label={`${v.agullesPosades}: −1`}
            disabled={!editable}
            onClick={() => setDades((d) => ({ ...d, agulles: { ...d.agulles, posades: Math.max(0, agullesPosades(d) - 1) } }))}
          >
            −
          </Boto>
          <output aria-label={v.agullesPosades}>{agullesPosades(dades)}</output>
          <Boto
            variant="discret"
            aria-label={`${v.agullesPosades}: +1`}
            disabled={!editable}
            onClick={() => setDades((d) => ({ ...d, agulles: { ...d.agulles, posades: agullesPosades(d) + 1 } }))}
          >
            +
          </Boto>
          {dades.agulles.posades !== null && dades.agulles.posades !== auto && (
            <span className="detall">{formatar(v.agullesAuto, { n: String(auto) })}</span>
          )}
        </div>
      )}
    </div>
  )
}

/** Confirmació en finalitzar: «Agulles retirades: 18 de 18» (si no quadra, cal el motiu) */
function Finalitzar({
  dades,
  controlAgulles,
  onFinalitzar,
  onCancellar,
}: {
  dades: DadesSessio
  controlAgulles: boolean
  onFinalitzar(a: { retirades: number | null; motiu: string }): Promise<void>
  onCancellar(): void
}) {
  const v = t.visita
  const posades = agullesPosades(dades)
  const [retirades, setRetirades] = useState(posades)
  const [motiu, setMotiu] = useState('')
  const [fent, setFent] = useState(false)
  const quadra = !controlAgulles || agullesQuadren(dades, retirades, motiu)
  return (
    <section className="panell finalitzar-visita" aria-label={v.finalitzar}>
      {controlAgulles && (
        <>
          <div className="agulles-retirades">
            <Camp etiqueta={v.confirmarAgulles}>
              <input type="number" min={0} value={retirades} onChange={(e) => setRetirades(Number(e.target.value))} />
            </Camp>
            <span>{formatar(v.deN, { n: String(posades) })}</span>
          </div>
          {retirades !== posades && (
            <>
              <p role="alert">{v.noQuadra}</p>
              <Camp etiqueta={v.motiuAgulles}>
                <input value={motiu} onChange={(e) => setMotiu(e.target.value)} />
              </Camp>
            </>
          )}
        </>
      )}
      <div className="accions accions-esquerra">
        <Boto
          disabled={!quadra || fent}
          onClick={() => {
            setFent(true)
            void onFinalitzar({ retirades: controlAgulles ? retirades : null, motiu: motiu.trim() }).finally(() => setFent(false))
          }}
        >
          {v.confirmarFinalitzar}
        </Boto>
        <Boto variant="discret" onClick={onCancellar}>
          {t.app.cancellar}
        </Boto>
      </div>
    </section>
  )
}

/**
 * Al final de cada pestanya: «← Anterior: Com està» i «Següent: Exploració →»,
 * perquè no calgui pujar fins a les pestanyes. A l'última, «Finalitzar visita».
 */
function NavegacioPestanyes({
  pestanyes,
  actual,
  onAnar,
  onFinalitzar,
}: {
  pestanyes: readonly Pestanya[]
  actual: Pestanya
  onAnar(p: Pestanya): void
  onFinalitzar?(): void
}) {
  const v = t.visita
  const i = pestanyes.indexOf(actual)
  const anterior = pestanyes[i - 1]
  const seguent = pestanyes[i + 1]
  return (
    <nav className="navegacio-pestanyes" aria-label={v.navegacioPestanyes}>
      {anterior ? (
        <Boto variant="discret" onClick={() => onAnar(anterior)}>
          {formatar(v.anteriorPestanya, { nom: v.pestanyes[anterior] })}
        </Boto>
      ) : (
        <span />
      )}
      {seguent ? (
        <Boto variant="secundari" onClick={() => onAnar(seguent)}>
          {formatar(v.seguentPestanya, { nom: v.pestanyes[seguent] })}
        </Boto>
      ) : (
        onFinalitzar && <Boto onClick={onFinalitzar}>{v.finalitzar}</Boto>
      )}
    </nav>
  )
}

function Addendes({
  sessioId,
  addendes,
  bloquejada,
  onAfegida,
  autoFocus = false,
  onTancar,
}: {
  sessioId: string
  addendes: readonly { id: string; text: string; at: string }[]
  bloquejada: boolean
  onAfegida(): void
  autoFocus?: boolean
  /** Formulari obert des de l'avís: es pot tancar */
  onTancar?(): void
}) {
  const magatzem = useMagatzem()
  const [text, setText] = useState('')
  const v = t.visita
  return (
    <section className={`panell addendes${onTancar ? ' addenda-oberta' : ''}`} aria-label={v.addendes}>
      <h2>{v.addendes}</h2>
      {addendes.length === 0 ? (
        <p className="detall">{v.capAddenda}</p>
      ) : (
        <ul>
          {addendes.map((a) => (
            <li key={a.id}>
              <span className="detall">{new Date(a.at).toLocaleString('ca')}</span> {a.text}
            </li>
          ))}
        </ul>
      )}
      {bloquejada && (
        <>
          <Camp etiqueta={v.novaAddenda}>
            <textarea rows={2} value={text} autoFocus={autoFocus} onChange={(e) => setText(e.target.value)} />
          </Camp>
          <Boto
            variant="secundari"
            disabled={text.trim() === ''}
            onClick={() =>
              void magatzem.afegirAddenda(sessioId, text).then(() => {
                setText('')
                onAfegida()
              })
            }
          >
            {v.afegirAddenda}
          </Boto>
          {onTancar && (
            <Boto variant="discret" onClick={onTancar}>
              {t.mapa.tancar}
            </Boto>
          )}
        </>
      )}
    </section>
  )
}

