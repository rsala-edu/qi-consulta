// Resum automàtic que es proposa en tancar l'episodi (etapa 3C): sessions,
// durada, escala inicial i final i els punts més usats. Es pot editar.

import type { ResumTancament } from '../domini/evolucio'
import { diaMes, formatar, t } from '../i18n/t'
import { textPercentatge } from './textos'

export function textResumTancament(r: ResumTancament): string {
  const e = t.evolucio
  if (r.sessions === 0 || !r.des || !r.fins) return ''
  const sessions = r.sessions === 1 ? e.unaSessioText : formatar(e.nSessions, { n: String(r.sessions) })
  const durada = r.setmanes === 0 ? e.menysDUnaSetmana : r.setmanes === 1 ? e.unaSetmana : formatar(e.nSetmanes, { n: String(r.setmanes) })
  const frases = [
    r.des === r.fins
      ? formatar(e.resumTancamentUnDia, { sessions, des: diaMes(r.des) })
      : formatar(e.resumTancament, { sessions, durada, des: diaMes(r.des), fins: diaMes(r.fins) }),
  ]
  if (r.escala)
    frases.push(
      formatar(e.resumTancamentEscala, {
        inicial: String(r.escala.inicial),
        final: String(r.escala.final),
        percentatge: r.escala.percentatge === null ? '' : ` (${textPercentatge(r.escala.percentatge)})`,
      }),
    )
  if (r.punts.length > 0)
    frases.push(formatar(e.resumTancamentPunts, { punts: r.punts.map((p) => formatar(e.resumPunt, { codi: p.codi, n: String(p.sessions) })).join(', ') }))
  return frases.join(' ')
}
