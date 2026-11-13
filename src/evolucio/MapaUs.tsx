// Punts més usats «Al mapa» (etapa 3C): el cos en 2D i l'orella amb només els
// punts que s'han fet servir. Com més sessions, més gran i més intens (no
// només el color: també la mida). Tocar un punt en mostra les dades.

import { useMemo, useRef, useState } from 'react'
import { BarraVistes } from '../mapa/components/BarraVistes'
import { Visor2D } from '../mapa/components/Visor2D'
import type { ControlVisor, MarcadorVisor } from '../mapa/components/Visor3D'
import { etiquetesDelPunt } from '../mapa/etiquetaPunt'
import { llegirIdMarcador, puntsSobreModel } from '../mapa/marcadors'
import { useCalibracions } from '../mapa/useCalibracions'
import { useModelCos } from '../mapa/useModelCos'
import type { ModelCos } from '../mapa/model'
import { posicioOrella, puntOrella } from '../orella/cataleg'
import { VisorOrella, type PuntDibuix } from '../orella/components/VisorOrella'
import { useCorreccionsOrella } from '../orella/useCorreccionsOrella'
import type { CostatOrella } from '../orella/vista'
import type { UsPunt } from '../domini/evolucio'
import { Indicador } from '../components/Indicador'
import { diaCurtMes, formatar, t } from '../i18n/t'
import { GRAUS_US, grauUs } from './grausUs'
import { nomPunt } from './nomPunt'

interface Props {
  usos: readonly UsPunt[]
  mapes: readonly ('cos' | 'orella')[]
}

export function MapaUs({ usos, mapes }: Props) {
  const [triat, setTriat] = useState<string | null>(null)
  const maxim = Math.max(1, ...usos.map((u) => u.sessions))
  const us = triat ? usos.find((u) => u.clau === triat) : undefined
  return (
    <div className="mapa-us">
      <div className={`mapes-us${mapes.length > 1 ? ' dos' : ''}`}>
        {mapes.includes('cos') && (
          <CosUs usos={usos.filter((u) => u.mapa === 'cos')} maxim={maxim} triat={triat} onTriar={setTriat} />
        )}
        {mapes.includes('orella') && (
          <OrellaUs usos={usos.filter((u) => u.mapa === 'orella')} maxim={maxim} triat={triat} onTriar={setTriat} />
        )}
      </div>
      <div className="llegenda-us" aria-hidden="true">
        {GRAUS_US.map((g) => (
          <svg key={g.color} width="22" height="22" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r={4 * g.escala} fill={g.color} stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        ))}
        <span className="detall">{t.evolucio.llegendaMapa}</span>
      </div>
      <p className="fitxa-us" role="status">
        {us ? (
          <>
            <strong>
              {us.codi} · {nomPunt(us.mapa, us.codi)}
            </strong>{' '}
            {formatar(t.evolucio.fitxaPunt, {
              n: String(us.sessions),
              de: String(us.de),
              primera: diaCurtMes(us.primera.dia),
              ultima: diaCurtMes(us.ultima.dia),
              tecnica: t.mapa.tecnica[us.tecnica],
            })}
          </>
        ) : (
          <span className="detall">{t.evolucio.tocaPunt}</span>
        )}
      </p>
    </div>
  )
}

interface PropsMapa {
  usos: readonly UsPunt[]
  maxim: number
  triat: string | null
  onTriar(clau: string): void
}

function CosUs(props: PropsMapa) {
  const carrega = useModelCos()
  if (carrega.estat === 'carregant') return <div className="zona-visor zona-us"><Indicador text={t.evolucio.carregantCos} /></div>
  if (carrega.estat !== 'llest') return <div className="zona-visor zona-us"><p className="avis">{t.errorPantalla.cos3D}</p></div>
  return <CosAmbModel model={carrega.dades} {...props} />
}

function CosAmbModel({ model, usos, maxim, triat, onTriar }: PropsMapa & { model: ModelCos }) {
  const visor = useRef<ControlVisor>(null)
  const { efectiu } = useCalibracions(model.topologia)
  const perCodi = useMemo(() => new Map(usos.map((u) => [u.codi, u])), [usos])
  const marcadors: MarcadorVisor[] = useMemo(
    () =>
      puntsSobreModel(efectiu, model).flatMap((p) => {
        const u = perCodi.get(p.punt.codi)
        if (!u) return []
        const g = grauUs(u.sessions, maxim)
        return [
          {
            id: p.id,
            punt: p.posicio,
            normal: p.normal,
            color: g.color,
            escala: g.escala,
            destacat: triat === u.clau,
            etiquetes: etiquetesDelPunt(p.punt, p.index),
          },
        ]
      }),
    [efectiu, model, perCodi, maxim, triat],
  )
  return (
    <div className="columna-us">
      <div className="zona-visor zona-us">
        <Visor2D
          ref={visor}
          geometria={model.geometria}
          marcadors={marcadors}
          etiquetesSempre
          onTocarMarcador={(id) => {
            const u = perCodi.get(llegirIdMarcador(id).codi)
            if (u) onTriar(u.clau)
          }}
        />
      </div>
      <BarraVistes visor={visor} />
    </div>
  )
}

function OrellaUs({ usos, maxim, triat, onTriar }: PropsMapa) {
  const { correccions } = useCorreccionsOrella()
  const [costat, setCostat] = useState<CostatOrella>('E')
  const punts: PuntDibuix[] = useMemo(
    () =>
      usos.flatMap((u) => {
        const p = puntOrella(u.codi)
        if (!p) return []
        const pos = posicioOrella(p, correccions)
        const g = grauUs(u.sessions, maxim)
        return [{ id: u.clau, x: pos.x, y: pos.y, color: g.color, escala: g.escala, destacat: triat === u.clau, etiqueta: p.codi, etiquetaLlarga: `${p.codi} · ${p.nom}` }]
      }),
    [usos, correccions, maxim, triat],
  )
  return (
    <div className="columna-us">
      <div className="zona-visor zona-us">
        <VisorOrella costat={costat} punts={punts} modeToc="punt" onTocarPunt={onTriar} />
      </div>
      <div className="segmentat" role="radiogroup" aria-label={t.orella.quinaOrella}>
        {(['E', 'D'] as const).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={costat === c} onClick={() => setCostat(c)}>
            {c === 'E' ? t.orella.esquerra : t.orella.dreta}
          </button>
        ))}
      </div>
    </div>
  )
}
