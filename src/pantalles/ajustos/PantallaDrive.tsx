// Ajustos > Còpia a Google Drive: què passa amb la còpia i què es pot fer.
// Quan aquest dispositiu i Drive tenen dades tancades amb claus diferents
// (DRV-K), dues opcions explicades: recuperar les dades de Drive o fusionar-hi
// les d'aquest dispositiu. Totes dues descarreguen abans un .qi de les dades
// del dispositiu i el desen també dins el dispositiu.

import { useState } from 'react'
import { Link } from 'react-router'
import { Boto } from '../../components/Boto'
import { descarregarText } from '../../components/descarregar'
import { DetallsTecnics } from '../../components/DetallsTecnics'
import { EstatCopia } from '../../components/EstatCopia'
import { BotoTornarConnectar } from '../../components/BotoTornarConnectar'
import { FormulariCredencial } from '../../components/FormulariCredencial'
import { formatar, t } from '../../i18n/t'
import { useClauMestra, useSessio } from '../../sessio/ContextSessio'
import {
  desarCopiaAbansCanviClau,
  fusionarAmbDrive,
  nomFitxerQi,
  obrirClauCopia,
  recuperarDeDrive,
  type Credencial,
} from '../../sincronia/canviClau'
import { useSincronia } from '../../sincronia/ContextSincronia'
import { driveGoogle } from '../../sincronia/drive'
import { tokenGoogle } from '../../sincronia/google'
import { copiaDeDrive } from '../../sincronia/sincronitzar'

type Opcio = 'recuperar' | 'fusionar'

interface Resultat {
  opcio: Opcio
  nom: string
  possiblesDuplicats: number
  conflictes: number
}

export class ErrorSenseCopia extends Error {
  constructor() {
    super('A Drive no hi ha cap còpia')
    this.name = 'ErrorSenseCopia'
  }
}

export function PantallaDrive() {
  const { db, adoptarClau } = useSessio()
  const clau = useClauMestra()
  const { estat, error } = useSincronia()
  const [opcio, setOpcio] = useState<Opcio | null>(null)
  const [resultat, setResultat] = useState<Resultat | null>(null)
  const d = t.drive

  async function fer(o: Opcio, credencial: Credencial) {
    const drive = driveGoogle(tokenGoogle)
    const fitxer = await copiaDeDrive(drive)
    if (!fitxer) throw new ErrorSenseCopia()
    // Primer la contrasenya: si és incorrecta, no s'ha tocat res
    const clauDrive = await obrirClauCopia(fitxer, credencial)
    // Les dades d'abans, descarregades i desades dins el dispositiu
    const nom = nomFitxerQi()
    descarregarText(await desarCopiaAbansCanviClau(db, clau), nom)
    let r = { possiblesDuplicats: 0, conflictes: 0 }
    if (o === 'fusionar') r = await fusionarAmbDrive(db, clau, fitxer, clauDrive, drive)
    else await recuperarDeDrive(db, clau, fitxer, clauDrive, drive)
    setResultat({ opcio: o, nom, ...r })
    // A partir d'ara, la clau de Drive: la sincronia puja les dades fusionades
    adoptarClau(clauDrive)
  }

  const clauDiferent = estat === 'error' && error?.motiu === 'clau'

  return (
    <main className="pantalla">
      <Link className="enllac-tornar" to="/ajustos/seguretat">
        ← {t.seguretat.titol}
      </Link>
      <h1>{resultat || !clauDiferent ? d.titol : d.titolClau}</h1>

      {resultat ? (
        <section className="panell" role="status" aria-label={d.fet[resultat.opcio]}>
          <p>
            <strong>{d.fet[resultat.opcio]}</strong>
          </p>
          <p>{d.contrasenyaNova}</p>
          {resultat.possiblesDuplicats > 0 && (
            <p>
              {formatar(d.duplicats, { n: String(resultat.possiblesDuplicats) })}{' '}
              <Link to="/pacients">{t.pacients.titol}</Link>
            </p>
          )}
          {resultat.conflictes > 0 && <p>{formatar(d.conflictes, { n: String(resultat.conflictes) })}</p>}
          <p className="detall">{formatar(d.descarregat, { nom: resultat.nom })}</p>
          <EstatCopia />
        </section>
      ) : clauDiferent ? (
        <>
          <p>{d.introClau}</p>
          <div className="opcions-clau">
            {(['fusionar', 'recuperar'] as const).map((o) => (
              <section key={o} className="opcio-clau" aria-label={d[o]} aria-current={opcio === o}>
                <h2>{d[o]}</h2>
                <p>{o === 'fusionar' ? d.fusionarDesc : d.recuperarDesc}</p>
                {opcio === o ? (
                  <>
                    <p className="detall">{d.contrasenyaDrive}</p>
                    <FormulariCredencial
                      etiquetaContrasenya={d.contrasenya}
                      etiquetaClau={d.clauRecuperacio}
                      textBoto={d.fer[o]}
                      textFent={d.fent[o]}
                      onCredencial={(c) => fer(o, c)}
                      onCancellar={() => setOpcio(null)}
                    />
                  </>
                ) : (
                  <Boto variant={o === 'fusionar' ? 'principal' : 'secundari'} onClick={() => setOpcio(o)}>
                    {d[o]}
                  </Boto>
                )}
              </section>
            ))}
          </div>
        </>
      ) : (
        <section className="panell">
          <EstatCopia />
          {estat === 'al-dia' && <p>{d.totBe}</p>}
          <p className="detall">{t.sincronia.tornarConnectarDesc}</p>
          <div className="accions accions-esquerra">
            <BotoTornarConnectar />
          </div>
        </section>
      )}
      <DetallsTecnics />
    </main>
  )
}

