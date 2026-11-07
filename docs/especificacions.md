# Aplicació de consulta d'acupuntura — Especificacions

2026-10-31 · @Raül

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
| R12 | Agenda | Cites lligades al pacient i a la sessió, vista de dia i setmana, historial per pacient. S'avança a l'MVP (veure la secció Cites) | Fase 2 |
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

**Font dels punts i del model**

- **Font de referència:** l'estàndard de l'OMS *WHO Standard Acupuncture Point Locations in the Western Pacific Region* (2008). Fixa la localització dels 361 punts clàssics amb referències anatòmiques i mesura proporcional (cun), i és el que fan servir les universitats i la recerca
- **Com es col·loquen:** Claude Code marca al model les referències anatòmiques (ròtula, mal·lèols, melic, apòfisis espinoses…) i calcula cada punt amb la regla de l'OMS. Per exemple, ST36 queda a 3 cun per sota de ST35, sobre la línia ST35–ST41
- **Validació:** Claude Code comprova automàticament cada punt contra la regla de l'OMS (distàncies en cun, simetria entre costats, ordre dins el meridià). La doctora no ha de revisar-los un per un: si en troba un de mal col·locat, el corregeix directament des del mapa, i queda marcat com a «corregit per la doctora». Només ha de confirmar la llista curta de precaucions (punts prohibits en l'embaràs, prop de vasos o òrgans)
- **Drets:** codis, noms i localitzacions són dades; les descripcions s'escriuen amb paraules pròpies, sense copiar el text ni les il·lustracions de l'OMS
- **Model:** cos generat amb MakeHuman (MPFB2, llicència CC0), amb el relleu anatòmic real: esquena, pit, clavícules, ròtules i mans. El genera Claude Code amb Blender sense interfície
- **Calibratge:** l'eina interna queda per corregir posicions concretes, no per col·locar-les totes a mà

**Per què 3D i no dibuixos**

L'alternativa senzilla són vuit dibuixos plans, un cada 45°, que canvien en arrossegar. Sembla un gir, però cada vista necessita el seu dibuix i les seves coordenades de cada punt. El model 3D costa més al principi, però cada punt es col·loca una sola vegada i es veu des de qualsevol angle.

## Cites

La gestió de cites entra a l'MVP: cada cita va lligada a un pacient i, quan es fa la visita, es converteix en la seva sessió clínica. Així, l'agenda, l'historial de visites i les sessions són la mateixa informació vista des de llocs diferents.

&#91;embedded content: cicle d'una cita · 4 estats\]

Una cita programada es pot moure tantes vegades com calgui. Quan acaba en anul·lada o no presentat, queda a l'historial del pacient; quan es fa, crea la sessió.

**Nova entitat: Cita**

- Camps: pacient, data i hora, durada (60 min la primera visita, 40 el seguiment), tipus, estat (Programada, Feta, Anul·lada, No presentat), motiu breu, notes
- La sessió guarda l'id de la seva cita. Si es fa una sessió sense cita prèvia, l'app en crea una de Feta automàticament, perquè l'historial sigui complet
- Xifrada com la resta de dades; en clar només hi ha l'id i les dates

**On es veu**

- **Agenda:** vista de dia i de setmana amb franges de 15 minuts. Es crea una cita tocant una franja buida i cercant el pacient, o donant-lo d'alta ràpidament amb nom i telèfon. Arrossegar una cita la mou
- **Fitxa del pacient:** pestanya Cites amb la pròxima cita, l'historial (data, tipus, estat i enllaç a la sessió) i el recompte de visites fetes, anul·lacions i no presentats
- **Pantalla Avui:** les cites del dia i el botó «Començar visita» a la següent
- **Avisos:** l'app avisa si dues cites se solapen. Els recordatoris al pacient per SMS o correu queden per més endavant, perquè enviarien dades fora de l'app

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

## Etapa 3A: la base de la visita (model de dades)

Totes les taules noves són **clíniques**: van xifrades com la resta (en clar
només l'id, l'id del pacient i les dates), se sincronitzen amb el format 2
(docs/sincronia.md, 8) i es fusionen **camp a camp** amb el rellotge lògic. Si
un camp s'edita alhora en dos dispositius, el valor que perd queda per revisar.

| Entitat (taula) | Camps | Relació i regles |
| --- | --- | --- |
| **Episodi** (`episodis`) | pacient (en clar), motiu («Lumbàlgia»), data d'inici, estat (actiu, alta, millora parcial, abandonament), data i nota finals | N per pacient. La casella «Nou episodi» de la cita n'obre un de nou |
| **Cita** (`cites`, ja existeix) | + **episodi** | Una cita de seguiment s'enganxa a l'episodi actiu del pacient. Si n'hi ha més d'un, el formulari deixa triar |
| **Sessió** (`sessions`) | pacient (en clar), cita, episodi, número dins l'episodi, hora d'inici i de final, estat (en curs, tancada), retenció (hora d'inici i minuts), «Com està», «Exploració», punts, control d'agulles i «Tancar» | 1 per cita feta. «Tancada amb addendes» és una sessió tancada que en té |
| **Punts de la sessió** (dins la sessió) | per a cada punt: mapa (cos, orella), codi, costat, tècnica, mètode, profunditat, temps i notes | Es desen com un mapa `mapa:codi → punt`, de manera que dos dispositius que hi afegeixen punts diferents no entren en conflicte |
| **Addenda** (`addendes`) | sessió, pacient (en clar), text, data i hora | Només s'afegeixen; no es modifiquen ni s'esborren |

**Seccions de la sessió**

- **Com està:** «Canvis des de l'última sessió» (text), escala 0–10 del
  símptoma principal (amb la de l'última sessió al costat) i fins a dos
  símptomes secundaris, cadascun amb nom i escala.
- **Exploració:** llengua i pols en text lliure (a la 3B, catàlegs).
- **Tractament:** els punts (cos i orella). «Repetir el tractament de l'última
  sessió» copia tots els punts de l'última sessió tancada de l'episodi.
- **Control d'agulles:** agulles posades (automàtic: els punts amb tècnica
  «agulla», bilateral = 2; es pot corregir a mà), agulles retirades i, si no
  quadra, el motiu.
- **Tancar:** recomanacions, reaccions o incidències, i «Cap incidència».

**Regles**

- **Migració:** per a cada pacient amb cites, es crea un episodi amb el motiu de
  la seva primera visita (o «Primera visita», si no en té) i s'hi enganxen les
  cites. Si una cita antiga té «Nou episodi», a partir d'ella s'obre un altre
  episodi. Els identificadors depenen del pacient i de la primera cita de
  l'episodi: si dos dispositius migren alhora, creen el mateix episodi, no dos.
- **Número de sessió:** l'ordre de la sessió dins l'episodi (per data d'inici).
- **Temporitzador de retenció:** es desa l'hora d'inici i els minuts. El temps
  que queda sempre es calcula a partir de l'hora, mai amb un comptador: si la
  pantalla s'apaga, en tornar continua bé. L'app es **bloqueja igualment** per
  inactivitat. La pantalla de bloqueig mostra el temporitzador sense cap dada
  del pacient («Retenció · 12:34»), i l'avís de final (visual i so) hi surt
  igual. Si s'acaba amb l'app bloquejada, en desbloquejar es veu que ha acabat:
  la capçalera de la visita en cinabri o, des d'una altra pantalla, la franja
  «La retenció de les agulles ha acabat a les 10:28 · Tornar a la visita». El
  so sona una sola vegada.
- **Finalitzar:** posa l'hora de final, tanca la sessió i passa la cita a
  «feta». Durant 24 hores es pot editar («Editable fins demà a les 17:20»).
  Després és de només lectura i només s'hi poden afegir addendes. Una sessió
  tancada no es pot esborrar.
- **Ajustos > Visita** (comuns a tots els dispositius, com l'horari): minuts
  de retenció per defecte (28), so en acabar (sí) i control d'agulles (sí).

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

## Accés i pantalla d'inici

L'app és pública a internet, però només serveix el programa: sense el compte de Google de la doctora i la seva contrasenya no hi ha cap dada a veure. Per a ella, l'ús diari ha de ser obrir l'app i posar el dit al sensor.

| Capa | Què protegeix | Com ho viu la doctora |
| --- | --- | --- |
| Compte de Google | Qui pot entrar i accedir a les dades de Drive. L'app només accepta el seu correu | «Continuar amb Google», una sola vegada per aparell |
| Contrasenya de l'app | Desxifra les dades; ni Google ni Raül no les poden llegir | La crea el primer dia i la fa servir si l'empremta falla |
| Empremta o cara (passkey amb PRF) | Desbloqueig ràpid del dia a dia, amb la mateixa seguretat que la contrasenya | Toca el sensor de la tauleta |
| Clau de recuperació impresa | Recuperar les dades si oblida la contrasenya | Un full guardat en un sobre, fora de la consulta |

**Primer ús (una sola vegada, acompanyada):** Continuar amb Google → crear la contrasenya → activar l'empremta → imprimir la clau de recuperació.

**Cada dia:** obrir l'app → empremta → pantalla Avui. A l'ordinador és igual, amb la contrasenya o amb Windows Hello si l'ordinador ho permet; les dades hi arriben des de Google Drive.

**Pantalla Avui (inici)**

- Les cites del dia, en ordre, amb el botó «Començar visita» a la següent
- Accessos ràpids: Nou pacient, Nova cita i Cerca
- Estat de la còpia a Google Drive («Última còpia: fa 2 minuts»)
- Res més: sense menús tècnics ni estadístiques

**Administració**

- No hi ha cap compte d'administrador amb accés a les dades. Raül administra el codi, GitHub i la configuració de Google Cloud, però no pot llegir històries clíniques: no ho ha de fer per RGPD, i el xifratge ho impedeix
- L'empremta amb PRF funciona amb Chrome a Android (amb les passkeys del gestor de contrasenyes de Google) i amb Safari a l'iPad amb el clauer d'iCloud. Si no està disponible, l'app demana la contrasenya
- Les passkeys de gestors externs, com Samsung Pass, poden no oferir PRF: l'app ho ha de comprovar en activar l'empremta

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

La porta de l'etapa 2 és automàtica: els punts es calculen amb les regles de l'OMS i es comproven amb proves. La doctora els pot corregir en qualsevol moment des del mapa.

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


## Pendents opcionals

Funcionalitats que es poden afegir més endavant si la doctora les necessita.

- [ ] Orella: cara posterior (P1–P5 i PS) i arrel de l'orella (R1–R3) de l'estàndard GB/T 13734-2008, amb un segon dibuix de la cara posterior (9 punts)
- [ ] Cara posterior de l'orella: segon dibuix pla segons GB/T 13734-2008 i botó «Girar l'orella» amb animació de gir.
- [ ] Revisar l'empremta amb la doctora a la tauleta.

## Ajuntar fitxes duplicades

Quan dues fitxes són la mateixa persona (l'avís «Per revisar: possible duplicat» o qualsevol fitxa, amb «Ajuntar amb una altra fitxa…»):

- **Comparació a dues columnes** (dades del pacient i fitxa clínica): els camps iguals surten una vegada; els que només són en una fitxa es queden; on són diferents, la doctora tria, i per defecte surt marcat el de la fitxa modificada més recentment. Les contraindicacions marcades en una fitxa es queden marcades. Per defecte es queda la fitxa des d'on s'ha vingut; «Que es quedi l'altra» ho intercanvia.
- **En confirmar:** les cites, els episodis, les sessions i les addendes passen a la fitxa que es queda. Si una cita és a totes dues fitxes (mateix dia, hora i durada), se'n treu una: es queda la que té la visita feta (si totes dues en tenen, no se'n treu cap). Ho diu en acabar.
- **La fitxa que es treu** no s'esborra: s'arxiva, amb l'avís «Aquesta fitxa es va ajuntar amb … el …» i el botó «Desfer» durant 30 dies. Les seves dades no es toquen: res no es perd.
- **Desfer** torna cada cosa a la seva fitxa, torna a posar les cites repetides que es van treure i retorna les dades d'abans a la fitxa que es quedava (excepte els camps que s'han tornat a editar després).
- Es recalcula quina cita és la primera visita i quines són seguiment.
- **Amb diversos dispositius:** tot el que calgui per desfer-ho va xifrat dins la fitxa arxivada i se sincronitza. Si un altre dispositiu, abans de saber-ho, crea una cita (o una sessió) per a la fitxa vella, en rebre l'ajuntament passa sola a la fitxa que es queda.

## Mapa sense 3D

- **Un sol context WebGL:** només hi ha un cos 3D muntat alhora (canviar Cos–Orella no en crea cap més) i, en sortir del mapa, el context s'allibera. Una prova obre i tanca el mapa i canvia Cos–Orella 30 vegades i comprova que el cos continua viu.
- **Context perdut:** si el navegador treu el context WebGL (massa contextos, la GPU es reinicia, la tauleta en segon pla), surt «Recuperant el cos 3D…» i, quan torna, el cos continua on era. Si no torna en 8 segons, es crea un visor nou.
- **Mapa 2D (SVG):** quatre vistes (davant, darrere, esquerra, dreta), projectades del mateix model 3D, amb els mateixos punts, colors, cerca, filtre de meridià i fitxa. «Anar a un punt» tria la vista des d'on es veu millor i hi amplia; les etiquetes es col·loquen sense trepitjar-se, com al 3D. La correcció de posicions només es fa en 3D.
- **Interruptor «3D / 2D»** sota el dibuix. La tria es recorda en aquest dispositiu. Si el navegador no té WebGL, el mapa s'obre en 2D.
- **«Cos 3D no disponible»:** l'avís explica com activar l'acceleració per maquinari a Chrome i Firefox i ofereix «Fer servir el mapa 2D».

## Etapa 3B: primera visita i catàlegs clínics

### Principis
- Tot el que es pot, amb xips per tocar (selecció simple o múltiple). Cada secció té «Normal / sense alteracions» (d'un toc) i «Altres / observacions».
- Seccions plegables. Plegades, mostren un resum del que s'hi ha marcat. Les que no s'han tocat no es desen.
- **Ajustos > Catàlegs:** amagar seccions, camps i opcions, i canviar-ne l'ordre. No s'esborra res: el que ja està desat en una visita es continua veient encara que s'amagui. Els ajustos són comuns a tots els dispositius.
- Els catàlegs són a `src/cataleg/`, en català, amb el pinyin i els caràcters (simplificats) quan hi ha terme xinès, i la font de cada secció (`fonts.ts`, que també surt a Ajustos > Catàlegs).
- **Dades:** totes clíniques, xifrades, sincronitzades i amb fusió camp a camp. Cada secció és un camp: dos dispositius que omplen seccions diferents no entren en conflicte. Els ids de secció fan servir «:» i no punts («anamnesi:son»), perquè la fusió camp a camp separa els camins per punts.

### Valoració inicial (taula `valoracions`)
- Una per episodi, amb id `valoracio-<episodi>-v<n>`. Es fa a la primera visita de l'episodi, que s'obre a la pestanya **Valoració**.
- A les visites de seguiment, la valoració es veu però no es pot editar. «Revisar la valoració» en fa una versió nova a partir de l'última. Les versions anteriors es conserven tal com eren i es poden consultar.
- **Contingut:**
  - **Malaltia actual:** inici, evolució, tendència, factors que milloren i que empitjoren, tractaments previs.
  - **Diagnòstic occidental:** text, codi CIM-11 amb cercador (la llista oficial de 17.000 codis es carrega a part i funciona sense connexió) i codi CIM-10 escrit a mà.
  - **Anamnesi:** les deu preguntes ampliades. La ginecologia només surt si la pacient és dona (o si no consta el sexe).
  - **Constitució:** els nou tipus de la ZYYXH/T157-2009, un de principal i un de secundari.
- **Embaràs:** si la valoració o la fitxa clínica marquen embaràs (o embaràs possible), la capçalera de tota la visita mostra «Embaràs».
- En ajuntar dues fitxes, les valoracions segueixen el seu episodi.

### Llicències
- **Terminologia de l'OMS (2022):** CC BY-NC-SA 3.0 IGO. La traducció catalana es comparteix amb la mateixa llicència. L'ús ha de ser no comercial: cal valorar-ho si la consulta és privada.
- **CIM-11:** CC BY-ND 3.0 IGO. No es pot traduir sense permís de l'OMS, així que els títols es mostren en anglès, sense modificar.
- **Escales:** THI i DHI tenen copyright dels autors i de l'AMA, sense cap llicència clínica publicada. El SNOT-22 necessita una llicència de la Washington University (la clínica és de pagament). El MYMOP necessita una llicència de Meaningful Measures Ltd. Per això l'app no inclou el text dels ítems: només es desen les puntuacions i el grau de gravetat.
