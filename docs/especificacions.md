# Aplicació de consulta d'acupuntura — Especificacions

Oct 31, 2026 · @Raül

## Objectiu i abast

Una aplicació pròpia perquè la doctora porti els pacients de medicina xinesa i acupuntura: fitxa clínica, sessions i un mapa corporal on marcar els punts tractats. La primera versió és per a una sola usuària, durant les pràctiques i amb pocs pacients.

**Qui la fa servir:** la doctora, metgessa especialista en ORL amb màster de medicina xinesa. Combina el diagnòstic convencional i el de medicina xinesa, i l'app ha de recollir tots dos.

**On:** a la consulta, principalment amb una tauleta (marcar punts amb el dit) i també amb l'ordinador per escriure notes llargues.

**Dins la primera versió (MVP)**

- Pacients i fitxa clínica (dades, antecedents, medicació, al·lèrgies)
- Valoració de medicina xinesa (llengua, pols, patrons) i valoració ORL
- Sessions amb punts marcats sobre el cos i l'orella
- Historial per pacient i còpia de seguretat xifrada

**Fora de la primera versió**

- Web pública, reserves en línia i pagaments
- Facturació i comptabilitat
- Diverses usuàries o accés des de fora de la consulta
- Receptes d'herbes amb inventari

La web i la consulta oficial vindran més endavant; l'app es dissenya perquè llavors es pugui ampliar sense refer-la.

## Requisits funcionals

Nou requisits formen l'MVP: amb ells ja es pot atendre un pacient de principi a fi. La resta s'afegeix quan l'MVP s'hagi provat amb pacients reals.

| ID | Requisit | Detall | Fase |
| --- | --- | --- | --- |
| R1 | Pacients | Alta, cerca per nom o telèfon, edició i arxiu (no esborrar) | MVP |
| R2 | Fitxa clínica general | Dades personals, contacte, antecedents personals i familiars, medicació, al·lèrgies, contraindicacions (anticoagulants, embaràs, marcapassos) | MVP |
| R3 | Valoració de medicina xinesa | Motiu de consulta, interrogatori (son, digestió, sed, temperatura, emocions, cicle menstrual), llengua (color, saburra, forma), pols per posició, patró diagnosticat i principi de tractament | MVP |
| R4 | Valoració convencional i ORL | Exploració, diagnòstic i codi CIE-10 opcional, proves aportades | MVP |
| R5 | Sessions | Data, motiu, evolució des de l'anterior, tècniques (agulles, moxa, ventoses, auriculoteràpia, electroacupuntura), durada, observacions | MVP |
| R6 | Mapa corporal de punts | Marcar i desmarcar punts sobre el cos i l'orella; cada punt amb tècnica, costat i notes (veure secció següent) | MVP |
| R7 | Historial | Línia de temps de sessions del pacient i punts més usats; repetir els punts de la sessió anterior amb un toc | MVP |
| R8 | Escales de seguiment | Valor 0–10 del símptoma principal a cada sessió (dolor, acúfens, etc.) i gràfica d'evolució | MVP |
| R9 | Còpia de seguretat | Pujada automàtica i xifrada a Google Drive a cada canvi, còpies diàries i mensuals, i restauració en un altre aparell | MVP |
| R10 | Consentiment informat | Model de consentiment per a acupuntura, signatura a la tauleta i PDF guardat a la fitxa | Fase 2 |
| R11 | Fotos i documents | Fotos de la llengua, informes i analítiques adjunts a la fitxa | Fase 2 |
| R12 | Agenda | Cites per dia i setmana, vinculades al pacient | Fase 2 |
| R13 | Protocols favorits | Combinacions de punts desades (p. ex. acúfens, insòmni) per aplicar-les ràpidament | Fase 2 |
| R14 | Informe per al pacient | PDF amb el resum de la sessió i recomanacions | Fase 2 |
| R15 | Sincronització entre dispositius | Tauleta i PC treballant alhora amb les mateixes dades a través de Google Drive, resolent conflictes entre els dos aparells | Futur |
| R16 | Facturació i reserves en línia | Quan hi hagi consulta oficial i web | Futur |

## Mapa corporal interactiu

El cos és un model 3D que gira sobre si mateix, com una persona dreta que fa una volta, arrossegant amb el dit o amb el ratolí. Cada punt d'acupuntura és un marcador sobre la pell del model que es toca per marcar-lo. Les coordenades de cada punt es guarden en un catàleg a part, de manera que el model i les dades no depenen l'un de l'altre.

**Vistes**

- Cos sencer en 3D: gir de 360° sobre l'eix vertical, amb botons de posició ràpida (davant, darrere, esquerra, dreta)
- Detall: zoom fins al cap i la cara, la mà o el peu, sense canviar de pantalla
- Orella: mapa pla (SVG) d'auriculoteràpia, perquè els punts auriculars es treballen millor en 2D

**Interacció**

- Gir arrossegant en horitzontal amb un dit o amb el ratolí, només sobre l'eix vertical perquè la figura no es tombi; zoom amb dos dits o amb la roda; desplaçament amb dos dits o amb el botó dret
- A poc zoom només es veuen els punts; en ampliar apareixen els codis (LI4) i, més endins, el nom pinyin
- Toc sobre un punt: s'obre una fitxa breu (codi, nom pinyin, nom xinès, meridià, localització) amb el botó «Marcar»
- Punt marcat: canvia de color segons la tècnica (agulla, moxa, ventosa, llavor auricular, electroacupuntura)
- Costat: esquerre, dret o bilateral, perquè la majoria de punts són parells
- Filtres: mostrar un sol meridià i ressaltar-ne el recorregut
- Cercador: escriure «ST36» o «zusanli» porta el mapa fins al punt

**Catàleg de punts**

- Els 361 punts clàssics dels 14 meridians (12 principals més Ren Mai i Du Mai), amb la nomenclatura estàndard de l'OMS (LU1…LR14, CV1…CV24, GV1…GV28)
- Punts extraordinaris (EX-HN3 Yintang, etc.) i punts auriculars, afegits a poc a poc
- Camps per punt: codi, pinyin, caràcters xinesos, nom en català, meridià, coordenades 3D (x, y, z) sobre el model o x/y a l'orella, localització, notes de la doctora, precaucions (p. ex. punts prohibits en l'embaràs)
- Format: un fitxer JSON versionat dins el projecte, editable per afegir-hi punts o corregir posicions

**Autoria del contingut**

- El model 3D ha de tenir llicència lliure (per exemple, un cos generat amb MakeHuman); no es poden copiar atles, pòsters ni models comercials
- Els codis i noms de punts són nomenclatura estàndard; les descripcions de localització les ha de redactar o revisar la doctora
- Calibratge: una eina interna per tocar la pell del model, col·locar-hi un punt o arrossegar-lo i desar-ne la posició, perquè ella pugui ajustar el mapa sense tocar codi

**Per què 3D i no dibuixos**

L'alternativa senzilla són vuit dibuixos plans, un cada 45°, que canvien en arrossegar. Sembla un gir, però cada vista necessita el seu dibuix i les seves coordenades de cada punt. El model 3D costa més al principi, però cada punt es col·loca una sola vegada i es veu des de qualsevol angle.

## Model de dades

Set entitats: el pacient és el centre, cada sessió penja d'un pacient i cada punt marcat penja d'una sessió i remet al catàleg. Tots els registres porten `id` (UUID), `creatAt` i `modificatAt`.

| Entitat | Camps principals | Relació |
| --- | --- | --- |
| Pacient | nom, llinatges, data de naixement, sexe, telèfon, correu, adreça, professió, com ens ha conegut, arxivat (sí/no) | té 1 fitxa clínica, N valoracions, N sessions |
| FitxaClinica | antecedents personals, antecedents familiars, medicació actual, al·lèrgies, contraindicacions, hàbits (son, tabac, alcohol, exercici) | 1 per pacient, editable |
| Valoracio | data, motiu de consulta, interrogatori MTC, llengua, pols (6 posicions), patró MTC, principi de tractament, exploració ORL, diagnòstic convencional, CIE-10 | N per pacient (es fa una nova quan canvia el quadre) |
| Sessio | data i hora, valoració vinculada, evolució, escala 0–10, tècniques usades, durada, recomanacions, observacions | N per pacient |
| PuntMarcat | codi del punt, costat (E, D, bilateral), tècnica, mètode (tonificar, dispersar, neutre), profunditat, temps, notes | N per sessió; remet a PuntCatalog |
| PuntCatalog | codi, pinyin, hanzi, nom català, meridià, coordenades 3D (x, y, z) o x/y a l'orella, localització, precaucions | fitxer JSON, no dades de pacient |
| Protocol | nom, descripció, llista de punts amb costat i tècnica | Fase 2; s'aplica a una sessió |

La llengua i el pols es guarden com a camps estructurats (llistes tancades: color, saburra, forma; pols superficial, profund, ràpid, lent, etc.) més un camp de text lliure. Això permet fer cerques i gràfiques més endavant.

## Pantalles i flux d'ús

Sis pantalles cobreixen l'MVP. L'estil segueix la línia que volíeu per a la web: zen, clar, amb molt d'espai i botons grans per a la tauleta.

| Pantalla | Què hi ha |
| --- | --- |
| Desbloqueig | Contrasenya o PIN per obrir l'app; es tanca sola després de 10 minuts sense ús |
| Pacients | Llista amb cercador, última visita de cada pacient i botó «Nou pacient» |
| Fitxa del pacient | Pestanyes: Dades · Fitxa clínica · Valoracions · Sessions · Evolució |
| Valoració | Formulari en dues columnes: medicina xinesa a l'esquerra, convencional i ORL a la dreta |
| Sessió | Mapa corporal a pantalla gran, llista de punts marcats al costat i notes de la sessió a sota |
| Ajustos | Còpia de seguretat, restaurar, canviar contrasenya, editar catàleg de punts |

**Flux d'una visita**

1. Obrir l'app i desbloquejar-la
2. Cercar el pacient o crear-lo (primera visita: omplir la fitxa clínica i la valoració)
3. «Nova sessió»: anotar l'evolució i l'escala 0–10
4. Al mapa, marcar els punts (o «Repetir sessió anterior» i ajustar)
5. Afegir tècniques, durada i recomanacions
6. Desar: la sessió queda a l'historial i el mapa es pot tornar a veure tal com era

## Arquitectura i tecnologia

Recomanació: una aplicació web instal·lable (PWA) que funciona sense connexió i guarda les dades xifrades al mateix dispositiu. El mateix codi serveix per a la tauleta i l'ordinador, i és tecnologia web que Raül ja domina.

&#91;embedded content: arquitectura de l'MVP · 4 capes al dispositiu\]

Tot passa dins el dispositiu: la interfície parla amb la lògica, i la lògica només guarda dades després de passar per la capa de xifratge. Google Drive només rep dades ja xifrades: hi guarda la versió actual i les còpies, i el PC les pot descarregar si la tauleta falla.

| Peça | Tria | Per què |
| --- | --- | --- |
| Tipus d'app | PWA (aplicació web instal·lable) | Un sol codi per a la tauleta i el PC; s'instal·la des del navegador a tots dos i funciona sense xarxa |
| Llenguatge i framework | TypeScript i React, amb Vite | El tipatge evita errors en dades clíniques, i Claude Code hi treballa molt bé |
| Base de dades | IndexedDB amb Dexie.js | Còpia de treball local per funcionar sense connexió; el dipòsit principal, xifrat, és Google Drive |
| Xifratge | Web Crypto API (AES-GCM, PBKDF2) | Integrat al navegador, sense dependències externes |
| Mapa | Three.js amb React Three Fiber per al cos; SVG per a l'orella | Gir, zoom i selecció de punts tocant la pell del model; funciona bé en tauleta |
| Formularis | React Hook Form i Zod | Validació dels camps de la fitxa i de la valoració |
| Sense connexió | vite-plugin-pwa (service worker) | Instal·la l'app a la pantalla d'inici i la fa funcionar sense xarxa |
| Proves | Vitest i Playwright | Proves del xifratge, de les dades i del flux complet d'una visita |
| Codi | Git i GitHub; publicació a GitHub Pages amb GitHub Actions | Historial de canvis i publicació automàtica amb HTTPS, imprescindible per a una PWA; mai cap dada real al repositori |

**Accés des de qualsevol lloc**

L'app es publica a GitHub Pages: s'obre amb una adreça web des de qualsevol navegador i s'instal·la a la tauleta («Afegir a la pantalla d'inici») i al PC (botó «Instal·lar» de Chrome o Edge). Al PC s'obre en una finestra pròpia, com un programa, sense necessitat de Tauri. Si la tauleta es trenca, n'hi ha prou d'obrir la mateixa adreça en un altre aparell.

Les dades viuen a Google Drive, xifrades. L'app treballa sobre una còpia local, perquè funcioni sense connexió, i la puja a la carpeta privada de l'app dins el Drive de la doctora (appDataFolder). Aquesta carpeta no es veu ni es pot obrir des de Drive, i Google només hi rep fitxers xifrats sense tenir-ne la clau.

- **Sincronia:** cada canvi es puja uns segons després de desar; en obrir l'app en un altre aparell, descarrega l'última versió
- **Còpies:** a més de la versió actual, una còpia diària que es guarda 30 dies i una de mensual que es guarda 12 mesos
- **Mida estimada:** 100 pacients amb 20 sessions cadascun són uns 5 MB de dades i menys d'1 MB comprimides; les 43 còpies ocupen menys de 50 MB dels 15 GB gratuïts de Google
- **Fotos (R11):** es pugen una sola vegada, reduïdes a uns 300 KB, i no es repeteixen a cada còpia
- **Si es trenca la tauleta:** s'instal·la l'app en un altre aparell, s'inicia sessió amb Google i s'introdueix la contrasenya
- **Clau de recuperació:** si s'oblida la contrasenya, les dades no es poden desxifrar; l'app genera una clau de recuperació per imprimir i guardar en lloc segur

GitHub Pages és gratuït amb un repositori públic; amb un repositori privat cal un pla de pagament de GitHub. Com que el codi no conté cap dada de pacients, pot ser públic sense risc.

## Privacitat, seguretat i RGPD

Les dades de salut són categoria especial del RGPD, i la doctora n'és la responsable com a metgessa. Per això l'MVP xifra tot al dispositiu abans de guardar-ho o pujar-ho a Google Drive. Aquesta secció recull mesures tècniques; no substitueix l'assessorament del Col·legi de Metges o d'un delegat de protecció de dades.

**Mesures tècniques de l'MVP**

- Xifratge de totes les dades de pacient amb AES-GCM; la clau es deriva de la contrasenya de la doctora (PBKDF2 o Argon2) i no es guarda enlloc
- Bloqueig automàtic per inactivitat i en tancar l'app
- Còpies de seguretat xifrades a Google Drive, i una clau de recuperació impresa per si s'oblida la contrasenya
- Cap dada real durant el desenvolupament: Raül treballa sempre amb pacients inventats
- Cap analítica, cap tipografia ni llibreria carregada d'internet en temps d'execució: l'app funciona sense connexió
- Registre intern de canvis (qui, quan, què) per a cada fitxa

**Obligacions a revisar abans d'usar-la amb pacients**

- Registre d'activitats de tractament i informació al pacient sobre l'ús de les seves dades
- Consentiment informat per a l'acupuntura (R10)
- Conservació de la història clínica: la Llei 41/2002 obliga a guardar-la com a mínim cinc anys des de l'alta de cada procés
- Drets d'accés, rectificació i portabilitat: l'app ha de poder exportar la fitxa d'un pacient en PDF
- Google Drive com a dipòsit: xifratge abans de pujar res i la clau mai a Google. És preferible un compte de Google Workspace, que inclou un acord de tractament de dades; un compte personal de Gmail no en té. Cal confirmar-ho amb el Col·legi

Mentre l'app no estigui acabada i provada, el més prudent és que els pacients de pràctiques es registrin com fa el centre de pràctiques o en un programa comercial que compleixi el RGPD.

## Pla de treball i primeres passes

Cinc etapes, cadascuna amb una porta que s'ha de complir abans de passar a la següent. L'MVP queda complet a l'etapa 3; les etapes 0 a 3 cobreixen R1–R9 i l'etapa 4, la resta.

&#91;embedded content: pla de treball · 5 etapes, 4 portes\]

La porta de l'etapa 2 depèn de la doctora: ella ha de comprovar que els punts són al lloc correcte abans de construir les sessions damunt el mapa.

**Primeres passes amb Claude Code (etapa 0)**

1. Tenir a l'ordinador Node.js (versió LTS), Git i Claude Code
2. Crear la carpeta `qi-consulta`, fer `git init` i un repositori a GitHub amb publicació automàtica a GitHub Pages
3. Exportar aquest document en Markdown i desar-lo com a `docs/especificacions.md`
4. Crear el fitxer `CLAUDE.md` a l'arrel amb les regles del projecte (model a sota)
5. Preparar el catàleg inicial només amb dos meridians, LI (intestí gros) i ST (estómac), per provar el mapa abans de carregar els 361 punts
6. Obrir Claude Code a la carpeta i enviar el primer encàrrec (model a sota)
7. Treballar una funcionalitat per encàrrec: revisar el que proposa, executar les proves i fer commit

**Model de CLAUDE.md**

```markdown
# Qi — app de consulta d'acupuntura

## Context
App per a una metgessa (ORL i medicina xinesa) per gestionar pacients,
valoracions, sessions i punts d'acupuntura. Especificacions: docs/especificacions.md

## Tecnologia
- TypeScript estricte, React, Vite, Dexie (IndexedDB), vite-plugin-pwa
- Cos 3D amb Three.js i React Three Fiber; orella en SVG
- Formularis amb React Hook Form i Zod
- Proves amb Vitest (unitàries) i Playwright (flux complet)

## Regles
- Mai dades reals de pacients al repositori ni a les proves: només dades inventades
- Totes les dades de pacient passen per src/crypto abans de guardar-se
- Cap recurs carregat d'internet en temps d'execució (tipografies i icones locals)
- Interfície en català, amb els textos en un fitxer de traduccions
- Cada funcionalitat nova amb proves; npm test ha de passar abans de cada commit
```

**Primer encàrrec a Claude Code (inici de l'etapa 1)**

```text
Llegeix docs/especificacions.md i CLAUDE.md. Comencem l'etapa 1.
Crea el projecte amb Vite (React + TypeScript) i configura Dexie, Vitest i vite-plugin-pwa.
Implementa la capa src/crypto (AES-GCM amb clau derivada per PBKDF2 de la contrasenya) amb proves,
la pantalla de desbloqueig i l'alta, cerca i edició de pacients amb la fitxa clínica (R1 i R2).
Abans d'escriure codi, proposa'm l'estructura de carpetes i espera la meva confirmació.
```

## Decisions pendents

Aquestes decisions s'han de prendre abans de la Fase 1 o durant aquesta fase. Les que marquen la tecnologia, primer.

- [ ] Model de tauleta: iPad o Android? (decidit: tauleta com a eina principal i PC de reserva)
- [ ] Idioma de l'app: només català, o català i castellà?
- [ ] Model 3D del cos: generar-lo amb MakeHuman o cercar-ne un altre amb llicència lliure? Estil realista o estilitzat?
- [ ] Qui redacta les localitzacions dels punts: la doctora a partir dels seus apunts del màster?
- [ ] Camps de la valoració MTC i ORL: la doctora els ha de revisar i ordenar com treballa ella
- [ ] Compte de Google per a les dades: personal o Google Workspace?
- [ ] Nom de l'app (provisional: «Qi»)
