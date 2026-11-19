# Estat del projecte

Actualitzat el 19 de novembre de 2026.

## On som
- **Publicat a main:** tota l'etapa 4, les correccions de la visita i l'exportació de dades. «Publicar» i «Proves completes» en verd.
- **Etapa 4:**
  - 4A: consentiment informat. Plantilles versionades, signatura a la tauleta, PDF a la fitxa i revocar. Les plantilles són «Pendent de revisió»: es poden provar, i el document porta la marca «ESBORRANY – pendent de revisió» fins que la doctora les aprova a Ajustos > Consentiments (queden la versió i la data d'aprovació).
  - 4B: protocols de punts.
  - 4C: fotos clíniques. Sense EXIF, xifrades, i a Drive com a fitxers a part.
  - 4D: informes en PDF (de la sessió, de l'episodi i l'historial complet), amb Ajustos > Consulta.
  - 4E: documents adjunts:
    - què s'hi pot desar: PDF i imatges, també HEIC, fins a 25 MB per fitxer;
    - «Fotografiar document»: diverses pàgines que es desen en un PDF, amb la càmera del sistema o un fitxer com a alternativa;
    - «Pujar fitxer»: diversos fitxers alhora, o arrossegant-los al PC;
    - visor dins l'app amb pdf.js, sense desar res al disc;
    - estat «Pendent de pujar», i els 30 documents oberts més recentment es guarden en local;
    - anul·lar amb motiu, sense esborrar res;
    - vincle a una sessió o a una valoració, i els documents de l'episodi es veuen a la visita;
    - «Compartir → Qi» (Web Share Target).
- **Correccions de la visita:**
  - temporitzador: tres pitits amb volum i «Provar el so»; Pausa i Continuar en un sol botó; «Agulles retirades», que desa el temps real; «Retenció completa»;
  - motiu de l'episodi amb majúscula;
  - incidències: primer «Cap / Hi ha hagut»;
  - avisos d'estat en color neutre;
  - data de revisió del pla calculada;
  - res es mou en desar.
- **Dret d'accés i de portabilitat:** el botó «Exportar totes les dades» (fitxa > Dades) descarrega un JSON. «Quant a» llista el programari de tercers i la seva llicència.
- **Etapes anteriors:** 1 i 2, la sincronia amb Drive, 3A, 3B, 3C i ajuntar fitxes. El detall de cada etapa és a `docs/especificacions.md`.

## Per a la doctora
Tot el que ha de revisar, amb on trobar-ho a l'app, és a **`docs/revisio-doctora.md`**.

## Decisions pendents: llicències
Fins que no es decideixi, l'app no inclou el text de cap qüestionari: només desa les puntuacions i el grau de gravetat.

- **SNOT-22:** cal llicència de la Washington University per a qualsevol ús. La clínica costa 500 $ l'any per grup de fins a 20 clínics, i una versió electrònica necessita la seva aprovació. Cal decidir si es treu la llicència o es treu l'escala.
- **MYMOP:** cal llicència escrita de Meaningful Measures Ltd, de pagament per a organitzacions amb ànim de lucre. Les traduccions necessiten un acord a part.
- **THI i DHI:** copyright dels autors i de l'AMA. Cal decidir si es demana permís o es continua només amb les puntuacions.
- **Terminologia de l'OMS (2022):** CC BY-NC-SA 3.0 IGO. Només es pot fer servir en ús no comercial. Cal valorar si la consulta privada ho és.
- **CIM-11:** CC BY-ND 3.0 IGO. Els títols surten en anglès.
- **heic2any:** inclou libheif (LGPL 3.0). Es fa servir sense modificar, com a biblioteca a part que es carrega quan cal.

## Decisions pendents: altres
- **Esborrar un pacient sencer (dret de supressió):** l'app no ho fa. Els documents i les fotos només s'anul·len i la història clínica es conserva, perquè la Llei 41/2002 obliga a conservar-la com a mínim cinc anys. Un esborrat definitiu no es pot desfer: s'ha de decidir quan i com es fa (per exemple, només un cop passat el termini de conservació).

## Què queda
1. **La revisió de la doctora** (`docs/revisio-doctora.md`).
2. **Provar la tauleta i el mòbil amb el seu compte de Google:** instal·lació, entrada, sincronia, una visita sencera, «Compartir → Qi» i fotos HEIC d'un iPhone o un iPad. La conversió HEIC no té prova E2E, perquè en aquesta màquina no hi ha cap eina per crear un fitxer HEIC de prova.
3. **La fitxa clínica nova de la doctora** (cal el seu model).
4. **Les llicències** (secció anterior).
5. **Futur (R16):** facturació i reserves en línia, quan hi hagi consulta oficial i web.
