# Estat del projecte

Actualitzat el 7 de novembre de 2026.

## On som
- **Publicat:** etapa 3B (primera visita i catàlegs clínics), versió **a132dc7**. «Publicar» i «Proves completes» en verd.
- **Etapes fetes:**
  - 1 i 2 (pacients, fitxa clínica, cites, mapa del cos i de l'orella);
  - sincronia amb Drive (format 2, blocs 1–3);
  - CI en dos workflows;
  - 3A (visita, temporitzador, control d'agulles, Tractaments);
  - ajuntar fitxes duplicades;
  - mapa sense 3D (mapa 2D en SVG);
  - 3B en quatre parts:
    - 08c11e2: motor de catàlegs i valoració inicial;
    - 41699f7: exploració;
    - 40062f0: diagnòstic, pla de tractament i MYMOP;
    - a132dc7: mòdul ORL i escales.
- **Detall de cada etapa:** `docs/especificacions.md`.
- **Captures per revisar:** `docs/captures/` i la pàgina de revisió «Captures de Qi» (artifact privat).

## Decisions pendents: llicències
Fins que no es decideixi, l'app no inclou el text de cap qüestionari: només desa les puntuacions i el grau de gravetat.

- **SNOT-22:** cal llicència de la Washington University per a qualsevol ús. La clínica costa 500 $ l'any per grup de fins a 20 clínics, i una versió electrònica necessita la seva aprovació. Cal decidir si es treu la llicència o es treu l'escala.
- **MYMOP:** cal llicència escrita de Meaningful Measures Ltd, de pagament per a organitzacions amb ànim de lucre. Les traduccions necessiten un acord a part. Cal decidir si es treu la llicència o es treu el MYMOP.
- **THI i DHI:** copyright dels autors i de l'AMA. No hi ha cap llicència clínica publicada (el PhenX Toolkit diu que el DHI és lliure). Cal decidir si es demana permís o es continua només amb les puntuacions.
- **Terminologia de l'OMS (2022):** CC BY-NC-SA 3.0 IGO. La traducció catalana dels catàlegs només es pot fer servir en ús no comercial. Cal valorar si la consulta privada ho és.
- **CIM-11:** CC BY-ND 3.0 IGO. No es pot traduir sense permís de l'OMS. Ara els títols surten en anglès i la cerca en català passa per un glossari. Només cal canviar-ho si es vol demanar permís a l'OMS per traduir-los.

## Què queda
1. **Revisar la 3B amb la doctora:** seccions, opcions i ordre dels catàlegs (es poden amagar i reordenar a Ajustos > Catàlegs), i les captures de la pàgina de revisió.
2. **Provar la tauleta amb el seu compte de Google:** instal·lació, entrada, sincronia amb el Drive de la doctora i una visita sencera.
3. **La fitxa clínica nova de la doctora:** substitueix o amplia la fitxa clínica actual.
4. **3C · evolució:** gràfics i seguiment de les escales, del MYMOP i de l'escala 0–10 al llarg de les sessions de l'episodi.
5. **Etapa 4:** vegeu el pla de treball a `docs/especificacions.md`.
