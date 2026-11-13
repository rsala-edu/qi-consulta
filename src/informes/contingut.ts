// Contingut dels informes (etapa 4D): de les dades de l'app als blocs del PDF.
// Funcions pures (es proven soles); les imatges del cos i de l'orella les
// prepara la pantalla i arriben fetes.

import { resumSeccio } from '../cataleg/motor'
import { DIAGNOSTIC } from '../cataleg/diagnostic'
import { EXPLORACIO } from '../cataleg/exploracio'
import type { DadesSeccions } from '../cataleg/tipus'
import type { Consentiment } from '../domini/consentiment'
import type { Episodi } from '../domini/episodi'
import { ordenades, puntsMesUsats, puntsTractament, resumEscala, resumTancament, serieEvolucio, minutsRetencio } from '../domini/evolucio'
import { nomComplet, type Pacient } from '../domini/pacient'
import { agullesPosades, type Sessio } from '../domini/sessio'
import type { Valoracio } from '../domini/valoracio'
import { diaCurtMes, diaLlarg, formatar, t } from '../i18n/t'
import { nomPunt } from '../evolucio/nomPunt'
import { textResum } from '../evolucio/textos'
import { textResumTancament } from '../evolucio/resumTancament'
import type { Bloc, DadesConsulta, Informe } from './pdf'

const i = t.informes
const dia = (iso: string) => diaLlarg(new Date(iso).toISOString().slice(0, 10))
const peu = { pagina: i.pagina, confidencial: i.confidencial, col: i.col }

/** Text de les seccions d'un grup que tenen alguna cosa (exploració, diagnòstic) */
function seccionsAmbText(grup: typeof EXPLORACIO, dades: DadesSeccions): [string, string][] {
  return grup.seccions.flatMap((s) => {
    const text = resumSeccio(s, dades[s.id], t.cataleg.normal)
    return text ? [[s.ca, text] as [string, string]] : []
  })
}

function blocsPunts(s: Pick<Sessio, 'punts'>): Bloc[] {
  const punts = puntsTractament(s.punts)
  if (punts.length === 0) return [{ tipus: 'paragraf', text: i.capPunt }]
  return [
    {
      tipus: 'taula',
      columnes: [i.punts, i.costat, i.tecnica],
      amples: [3, 1.2, 1.5],
      files: punts.map((p) => [`${p.codi} · ${nomPunt(p.mapa, p.codi)}${p.mapa === 'orella' ? ` (${i.orella})` : ''}`, t.mapa.costat[p.costat], t.mapa.tecnica[p.tecnica]]),
    },
  ]
}

export interface ImatgesPunts {
  cos?: { davant: string; darrere: string }
  orella?: string
}

export function informeSessio(d: {
  consulta: DadesConsulta
  pacient: Pacient
  episodi: Episodi | null
  sessio: Sessio
  imatges?: ImatgesPunts
}): Informe {
  const { sessio: s } = d
  const blocs: Bloc[] = [
    {
      tipus: 'parelles',
      files: [
        [i.pacient, nomComplet(d.pacient)],
        [i.data, dia(s.iniciAt)],
        [i.episodiCol, d.episodi?.motiu ?? '—'],
      ],
    },
    { tipus: 'titol', text: i.comEsta },
    {
      tipus: 'parelles',
      files: [
        [i.canvis, s.comEsta.canvis || '—'],
        [i.escalaPrincipal, s.comEsta.escala === null ? '—' : String(s.comEsta.escala)],
        ...(['secundari1', 'secundari2'] as const)
          .filter((k) => s.comEsta[k].nom || s.comEsta[k].escala !== null)
          .map((k) => [s.comEsta[k].nom || k, s.comEsta[k].escala === null ? '—' : String(s.comEsta[k].escala)] as [string, string]),
      ],
    },
  ]
  const expl = seccionsAmbText(EXPLORACIO, s.exploracio.seccions)
  if (expl.length > 0) blocs.push({ tipus: 'titol', text: i.exploracio }, { tipus: 'parelles', files: expl })
  blocs.push({ tipus: 'titol', text: i.punts }, ...blocsPunts(s))
  const imatges = [
    ...(d.imatges?.cos ? [{ png: d.imatges.cos.davant, peu: i.cos }, { png: d.imatges.cos.darrere, peu: i.cosDarrere }] : []),
    ...(d.imatges?.orella ? [{ png: d.imatges.orella, peu: i.orella }] : []),
  ]
  if (imatges.length > 0) blocs.push({ tipus: 'imatges', imatges, alcada: 230 })
  const ret = minutsRetencio(s)
  blocs.push({
    tipus: 'parelles',
    files: [
      [i.retencio, ret === null ? i.senseRetencio : formatar(i.minuts, { n: String(ret) })],
      [i.agulles, `${agullesPosades(s)} / ${s.agulles.retirades ?? '—'}`],
      [i.incidencies, s.tancar.incidencies || (s.tancar.capIncidencia ? i.cap : '—')],
      [i.recomanacions, s.tancar.recomanacions || '—'],
    ],
  })
  return {
    titol: `${i.sessio} · ${formatar(i.sessioN, { n: String(s.numero) })}`,
    subtitol: `${nomComplet(d.pacient)} · ${dia(s.iniciAt)}`,
    blocs,
    consulta: d.consulta,
    peu,
  }
}

function blocsEpisodi(episodi: Episodi, sessions: readonly Sessio[], valoracions: readonly Valoracio[]): Bloc[] {
  const llista = ordenades(sessions)
  const serie = serieEvolucio(llista)
  const blocs: Bloc[] = [
    {
      tipus: 'parelles',
      files: [
        [i.motiu, episodi.motiu],
        [i.data, diaLlarg(episodi.dataInici)],
        [i.estat, t.tractaments.estats[episodi.estat]],
      ],
    },
  ]
  const diag = seccionsAmbText(DIAGNOSTIC, valoracions.at(-1)?.seccions ?? {})
  if (diag.length > 0) blocs.push({ tipus: 'subtitol', text: i.diagnostic }, { tipus: 'parelles', files: diag })
  if (episodi.pla) {
    const p = episodi.pla
    blocs.push(
      { tipus: 'subtitol', text: i.pla },
      {
        tipus: 'parelles',
        files: [
          [i.sessionsPrevistes, p.sessions ? String(p.sessions) : '—'],
          [i.frequencia, p.frequencia ? t.pla.frequencies[p.frequencia] : '—'],
          [i.objectius, p.objectius || '—'],
        ],
      },
    )
  }
  if (serie.some((x) => x.principal !== null)) {
    const resum = resumEscala(serie.map((x) => ({ numero: x.numero, valor: x.principal })))
    blocs.push({ tipus: 'subtitol', text: i.evolucio })
    if (resum) blocs.push({ tipus: 'paragraf', text: textResum(resum) })
    blocs.push({
      tipus: 'grafic',
      titol: i.escalaPrincipal,
      valors: serie.map((x) => x.principal),
      etiquetes: serie.map((x) => `S${x.numero}`),
      min: 0,
      max: 10,
    })
  }
  const usats = puntsMesUsats(llista).slice(0, 10)
  if (usats.length > 0)
    blocs.push(
      { tipus: 'subtitol', text: i.puntsMesUsats },
      {
        tipus: 'taula',
        columnes: [i.punts, t.evolucio.columnes.sessions, i.tecnica],
        amples: [3, 1.6, 1.5],
        files: usats.map((u) => [`${u.codi} · ${nomPunt(u.mapa, u.codi)}`, formatar(t.evolucio.enSessions, { n: String(u.sessions), de: String(u.de) }), t.mapa.tecnica[u.tecnica]]),
      },
    )
  if (llista.length > 0)
    blocs.push(
      { tipus: 'subtitol', text: i.resumSessions },
      {
        tipus: 'taula',
        columnes: [i.columnes.sessio, i.columnes.data, i.columnes.escala, i.columnes.punts, i.columnes.retencio],
        files: serie.map((x) => [
          String(x.numero),
          diaCurtMes(x.dia),
          x.principal === null ? '—' : String(x.principal),
          String(x.punts),
          x.retencio === null ? '—' : formatar(i.minuts, { n: String(x.retencio) }),
        ]),
      },
    )
  if (episodi.estat !== 'actiu')
    blocs.push(
      { tipus: 'subtitol', text: i.tancament },
      { tipus: 'paragraf', text: [episodi.dataFinal ? diaLlarg(episodi.dataFinal) : '', episodi.notaFinal || textResumTancament(resumTancament(llista))].filter(Boolean).join(' · ') },
    )
  return blocs
}

export function informeEpisodi(d: { consulta: DadesConsulta; pacient: Pacient; episodi: Episodi; sessions: readonly Sessio[]; valoracions: readonly Valoracio[] }): Informe {
  return {
    titol: `${i.episodi} · ${d.episodi.motiu}`,
    subtitol: `${nomComplet(d.pacient)} · ${diaLlarg(d.episodi.dataInici)}`,
    blocs: blocsEpisodi(d.episodi, d.sessions, d.valoracions),
    consulta: d.consulta,
    peu,
  }
}

export function historialPacient(d: {
  consulta: DadesConsulta
  pacient: Pacient
  episodis: readonly Episodi[]
  sessions: readonly Sessio[]
  valoracions: ReadonlyMap<string, readonly Valoracio[]>
  consentiments: readonly Consentiment[]
}): Informe {
  const blocs: Bloc[] = [
    {
      tipus: 'parelles',
      files: [
        [i.pacient, nomComplet(d.pacient)],
        [i.naixement, d.pacient.dataNaixement ? diaLlarg(d.pacient.dataNaixement) : '—'],
      ],
    },
  ]
  if (d.episodis.length === 0) blocs.push({ tipus: 'paragraf', text: i.capEpisodi })
  for (const e of [...d.episodis].sort((a, b) => a.dataInici.localeCompare(b.dataInici))) {
    blocs.push({ tipus: 'titol', text: `${i.episodiCol}: ${e.motiu}` }, ...blocsEpisodi(e, d.sessions.filter((s) => s.episodiId === e.id), d.valoracions.get(e.id) ?? []))
    for (const s of ordenades(d.sessions.filter((x) => x.episodiId === e.id))) {
      blocs.push(
        { tipus: 'subtitol', text: `${formatar(i.sessioN, { n: String(s.numero) })} · ${dia(s.iniciAt)}` },
        {
          tipus: 'parelles',
          files: [
            [i.canvis, s.comEsta.canvis || '—'],
            [i.escalaPrincipal, s.comEsta.escala === null ? '—' : String(s.comEsta.escala)],
            [i.punts, puntsTractament(s.punts).map((p) => p.codi).join(', ') || '—'],
            [i.incidencies, s.tancar.incidencies || '—'],
          ],
        },
      )
    }
  }
  blocs.push({ tipus: 'titol', text: i.consentiments })
  if (d.consentiments.length === 0) blocs.push({ tipus: 'paragraf', text: i.capConsentiment })
  else
    blocs.push({
      tipus: 'taula',
      columnes: [t.consentiments.titol, i.data, i.estat],
      amples: [2.5, 1.6, 1.6],
      files: d.consentiments.map((c) => [
        `${c.titol} (v${c.versio})`,
        dia(c.signatAt),
        c.estat === 'vigent' ? t.consentiments.estats.vigent : `${t.consentiments.estats.revocat} · ${c.revocacio ? dia(c.revocacio.at) : ''}`,
      ]),
    })
  return { titol: i.historial, subtitol: nomComplet(d.pacient), blocs, consulta: d.consulta, peu }
}
