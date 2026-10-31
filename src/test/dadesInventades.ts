// Dades INVENTADES per a les proves. Mai cap dada real de pacients.
import type { DadesFitxaClinica } from '../domini/fitxaClinica'
import { dadesPacientBuides, type DadesPacient } from '../domini/pacient'

export function pacientInventat(canvis: Partial<DadesPacient> = {}): DadesPacient {
  return {
    ...dadesPacientBuides(),
    nom: 'Aina',
    llinatges: 'Provencal Inventada',
    dataNaixement: '1980-05-17',
    sexe: 'dona',
    telefon: '600 111 222',
    correu: 'aina@exemple.invalid',
    ...canvis,
  }
}

export function fitxaInventada(): DadesFitxaClinica {
  return {
    antecedentsPersonals: 'Otitis de petita',
    antecedentsFamiliars: 'Pare amb hipertensió',
    medicacioActual: 'Cap',
    alergies: 'Penicil·lina',
    contraindicacions: { anticoagulants: true, embaras: false, marcapassos: false, altres: '' },
    habits: { son: 'Es desperta a les 3', tabac: 'No', alcohol: 'Ocasional', exercici: 'Camina' },
  }
}

export async function clauDeProva(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
