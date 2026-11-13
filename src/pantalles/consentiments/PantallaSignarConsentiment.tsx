// Signar un consentiment a la tauleta (etapa 4A): el text complet, que s'ha de
// llegir fins al final abans de poder signar; «He llegit i entès…»; si escau,
// el representant legal; la signatura del pacient amb el dit («Tornar a
// signar») i després la de la doctora. En desar, es genera el PDF (text,
// signatures, data i versió) i es desa xifrat amb el consentiment.

import { useState, type UIEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Boto } from '../../components/Boto'
import { Camp } from '../../components/Camp'
import { Indicador } from '../../components/Indicador'
import { generarPdfConsentiment } from '../../consentiment/pdf'
import { Signatura } from '../../consentiment/Signatura'
import { aprovadaDe, RELACIONS_REPRESENTANT, TIPUS_CONSENTIMENT, type TipusConsentiment } from '../../domini/consentiment'
import { nomComplet } from '../../domini/pacient'
import { araIso } from '../../domini/registre'
import { formatar, t } from '../../i18n/t'
import { useMagatzem } from '../../sessio/ContextSessio'
import { useCarrega } from '../../sessio/useCarrega'

const c = t.consentiments

export function PantallaSignarConsentiment() {
  const { id = '', tipus = '' } = useParams()
  const [cerca] = useSearchParams()
  const navegar = useNavigate()
  const magatzem = useMagatzem()
  const [carrega] = useCarrega(async () => {
    const [pacient, plantilles] = await Promise.all([magatzem.obtenirPacient(id), magatzem.plantillesConsentiment()])
    return { pacient, plantilla: (TIPUS_CONSENTIMENT as readonly string[]).includes(tipus) ? aprovadaDe(plantilles, tipus as TipusConsentiment) : null }
  }, [magatzem, id, tipus])
  const [llegit, setLlegit] = useState(false)
  const [entes, setEntes] = useState(false)
  const [ambRepresentant, setAmbRepresentant] = useState(false)
  const [representant, setRepresentant] = useState({ nom: '', dni: '', relacio: 'pare' as (typeof RELACIONS_REPRESENTANT)[number] })
  const [sigPacient, setSigPacient] = useState<string | null>(null)
  const [sigRepresentant, setSigRepresentant] = useState<string | null>(null)
  const [sigDoctora, setSigDoctora] = useState<string | null>(null)
  const [desant, setDesant] = useState(false)
  const tornar = cerca.get('tornar') ?? `/pacients/${id}/consentiments`

  if (carrega.estat === 'carregant') return <Indicador text={t.app.carregant} />
  if (carrega.estat === 'error' || !carrega.dades.pacient) return <p role="alert">{t.app.errorInesperat}</p>
  const { pacient, plantilla } = carrega.dades
  if (!plantilla)
    return (
      <main className="pantalla pantalla-signar">
        <p className="avis">{c.capAprovada}</p>
      </main>
    )

  // Amb representant, signa ell (el pacient menor pot signar o no); sense, el pacient
  const pacientSignat = ambRepresentant ? true : !!sigPacient
  const representantComplet = !ambRepresentant || (representant.nom.trim() !== '' && !!sigRepresentant)
  const potDesar = llegit && entes && pacientSignat && representantComplet && !!sigDoctora && !desant
  const llegir = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) setLlegit(true)
  }

  async function desar() {
    if (!plantilla || !sigDoctora) return
    setDesant(true)
    try {
      const signatAt = araIso()
      const rep = ambRepresentant && sigRepresentant ? { ...representant, nom: representant.nom.trim(), dni: representant.dni.trim(), signatura: sigRepresentant } : null
      // Sense la signatura del menor, la del representant fa de signatura del pacient al document
      const signaturaPacient = sigPacient ?? rep!.signatura
      const base = {
        tipus: plantilla.tipus,
        plantillaId: plantilla.id,
        versio: plantilla.versio,
        titol: plantilla.titol,
        text: plantilla.text,
        signatAt,
        signaturaPacient,
        representant: rep,
        signaturaDoctora: sigDoctora,
      }
      const pdf = await generarPdfConsentiment({
        ...base,
        pacient: nomComplet(pacient!),
        textos: {
          pacient: c.pacient,
          versio: c.versio,
          data: c.data,
          signaturaPacient: c.signaturaPacient,
          signaturaRepresentant: c.signaturaRepresentant,
          representant: c.representant,
          signaturaDoctora: c.signaturaDoctora,
          pagina: c.pagina,
        },
      })
      await magatzem.signarConsentiment(pacient!.id, { ...base, estat: 'vigent', revocacio: null, pdf })
      void navegar(tornar)
    } finally {
      setDesant(false)
    }
  }

  return (
    <main className="pantalla pantalla-signar">
      <h1>{formatar(c.titolSignar, { titol: plantilla.titol })}</h1>
      <p className="detall">
        {nomComplet(pacient)} · {c.versio} {plantilla.versio}
      </p>
      <div className="text-consentiment" tabIndex={0} role="document" aria-label={plantilla.titol} onScroll={llegir}>
        {plantilla.text.split('\n').map((p, i) => (p.trim() ? <p key={i}>{p}</p> : <br key={i} />))}
      </div>
      {!llegit && <p className="avis-suau" role="status">{c.llegeixFinsAlFinal}</p>}

      <label className="casella">
        <input type="checkbox" checked={entes} disabled={!llegit} onChange={(e) => setEntes(e.target.checked)} />
        {c.llegit}
      </label>

      <label className="casella">
        <input type="checkbox" checked={ambRepresentant} disabled={!entes} onChange={(e) => setAmbRepresentant(e.target.checked)} />
        {c.representantPregunta}
      </label>

      {entes && ambRepresentant && (
        <div className="representant">
          <Camp etiqueta={c.representantNom}>
            <input value={representant.nom} onChange={(e) => setRepresentant((r) => ({ ...r, nom: e.target.value }))} />
          </Camp>
          <Camp etiqueta={c.representantDni}>
            <input value={representant.dni} onChange={(e) => setRepresentant((r) => ({ ...r, dni: e.target.value }))} />
          </Camp>
          <Camp etiqueta={c.representantRelacio}>
            <select value={representant.relacio} onChange={(e) => setRepresentant((r) => ({ ...r, relacio: e.target.value as typeof r.relacio }))}>
              {RELACIONS_REPRESENTANT.map((x) => (
                <option key={x} value={x}>
                  {c.relacions[x]}
                </option>
              ))}
            </select>
          </Camp>
          <Signatura etiqueta={c.signaturaRepresentant} onCanviar={setSigRepresentant} />
        </div>
      )}

      {entes && <Signatura etiqueta={c.signaturaPacient} onCanviar={setSigPacient} />}
      {entes && pacientSignat && representantComplet && <Signatura etiqueta={c.signaturaDoctora} onCanviar={setSigDoctora} />}

      <div className="accions accions-esquerra">
        <Boto disabled={!potDesar} onClick={() => void desar()}>
          {desant ? c.desant : c.desar}
        </Boto>
        <Boto variant="discret" onClick={() => void navegar(tornar)}>
          {t.app.cancellar}
        </Boto>
      </div>
    </main>
  )
}
