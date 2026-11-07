// D'on surt cada catàleg, i amb quina llicència. Es mostra a Ajustos > Catàlegs.

import type { IdFont } from './tipus'

export interface Font {
  titol: string
  detall: string
  llicencia: string
}

export const FONTS: Record<IdFont, Font> = {
  'oms-ist-2022': {
    titol: 'WHO International Standard Terminologies on Traditional Chinese Medicine (OMS, 2022)',
    detall: 'Terminologia de la llengua, el pols, les deu preguntes, els vuit principis, els zang-fu i els principis de tractament. Termes traduïts al català per a aquesta app.',
    llicencia: 'CC BY-NC-SA 3.0 IGO (la traducció catalana es comparteix amb la mateixa llicència)',
  },
  'cim11-tm1': {
    titol: 'CIM-11 (ICD-11 MMS), capítol 26: Traditional Medicine Module 1 (OMS, versió de gener de 2025)',
    detall: 'Patrons (síndromes) amb el codi i el títol oficial en anglès, sense modificar.',
    llicencia: 'CC BY-ND 3.0 IGO: no es pot traduir sense permís de l\'OMS; per això el títol es mostra en anglès',
  },
  'cim11-mms': {
    titol: 'CIM-11 (ICD-11 MMS), capítols 1 a 25 (OMS, versió de gener de 2025)',
    detall: 'Diagnòstic occidental: codi i títol oficial en anglès, sense modificar.',
    llicencia: 'CC BY-ND 3.0 IGO',
  },
  'zyyxh-t157-2009': {
    titol: 'ZYYXH/T157-2009 · Classificació i determinació de la constitució en MTC (China Association of Chinese Medicine)',
    detall: 'Els nou tipus de constitució (中医体质分类与判定).',
    llicencia: 'Estàndard d\'associació; només se\'n fan servir els noms dels tipus',
  },
  'mtc-diagnosi': {
    titol: 'Diagnosi clàssica en MTC: inspecció, auscultació-olfacció, interrogatori i palpació (四诊)',
    detall: 'Ampliació de les deu preguntes (十问) i de la inspecció, amb la terminologia de l\'OMS quan existeix.',
    llicencia: 'Coneixement clínic general; textos propis de l\'app',
  },
  'orl-clinica': {
    titol: 'Exploració ORL clínica',
    detall: 'Otoscòpia, rinoscòpia, orofaringe, laringe, acumetria (Rinne i Weber), audiometria tonal, timpanometria (classificació de Jerger) i exploració vestibular.',
    llicencia: 'Coneixement clínic general; textos propis de l\'app',
  },
  escala: {
    titol: 'Escales de resultats (THI, DHI, SNOT-22, MYMOP)',
    detall: 'Només es desen les puntuacions i el grau de gravetat; el text dels ítems no és a l\'app.',
    llicencia: 'THI i DHI: copyright dels autors i de l\'AMA, sense llicència clínica publicada. SNOT-22: cal llicència de la Washington University. MYMOP: cal llicència de Meaningful Measures Ltd.',
  },
}
