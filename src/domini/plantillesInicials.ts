// Les tres plantilles de consentiment inicials (etapa 4A), en català clar.
// Totes «Pendent de revisió»: les ha de revisar la professional responsable.
// Els claudàtors són camps per completar.

import type { DadesPlantilla, TipusConsentiment } from './consentiment'

export const NOTA_ORIENTATIVA =
  'Plantilla orientativa. L\'ha de revisar la professional responsable, i és recomanable contrastar-la amb el Col·legi de Metges o un assessor legal.'

const ACUPUNTURA = `CONSENTIMENT INFORMAT PER AL TRACTAMENT D'ACUPUNTURA I TÈCNIQUES ASSOCIADES

Professional responsable: [NOM I COGNOMS DE LA DOCTORA], metgessa col·legiada núm. [NÚMERO DE COL·LEGIADA] del Col·legi Oficial de Metges de [PROVÍNCIA].
Consulta: [ADREÇA DE LA CONSULTA] · Telèfon: [TELÈFON]

1. En què consisteix
L'acupuntura consisteix a inserir agulles molt fines, estèrils i d'un sol ús en punts concrets del cos. Les agulles es deixen uns minuts (normalment entre 15 i 30) i després es retiren i es llencen.
Segons el que necessiti, el tractament es pot completar amb:
- Moxa: escalfor sobre la pell o sobre l'agulla, amb artemísia que crema lentament.
- Ventoses: copes que fan succió sobre la pell.
- Electroacupuntura: un corrent elèctric suau i de baixa intensitat entre dues agulles.
- Llavors o boles auriculars: petites llavors enganxades amb un esparadrap a l'orella, que es poden deixar uns dies.
La doctora li explicarà quines tècniques fa servir en el seu cas i per què.

2. Beneficis esperats
L'objectiu és millorar els símptomes pels quals consulta (per exemple, el dolor o la qualitat del son). La resposta és diferent per a cada persona: no es pot garantir cap resultat, i sovint calen diverses sessions per valorar-ne l'efecte.

3. Riscos i efectes adversos
Habituals i lleus (solen passar sols en poques hores o dies):
- Petita molèstia o dolor en posar l'agulla.
- Un punt de sang o un petit morat on s'ha posat l'agulla.
- Cansament, somnolència o una sensació de mareig lleu durant la sessió o després.
- Amb les ventoses, marques rodones a la pell que desapareixen en uns dies.
- Que els símptomes empitjorin una mica al principi, abans de millorar.
Infreqüents:
- Desmai o baixada de tensió durant la sessió.
- Petites cremades o butllofes amb la moxa.
- Irritació de la pell per l'esparadrap de les llavors auriculars.
- Infecció local on s'ha posat l'agulla.
Molt rars però greus:
- Lesió d'un òrgan intern, com el pulmó (pneumotòrax), si s'insereix una agulla a la zona del tòrax.
- Que una agulla es trenqui dins la pell.
Si després de la sessió nota falta d'aire, dolor al pit, febre o una zona vermella i calenta que augmenta, ho ha de comunicar de seguida.

4. Contraindicacions i precaucions
Abans de cada tractament, informi la doctora si:
- està embarassada o podria estar-ho (hi ha punts i tècniques que no es fan durant l'embaràs);
- pren anticoagulants o antiagregants, o té algun trastorn de la coagulació;
- porta un marcapassos, un desfibril·lador o un altre aparell electrònic implantat (no es pot fer electroacupuntura);
- té epilèpsia, diabetis, problemes de pell a la zona a tractar, una infecció, o por intensa a les agulles;
- té al·lèrgia als metalls o a l'esparadrap;
- ha canviat res de la seva salut o de la seva medicació des de la darrera visita.

5. Alternatives
Pot optar per altres tractaments (medicaments, fisioteràpia, exercici o altres teràpies), o per no fer cap tractament. La doctora li pot explicar les alternatives adequades al seu cas.

6. Dret a retirar-se
Pot fer preguntes en qualsevol moment, demanar que s'aturi la sessió i retirar aquest consentiment quan vulgui, sense haver de donar explicacions i sense que això afecti l'atenció que rep.

7. Declaració
He llegit aquest document, he pogut fer les preguntes que he volgut i les respostes m'han quedat clares. Dono el meu consentiment per rebre tractament d'acupuntura i, si escau, les tècniques associades que s'hi descriuen.`

const DADES = `CONSENTIMENT PER AL TRACTAMENT DE DADES DE SALUT

En compliment del Reglament (UE) 2016/679 (Reglament general de protecció de dades, RGPD) i de la Llei orgànica 3/2018, de protecció de dades personals i garantia dels drets digitals (LOPDGDD).

1. Responsable del tractament
[NOM I COGNOMS DE LA DOCTORA], metgessa col·legiada núm. [NÚMERO DE COL·LEGIADA].
Adreça: [ADREÇA DE LA CONSULTA] · Telèfon: [TELÈFON] · Correu electrònic: [CORREU ELECTRÒNIC]

2. Quines dades i per a què
Es tracten les seves dades identificatives i de contacte, i les dades de salut necessàries per a la seva atenció: antecedents, valoracions, diagnòstics, tractaments, evolució i, si hi dona el consentiment a part, imatges clíniques.
La finalitat és prestar-li l'assistència sanitària, fer-ne el seguiment, gestionar les cites i complir les obligacions legals de la història clínica.
No s'utilitzaran per a cap altra finalitat ni per enviar-li publicitat.

3. Base legal
- La prestació de l'assistència sanitària que vostè sol·licita (article 6.1.b i article 9.2.h de l'RGPD).
- El compliment de les obligacions legals sobre la història clínica (article 6.1.c de l'RGPD i Llei 41/2002, de 14 de novembre, d'autonomia del pacient).
- El seu consentiment explícit, que dona amb aquest document (article 9.2.a de l'RGPD).

4. Quant de temps es conserven
La història clínica es conserva com a mínim cinc anys des de la data de l'alta de cada procés assistencial, tal com estableix la Llei 41/2002 (article 17), i el temps addicional que exigeixi qualsevol altra norma aplicable. Passat aquest termini, les dades es destrueixen de manera segura.

5. On es desen i com es protegeixen
Les dades es desen xifrades al dispositiu de la doctora i, com a còpia de seguretat, també xifrades al Google Drive de la responsable. Es xifren abans de sortir del dispositiu i només es poden llegir amb la contrasenya de la doctora: Google no hi pot accedir.
Google actua com a encarregat del tractament per a l'emmagatzematge. [COMPLETAR: país o regió on es desen les dades i garanties aplicables a les transferències internacionals.]

6. A qui es comuniquen
No es comuniquen a ningú, llevat d'obligació legal o que vostè ho autoritzi (per exemple, un informe per a un altre professional).

7. Els seus drets
Pot exercir els drets d'accés, rectificació, supressió (dins dels límits que fixa la llei per a la història clínica), limitació, oposició i portabilitat, i retirar el consentiment en qualsevol moment sense que això afecti el tractament fet abans.
Com fer-ho: per escrit a l'adreça de la consulta o al correu electrònic [CORREU ELECTRÒNIC], adjuntant una còpia del document d'identitat.
Si considera que no s'han respectat els seus drets, pot presentar una reclamació a l'Autoritat Catalana de Protecció de Dades (apdcat.gencat.cat) o a l'Agència Espanyola de Protecció de Dades (aepd.es).

8. Declaració
He llegit aquesta informació i hi dono el meu consentiment explícit per al tractament de les meves dades de salut amb les finalitats indicades.`

const IMATGES = `CONSENTIMENT PER A IMATGES CLÍNIQUES

Professional responsable: [NOM I COGNOMS DE LA DOCTORA], metgessa col·legiada núm. [NÚMERO DE COL·LEGIADA].
Consulta: [ADREÇA DE LA CONSULTA] · Telèfon: [TELÈFON]

1. Què són i per a què serveixen
Durant el tractament pot ser útil fer fotografies d'algunes zones del cos (per exemple, la llengua, la pell o una zona tractada) per veure'n l'evolució i comparar com estava abans i després.
Les fotos formen part de la seva història clínica i només s'utilitzen per a la seva atenció.

2. Com es fan i es protegeixen
- Es fan amb la càmera de l'aplicació de la consulta: no passen per la galeria del dispositiu.
- Abans de desar-les, se'n treuen les dades amagades del fitxer (com la ubicació).
- Es desen xifrades, igual que la resta de la seva història clínica, al dispositiu de la doctora i a la còpia de seguretat xifrada del Google Drive de la responsable.
- Sempre que sigui possible, es fotografia només la zona necessària i s'evita que se li vegi la cara o qualsevol tret que la identifiqui.

3. Què no es farà
Les fotos no es publicaran, no es faran servir en classes, congressos ni publicacions, i no es compartiran amb ningú sense un consentiment específic i per escrit per a aquell ús.

4. Conservació
Es conserven amb la història clínica, com a mínim cinc anys des de l'alta (Llei 41/2002), i després es destrueixen de manera segura.

5. Els seus drets
Pot negar-se a fer-se fotos sense que això afecti el tractament. Pot retirar aquest consentiment en qualsevol moment: a partir d'aleshores no se li faran més fotos. Pot demanar veure les fotos que s'han fet i exercir els drets que s'expliquen al consentiment de tractament de dades.

6. Declaració
He llegit aquesta informació i dono el meu consentiment perquè es facin i es conservin fotografies clíniques amb les condicions indicades.`

export const PLANTILLES_INICIALS: Record<TipusConsentiment, Pick<DadesPlantilla, 'titol' | 'text'>> = {
  acupuntura: { titol: 'Acupuntura i tècniques associades', text: ACUPUNTURA },
  dades: { titol: 'Tractament de dades de salut', text: DADES },
  imatges: { titol: 'Imatges clíniques', text: IMATGES },
}

export function plantillaInicial(tipus: TipusConsentiment, ara: string): DadesPlantilla {
  return { tipus, ...PLANTILLES_INICIALS[tipus], versio: 1, data: ara, estat: 'pendent', nota: NOTA_ORIENTATIVA }
}
