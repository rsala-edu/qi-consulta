# Sincronia i còpies de Qi

Revisió del 6 de novembre de 2026 (versió `7cb340f`). Aquest document explica
on són les dades, quan i com es posen d'acord els dispositius, què passa amb
els comptes de Google i què no funciona bé avui. Totes les afirmacions es poden
comprovar amb les proves indicades a cada apartat.

> **Estat (6/11/2026):** els **blocs 1, 2 i 3** estan fets (apartats 8.9 a 8.12). Bloc 1 (pèrdua o
> barreja de dades): cua de canvis pendents, un espai per compte, canvis
> pendents en tancar i el format 2 de Drive (cada fitxer amb un sol autor,
> rellotge lògic per camp). Bloc 2: avís de rellotge desfasat, actualitzacions
> de l'app sense recarregar, pantalles que es refresquen soles i el panell amb
> les dues hores clares.
> Els apartats 1 a 5 descriuen la situació de la revisió, abans d'arreglar-ho;
> el que ha canviat és a la matriu (apartat 6), a la llista (apartat 7) i al
> disseny (apartat 8).

**En poques paraules (revisió):** cada dispositiu té totes les dades, xifrades, i les
comparteix amb els altres a través d'un fitxer xifrat a la carpeta privada de
l'app a Google Drive. Funciona bé en l'ús normal (un dispositiu nou, editar en
dos llocs, treballar sense connexió). **Però avui no es pot garantir que tot
estigui sempre sincronitzat:** hi ha cinc situacions en què es poden perdre
dades o barrejar comptes (apartat 5). Cap d'aquestes situacions no fa malbé
les dades que ja són a Drive.

---

## 1. On és cada còpia

### 1.1 Al dispositiu (navegador)

Les dades es guarden a la base de dades interna del navegador (IndexedDB),
amb el nom **`qi`**. N'hi ha **una sola per navegador i perfil**, sigui quin
sigui el compte de Google (vegeu l'apartat 4).

| Taula | Què hi ha | Xifrat? |
|---|---|---|
| `pacients` | Dades personals (nom, telèfon, adreça…) i si està arxivat | **Sí**. En clar només l'identificador i les dates de creació i de modificació |
| `fitxesCliniques` | Antecedents, medicació, al·lèrgies, contraindicacions, hàbits | **Sí**. En clar: l'identificador, el del pacient i les dates |
| `cites` | Motiu, estat, tipus, durada… | **Sí**. En clar: l'identificador, el del pacient, el dia i l'hora d'inici i les dates |
| `conflictes` | Versions de camps editats en dos dispositius, per revisar | **Sí**. En clar: identificadors i dates |
| `esborranys` | Formularis a mig omplir | **Sí**. **No se sincronitzen**: queden només en aquell dispositiu |
| `esborrats` | Quin registre s'ha esborrat i quan (per avisar els altres dispositius) | No: només identificadors i dates |
| `calibratge`, `calibratgeOrella` | Posicions dels punts corregides per la doctora | No (no són dades de pacient) |
| `precaucions`, `categoriesPrecaucio` | Precaucions confirmades | No (no són dades de pacient) |
| `configuracio`, `diesTancats` | Horari de la consulta i dies tancats | No (no són dades de pacient) |
| `meta` | La clau mestra **tancada** amb la contrasenya, l'empremta i la clau de recuperació; l'identificador intern del compte de Google (no el correu); l'hora de l'última sincronia; els minuts de bloqueig | La clau mestra només es guarda tancada; la resta són dades tècniques |

A més, el navegador guarda (`localStorage`) el tema (clar o fosc), la vista de
l'agenda i quina frase d'entrada va sortir l'últim cop. El permís de Google
**no es guarda enlloc**: només viu a la memòria mentre l'app és oberta.

### 1.2 A Google Drive

Tot va a la carpeta **`appDataFolder`**: és privada de l'app, no es veu des de
drive.google.com i l'app no pot veure cap altre fitxer de Drive. Tots els
fitxers van xifrats; en clar només hi ha la clau mestra tancada (que sense la
contrasenya, l'empremta o la clau de recuperació no serveix) i un hash de la
clau, per saber si dues còpies són de la mateixa clau.

| Fitxer | Què és | Quantes | Quan es crea / s'esborra |
|---|---|---|---|
| `qi-dades.json` | **La còpia principal**: totes les dades sincronitzades | 1 | Es reescriu sencera cada cop que hi ha canvis |
| `qi-copia-AAAA-MM-DD.json` | Còpia diària | Fins a 31 | La primera sincronia de cada dia (dia en hora UTC) crea la d'aquell dia **amb l'estat del moment**: no s'actualitza durant el dia. S'esborren les de fa més de 30 dies |
| `qi-mensual-AAAA-MM.json` | Còpia mensual | Fins a 13 | La primera sincronia de cada mes. S'esborren les de fa més de 12 mesos |
| `qi-danyada-<data i hora>.json` | Una còpia principal danyada, apartada en fer servir «Provar les còpies diària i mensual» | Les que hi hagi | **No s'esborren mai** |

No hi ha cap altre tipus de fitxer (ni «versions anteriors» de Drive: l'app no
en fa servir).

**Mida aproximada** (mesurada amb dades inventades): uns 2 KB sense gaire res;
uns **750 KB amb 100 pacients amb fitxa i 1.000 cites** (uns 2,5 KB per pacient
amb fitxa i 0,5 KB per cita). Com que hi ha fins a 45 fitxers, a Drive pot
ocupar unes 45 vegades la còpia principal (uns 33 MB en aquest exemple).

Fora de Drive i del navegador, l'app només crea fitxers si la doctora els
demana o en canviar de clau: els **fitxers `.qi`** (còpia xifrada descarregada)
queden a la carpeta de baixades.

---

## 2. Quan se sincronitza

Només **amb l'app oberta i desbloquejada**. Bloquejada (o tancada) no
sincronitza.

| Moment | Què fa | Temps |
|---|---|---|
| En desar qualsevol canvi | Puja | **5 segons** després de l'últim canvi |
| Periòdicament | Baixa i puja | **Cada 5 minuts** |
| En desbloquejar | Sincronitza de seguida, **si encara hi ha permís de Google** (dura 1 hora) | Immediat |
| En obrir l'app (o recarregar) | El permís s'ha perdut: no sincronitza fins al **primer toc** a qualsevol lloc, que el renova sense preguntar res | En tocar |
| En tornar a la connexió | Sincronitza (esdeveniment `online` del navegador) | Immediat |
| En tornar a la pestanya | **No fa res especial** (espera els 5 minuts) | — |
| En bloquejar amb canvis pendents | Puja | Immediat |
| Sense connexió | Els canvis queden al dispositiu; la píndola diu «Drive: sense connexió» | Es reprova en tornar la connexió o als 5 minuts |
| Error de Drive (429, 503…) | «Drive: error» amb el codi; **no hi ha reintent immediat** | Als 5 minuts o en desar |
| Bloqueig automàtic | Per defecte als **10 minuts** sense tocar res: a partir d'aquí ja no rep res | — |

Per tant, una cita creada en un dispositiu arriba a un altre **en un màxim
d'uns 5 minuts i 5 segons**, si l'altre és obert, desbloquejat i té permís.
Si l'altre està bloquejat, arriba en desbloquejar-lo.

A més, quan no hi ha canvis, cada sincronia **baixa igualment la còpia
principal sencera** (750 KB a l'exemple), cada 5 minuts. I la primera
sincronia de cada dispositiu baixa una vegada totes les còpies diàries i
mensuals (per recuperar fitxes que una versió antiga podia haver descartat).

---

## 3. Com es posen d'acord dos dispositius

Cada sincronia fa: llegir la llista de Drive → baixar `qi-dades.json` →
desxifrar-lo → fusionar-lo amb les dades del dispositiu → desar el resultat al
dispositiu → pujar-lo si ha canviat.

### 3.1 Qui és «el més nou»

**El rellotge del dispositiu.** Cada registre porta l'hora en què es va
modificar (`modificatAt`), segons el rellotge del dispositiu que el va desar.
Per a cada registre guanya el que té l'hora més tardana.

Per a les dades clíniques (pacients, fitxes i cites) hi ha una protecció més:
si el mateix registre s'ha editat als dos dispositius des de l'última
sincronia, es fusiona **camp a camp** comparant-lo amb la versió de l'última
sincronia: el camp que només ha canviat en un lloc es queda; si ha canviat als
dos llocs, guanya el més nou i l'altre valor queda guardat per revisar
(«Aquestes dades s'han editat en dos dispositius alhora»).

Si un rellotge va endarrerit, les dues coses es poden equivocar (escenari g).

### 3.2 Esborrats

Quan s'esborra una cita (o una correcció de punt, un dia tancat…), es guarda
una marca d'esborrat amb l'hora (`esborrats`). Aquesta marca viatja a Drive i
als altres dispositius, i fa que no tornin a pujar el registre. Si el registre
s'ha modificat **després** de l'hora de l'esborrat, el registre guanya i torna.

Les marques **es guarden per sempre** (no es netegen mai). Els pacients no
s'esborren: s'arxiven.

### 3.3 Dos dispositius que escriuen alhora

**No hi ha cap protecció.** L'app no fa servir ETag, `If-Match` ni cap
comprovació de versió: baixa, fusiona i sobreescriu. Si dos dispositius
sincronitzen exactament alhora, l'últim que escriu trepitja el que acaba
d'escriure l'altre (escenari h). Avui es repara sol perquè el dispositiu
trepitjat encara té les seves dades i les torna a pujar a la sincronia
següent; si aquest dispositiu no torna a sincronitzar mai (finestra
d'incògnit tancada, dades del navegador esborrades), es perden.

L'única protecció és en la primera escriptura: abans de crear `qi-dades.json`
es torna a mirar que cap altre dispositiu no l'hagi creat mentrestant.

---

## 4. Comptes de Google

**Qui pot entrar:** només els comptes amb el correu a la llista permesa (es compara el hash, no el correu). Avui n'hi ha dos: el de la
doctora i el de proves. Qualsevol altre compte és rebutjat abans de tocar
Drive.

**Separació entre comptes: avui NO està garantida.**

- Cada compte de Google té el seu propi Drive: les còpies de Drive de dos
  comptes estan separades.
- Però **al dispositiu hi ha una sola base de dades per navegador** (`qi`),
  amb una sola clau mestra, una sola empremta i un sol compte de Google
  recordat. No està lligada a cap compte.
- L'app recorda l'identificador del compte (`sub`), però **no el comprova**:
  si en tornar a entrar amb Google hi ha un altre compte permès, el canvia en
  silenci i continua sincronitzant amb el Drive d'aquell altre compte.

Conseqüències comprovades (escenari l):

1. Si al Drive de l'altre compte no hi ha res, l'app hi **puja la còpia de la
   doctora** (xifrada amb la seva clau).
2. Si l'altre compte ja té dades seves, surt «Drive: error» (DRV-K) i
   **s'ofereix fusionar-les** amb les de la doctora: si s'accepta, es barregen.
3. Si una segona persona obre l'app al mateix navegador, només veu la
   pantalla de bloqueig de la doctora (no pot començar de nou ni entrar sense
   la contrasenya). Les dades no es barregen, però tampoc pot fer servir l'app
   amb el seu compte en aquell navegador.

Navegadors o perfils diferents sí que estan separats (cadascun té la seva
base de dades), i una finestra d'incògnit també.

---

## 5. Riscos coneguts i limitacions

De més greu a menys:

1. **Pèrdua de dades si es desa mentre sincronitza** (escenari n). Si la
   doctora desa alguna cosa durant els segons que dura una sincronia, aquell
   canvi no es puja fins al cap de 5 minuts; i si a la sincronia arriben
   canvis d'un altre dispositiu, **el canvi s'esborra del dispositiu** sense
   cap avís. Com més lent és Drive (mòbil, mala connexió), més probable.
2. **Barreja de comptes** (apartat 4).
3. **Canvis no pujats en tancar o esborrar** (escenaris j, k i m). El que s'ha
   desat els últims 5 segons, o tot el que estava pendent (sense connexió o
   sense permís), només és al dispositiu. Si es torna a obrir, es puja; si era
   una finestra d'incògnit o s'esborren les dades del navegador, es perd.
   L'app no avisa en tancar amb canvis pendents.
4. **Dos dispositius que escriuen alhora** (escenari h): es repara sol, menys
   en el cas anterior.
5. **Rellotge endarrerit** (escenari g): un esborrat pot desfer-se i un canvi
   posterior es pot perdre en silenci.
6. **Versions de l'app diferents** (escenari i): una versió antiga esborra de
   Drive les taules noves que no coneix (el format no canvia de número, per
   tant no surt l'avís DRV-V) i perd els camps nous d'un registre quan el
   desa. A més, el Chrome es pot quedar dies amb una versió antiga (vegeu la
   part tècnica).
7. **Les pantalles obertes no es refresquen** quan arriben canvis (escenari b):
   cal canviar de pantalla.
8. **«Última còpia correcta» no quadra amb els detalls tècnics.** El panell
   mostra l'hora en què es va **modificar** `qi-dades.json` a Drive (l'últim
   cop que *algun* dispositiu hi va pujar canvis); els detalls tècnics mostren
   l'última sincronia correcta *d'aquest* dispositiu. Si fa dos dies que no hi
   ha cap canvi, el panell diu «fa 2 dies» tot i que s'ha sincronitzat avui.
9. **Sense reintent automàtic** davant errors temporals de Drive (429, 503):
   espera els 5 minuts.
10. **No es demana emmagatzematge persistent** (`navigator.storage.persist()`):
    el navegador pot esborrar les dades si li falta espai. Al Safari (iPhone,
    iPad) sense instal·lar l'app a la pantalla d'inici, les esborra després de
    7 dies sense fer-la servir.
11. **Petites limitacions:** les marques d'esborrat no es netegen mai; les
    còpies `qi-danyada-*` no s'esborren mai; la còpia diària és la del principi
    del dia (en hora UTC); si dos dispositius fan la primera sincronia del dia
    alhora poden quedar dues còpies diàries iguals; si dos dispositius nous
    creen `qi-dades.json` exactament alhora en poden quedar dos; cada 5 minuts
    es baixa la còpia sencera; els esborranys no se sincronitzen; si s'ha
    registrat l'empremta, queda registrada al sistema (Windows Hello, Google…)
    encara que s'esborrin les dades del navegador.

---

## 6. Matriu d'escenaris

Proves: `tests/e2e/sincronia-matriu.spec.ts` (tres dispositius —tauleta, PC 1
i PC 2— i un mòbil, contra el Drive simulat `tests/e2e/drive-realista.ts`) i
`src/sincronia/motor.test.ts` (el motor, sense navegador). Les proves que
encara comencen per «FALLA» comproven un comportament incorrecte que no s'ha
arreglat: quan s'arregli, s'han de girar.

| | Escenari | Revisió (7cb340f) | Ara (blocs 1–3) | Prova |
|---|---|---|---|---|
| a | Dispositiu nou (mòbil): Google, contrasenya i ho recupera tot | ✅ (però vegeu n) | ✅ | `a)` |
| b | Dos dispositius oberts: la cita arriba sola a l'altre | ⚠️ ≤ 5 min; la pantalla oberta no es refresca | ✅ ≤ 5 min i la pantalla oberta es refresca sola (bloc 2); amb un formulari a mig fer, franja «Veure'ls» i en desar no es trepitja res | `b)`, `b2)`, `b3)` |
| c | Camps diferents de la mateixa fitxa | ✅ | ✅ | `c)`, motor |
| d | Mateix camp: conflicte per revisar | ✅ | ✅ (un sol conflicte, igual als dos) | `d)`, motor |
| e | Esborrar una cita amb l'altre sense connexió | ✅ | ✅ | `e)`, motor |
| f | Un dia sense connexió i reconnexió | ✅ | ✅ | `f)` |
| g | Rellotge 10 minuts endarrerit | ❌ | ✅ esborrat i canvi posterior guanyen (HLC); avís de rellotge desfasat (bloc 2) | `g1)`, `g2)`, motor |
| h | Dos dispositius pugen alhora | ⚠️ el segon trepitja el primer | ✅ cadascú escriu el seu diari | `h)`, motor |
| h2 | Errors 429/503 | ⚠️ sense reintent immediat | ✅ es torna a provar sol: 5 s, 15 s, 45 s, 2 min, 5 min | `h2)` |
| b4 | Tornar a la pestanya | ⚠️ esperava els 5 minuts | ✅ es miren els canvis de seguida | `b4)` |
| i2 | Una versió antiga escriu a qi-dades.json després de migrar | — | ✅ se n'importen els canvis, arriben als altres, torna l'avís i surt «Un dispositiu amb una versió antiga ha escrit dades. Actualitza'l» | motor |
| m2 | Tancar la pestanya just després de desar | ⚠️ | ✅ el diari es puja amb keepalive (si fa menys de 60 KB; si no, en tornar a obrir) | `m2)`, motor |
| — | Neteja de marques d'esborrat | ⚠️ no es netejaven | ✅ quan tots els dispositius coneguts les han vistes | motor |
| — | Desvincular aquest dispositiu | — | ✅ només sense res pendent, amb contrasenya i «DESVINCULAR»; Drive no es toca | `desvincular.test.ts` |
| i | Versió antiga i versió nova | ❌ | ✅ taules i camps desconeguts es conserven; versió mínima per escriure; les versions d'abans hi veuen DRV-V; la versió nova es detecta amb l'app oberta (bloc 2) | motor, `produccio-actualitzacio` |
| j | Tancar el navegador mentre puja | ✅ | ✅ | `j)` |
| k | Esborrar les dades del navegador | ⚠️ es perdia el pendent | ✅ el que la píndola diu «al dia» (≈3 s després de desar) es recupera; en amagar la pestanya es puja de seguida | `k)`, `k2)` |
| l | Dos comptes al mateix navegador | ❌ | ✅ un espai per compte; el permís d'un altre compte no es fa servir mai | `l)`, `l2)`, `l3)` |
| m | Finestra d'incògnit | ⚠️ | ✅ avís fix; si es tanca amb canvis pendents, el navegador ho avisa | `m)` |
| n | Desar mentre sincronitza | ❌ | ✅ mai se substitueix cap taula; el canvi es conserva i es puja | `n)`, motor |

Resultat el 6/11/2026, després del bloc 3: 589 proves unitàries, 141 E2E (tots
dos perfils) i 7 E2E amb el build de producció passen.

**Prova real (6/11):** el Firefox amb la versió 7cb340f i el Chrome amb la
nova. El Chrome va migrar Drive; el Firefox va mostrar DRV-V i no hi va
escriure res. En recarregar es va actualitzar sol i la cita que hi havia creat
amb la versió vella va pujar. Fins que no es va recarregar, però, continuava
amb la versió vella: és el que arregla el punt 7.

**La prova que fallava de tant en tant.** En 50 execucions seguides de la
matriu (amb el codi de la revisió), 844 proves van passar i 6 van fallar:
cinc vegades l'escenari a) (el mòbil recuperava les dades **sense la cita**
que el PC 1 acabava de crear) i una vegada l'n) (la cursa no es va produir).
Era una cursa real de l'app, la de l'escenari n: una cita desada just quan
arrencava una sincronia no s'apuntava com a pendent i, si la sincronia portava
canvis, desapareixia. Amb el motor nou ja no pot passar.

---

## 7. Què cal arreglar (prioritzat)

**Prioritat 1 — es poden perdre o barrejar dades**

✅ 1. **Desar durant una sincronia** (n): no esborrar mai del dispositiu el que
   s'ha desat després de llegir les dades locals; marcar-ho com a pendent i
   tornar a sincronitzar.
✅ 2. **Comptes** (l): comprovar que el compte és el mateix que el que hi ha
   desat; si no ho és, no tocar Drive i dir-ho clarament. Lligar la base de
   dades local al compte (una per compte) o, com a mínim, no oferir mai fusionar
   dades de dos comptes.
✅ 3. **Canvis pendents en tancar** (j, k, m): avisar abans de tancar la pestanya
   si hi ha canvis no pujats; pujar en amagar la pestanya; reduir l'espera de
   5 segons; avisar si es treballa en una finestra d'incògnit; demanar
   emmagatzematge persistent.
✅ 4. **Escriptures alhora** (h): comprovar just abans d'escriure que la còpia de
   Drive continua sent la que s'ha baixat (versió del fitxer) i, si no, tornar
   a començar. Drive v3 no ofereix escriptures condicionals amb `If-Match` per
   al contingut (cal confirmar-ho abans de dissenyar-ho); alternatives: comparar
   la `version` del fitxer abans i després, o fitxers per dispositiu.

**Prioritat 2 — dades incorrectes o versions velles**

✅ 5. **Rellotges** (g): no dependre només del rellotge del dispositiu (corregir-lo
   amb l'hora de Drive o fer servir un comptador per registre).
✅ 6. **Versions** (i): conservar les taules i els camps que una versió no coneix;
   apujar el número de format quan calgui perquè surti «Actualitzar l'app».
✅ 7. **Chrome amb una versió antiga dies seguits** (ja conegut): buscar
   actualitzacions periòdicament i en tornar a la pestanya, i oferir «Hi ha una
   versió nova: tornar a carregar».
✅ 8. **Pantalles obertes** (ja conegut): tornar-les a carregar quan la sincronia
   porta canvis.
✅ 9. **«Última còpia correcta»** (ja conegut): mostrar la mateixa hora que els
   detalls tècnics (l'última sincronia correcta d'aquest dispositiu) i, a part,
   si cal, l'hora de l'últim canvi a Drive.

**Prioritat 3 — comoditat i manteniment**

✅ 10. Sincronitzar en tornar a la pestanya i reintentar sol (amb espera
    creixent) els errors temporals 429 i 503.
✅ 11. **Proposta: «Tornar a connectar amb Google»** sempre a mà (Ajustos > Drive):
    renova el permís sense tocar dades. Ha d'anar amb la comprovació del
    compte (punt 2).
✅ 12. **Proposta: «Desvincular aquest dispositiu»**: només si no hi ha res
    pendent i Drive té l'última versió (comprovat just abans), amb contrasenya
    i confirmació; esborra la base de dades local i les claus. Recomanació:
    també treure l'empremta registrada.
✅ 13. Netejar les marques d'esborrat velles i les còpies `qi-danyada-*`; no
    baixar la còpia sencera si no ha canviat (mirar-ne la versió abans);
    evitar còpies diàries i principals duplicades.

---

## 8. Disseny nou (blocs 1 i 2)

*Proposta per revisar abans de programar-la.* La cua de canvis (punt 1), el
format nou de Drive (4), el rellotge lògic (5), la compatibilitat entre
versions (6) i la neteja (13) depenen del mateix format de dades: es dissenyen
junts.

### 8.1 La idea, en poques paraules

- Cada dispositiu té un **identificador propi** (aleatori, per compte) i
  escriu a Drive **només els seus fitxers**: el seu **diari de canvis** i, de
  tant en tant, una **foto** sencera. Cap fitxer té mai dos autors, i per això
  dos dispositius ja no es poden trepitjar.
- Tots llegeixen els fitxers de tots i els fusionen. La fusió és la mateixa a
  tots els dispositius i no depèn de l'ordre: amb els mateixos fitxers, tots
  arriben exactament al mateix resultat.
- «El més nou» ja no el decideix el rellotge del dispositiu sinó un **rellotge
  lògic híbrid (HLC)** per camp: una hora que mai va enrere i que sempre és
  més gran que qualsevol canvi que el dispositiu ja ha vist, encara que el seu
  rellotge vagi endarrerit.

### 8.2 Al dispositiu

**Cua de canvis pendents** (`canvisPropis`), dins la mateixa transacció de
Dexie que la desada:

- Cada desada (o esborrat) escriu el registre i, alhora, una entrada a la cua
  amb un **número de seqüència** creixent (`seq`, comptador a `meta`).
- La cua guarda una entrada **per registre** (`taula:clau`), amb el `seq` de
  l'últim canvi: si es desa tres vegades la mateixa fitxa abans de pujar-la,
  és una entrada (amb el `seq` de la tercera) i es pujarà l'estat final. Les
  garanties són les mateixes que amb una entrada per desada, i la píndola
  compta registres: «2 canvis pendents de pujar».
- La sincronia fa una foto de la cua fins a un número `N`, puja, i marca com
  a pujat només fins a `N` (`pujatFins`). El que es desa mentre puja té un
  `seq` més gran que `N` i queda pendent per a la volta següent.
- **La sincronia ja no substitueix mai les taules.** Cada registre que arriba
  de Drive es fusiona amb el registre local *tal com és en aquell moment*, i
  s'escriu amb una comprovació: si el registre local ha canviat entre la
  lectura i l'escriptura (la doctora l'acaba de desar), es torna a fusionar.
  Així és impossible que un canvi local desaparegui (escenari n).

**Versions per camp.** Cada registre clínic (pacients, fitxes, cites) porta,
xifrat, un mapa `camp → [hlc, hlcAnterior]`: l'HLC de l'últim canvi d'aquell
camp i l'HLC del valor que va substituir. Els camps niats («habits.tabac») són
camps propis. Els registres que no són de pacient (calibratge, precaucions,
horari, dies tancats, conflictes) porten un sol HLC per registre: són valors
que van junts (per exemple, la x i la y d'un punt de l'orella).

**HLC:** `ttttttttttttt-cccc-dispositiu` (mil·lisegons, comptador i
identificador del dispositiu), que es pot comparar com un text. En desar:
`max(rellotge, últim HLC vist)`; en rebre registres de Drive, l'HLC del
dispositiu avança fins al més gran rebut. Per això, un dispositiu amb el
rellotge 10 minuts endarrerit que esborra una cita que acaba de rebre genera
un HLC més gran que el de la cita: l'esborrat guanya (escenari g).

**Separació per compte (punt 2):** una base de dades per compte, amb el nom
`qi-` + 16 caràcters del SHA-256 de `qi:compte:<sub>` (ni el correu ni el
`sub` en clar). Vegeu 8.6.

### 8.3 A Drive

| Fitxer | Autor | Què és |
|---|---|---|
| `qi-dispositiu-<id>.json` | Només el dispositiu `<id>` | El seu **diari**: l'estat actual de cada registre que ha canviat des de l'última foto que el cobreix, i les seves marques d'esborrat, amb el `seq` de cada un |
| `qi-foto-<generació>-<id>.json` | El dispositiu `<id>` (no es modifica mai un cop creat) | Una **foto** sencera de totes les dades, amb la **cobertura**: fins a quin `seq` del diari de cada dispositiu inclou |
| `qi-copia-AAAA-MM-DD.json`, `qi-mensual-AAAA-MM.json` | El primer dispositiu del dia o del mes (no es modifiquen mai) | Còpies diàries i mensuals, en format de foto |
| `qi-dades.json` | — | El fitxer del format d'abans. Després de migrar, queda com un avís per a les versions antigues (8.5) |

Cada fitxer porta en clar només: el format, la **versió mínima per escriure**,
el hash de la clau, l'identificador del dispositiu, els embolcalls de la clau
mestra (tancats, com ara), la cobertura (fotos) i l'HLC fins al qual el
dispositiu ho ha vist tot (diaris, per a la neteja de 8.7). Tota la resta va
xifrada amb la clau mestra, com ara.

**Una sincronia:**

1. Bloqueig entre pestanyes (`navigator.locks`): dues pestanyes del mateix
   navegador comparteixen dispositiu i no poden sincronitzar alhora.
2. Llistar els fitxers (amb la `version` de Drive de cadascun). **Només es
   baixen els que han canviat** des de l'última vegada (punt 13): si no ha
   canviat res, la sincronia és una sola petició.
3. Llegir totes les fotos de la **generació més nova** (normalment una;
   dues si dos dispositius n'han fet una alhora) i els diaris dels altres
   dispositius que hagin canviat, i fusionar-ho registre a registre.
4. Pujar el diari propi (reescriure'l sencer: és només meu) amb tot el que hi
   ha a la cua.
5. De tant en tant (cada dia, o si els diaris són grans), **compactar**: fer
   una foto nova amb generació = la més nova + 1. La pot fer qualsevol
   dispositiu, perquè és un fitxer nou: no trepitja ningú.
6. Escurçar el diari propi: treure'n els registres que ja són a totes les
   fotos de la generació més nova, quan aquesta generació fa més de 10 minuts
   que existeix (perquè, si dues fotos de la mateixa generació es feien alhora,
   ja siguin visibles totes dues). S'esborren les fotos de més de dues
   generacions enrere (no es modifiquen mai, i per tant esborrar-les no
   trepitja res).

**Per què és tan segur:** cada fitxer modificable té un sol autor (cap
escriptura perduda); les fotos no es modifiquen mai; un lector sempre fusiona
*totes* les fotos de la generació més nova més *tots* els diaris; un registre
només surt d'un diari quan ja és a totes aquestes fotos; i la fusió és
idempotent i commutativa (fusionar dues vegades el mateix, o en un altre
ordre, dona el mateix). Una pujada a mitges no fa res: Drive guarda el fitxer
sencer nou o el d'abans.

He descartat l'alternativa d'un sol fitxer amb comprovació de versió: Drive
v3 no permet escriptures condicionals (`If-Match`) al contingut, i entre
comprovar la versió i escriure sempre queda un moment en què un altre
dispositiu pot escriure.

### 8.4 La fusió d'un registre

- Per a cada camp, guanya el valor amb l'HLC més gran.
- Si el que guanya no s'ha fet *sobre* el que perd (el seu `hlcAnterior` no
  és l'HLC del que perd) i els valors són diferents, és que s'han editat alhora:
  el valor que perd es desa com a **conflicte per revisar**, amb un
  identificador que depèn del registre, del camp i de l'HLC (tots els
  dispositius creen el mateix conflicte, no un per dispositiu).
- Esborrats: una marca d'esborrat amb HLC; guanya si és més gran que l'HLC més
  alt del registre.
- Dues fitxes clíniques del mateix pacient (només les fetes per versions
  antigues; les noves ja tenen un identificador que depèn del pacient): es
  fusionen camp a camp en la més antiga, com ara.

**Una diferència amb el que demanes.** Demanes que «la fusió amb Drive mai
sobreescrigui un registre que tingui canvis a la cua: el canvi local s'aplica
a sobre». Si cada dispositiu apliqués sempre *el seu* canvi a sobre, dos
dispositius amb canvis al mateix camp arribarien a resultats diferents i no
es posarien mai d'acord. Proposo: **el canvi local no es perd mai** (és a la
cua fins que és a Drive, i la fusió treballa sobre el registre actual), però
el valor que queda el decideix l'HLC, igual a tots els dispositius; si un altre
dispositiu ha canviat el mateix camp després, el valor local queda com a
conflicte per revisar.

### 8.5 Versions de l'app (punt 6)

- **Format** (`versio: 2`): l'estructura del fitxer. Si és més gran que el que
  l'app entén, no el pot llegir: «Actualitza l'app» (DRV-V), com ara.
- **Versió mínima per escriure** (`minimaPerEscriure`): un número que es puja
  quan una versió nova canvia alguna cosa que una de més antiga espatllaria.
  Una app amb un número més baix **llegeix, fusiona i mostra**, però **no puja
  res** i mostra «Actualitza l'app per desar canvis». El que desa queda a la
  cua i es puja quan s'actualitza.
- **Res que no es conegui es perd:** les taules que l'app no coneix es
  guarden tal qual al dispositiu (`desconegudes`) i tornen a sortir a les seves
  fotos; els camps que no coneix d'un registre es conserven en desar-lo (ara
  es perden, vegeu `versions.test.ts`).
- **Migració des del format 1**, automàtica, la fa el primer dispositiu amb la
  versió nova: (1) es desa un `.qi` de les dades del dispositiu (es pot
  descarregar des de Seguretat) i una còpia del `qi-dades.json` d'abans a Drive
  (`qi-v1-<data>.json`); (2) es fusiona `qi-dades.json` amb el dispositiu amb
  la fusió d'ara; (3) cada registre rep versions a partir del seu
  `modificatAt`; (4) es crea la foto de generació 1 i el diari; (5)
  `qi-dades.json` passa a ser un fitxer de format 2 sense dades, de manera que
  les versions d'abans hi veuen «Actualitzar l'app» (DRV-V) i no hi escriuen.
  Si dos dispositius migren alhora, surten dues fotos de generació 1 i es
  fusionen (8.3).

### 8.6 Comptes (punt 2)

- A l'arrencada, l'app obre l'espai de l'últim compte que s'ha fet servir en
  aquest navegador (la llista d'espais, només amb els noms de 16 caràcters, és
  a `localStorage`). Si no n'hi ha cap: «Continuar amb Google».
- La pantalla de bloqueig té «Entrar amb un altre compte de Google»: obre (o
  crea, o recupera de Drive) l'espai d'aquell compte, amb la seva contrasenya.
- Cada vegada que arriba un permís de Google (entrada, renovació silenciosa,
  «Tornar a connectar»), es compara el `sub` amb el de l'espai obert. Si és
  un altre compte, **el permís no es fa servir per a res** i surt: «Has entrat
  amb un altre compte de Google. No s'ha tocat res. [Canviar a aquell compte]».
- Base de dades única d'abans (`qi`): es copia a l'espai del compte que la va
  crear (el `sub` ja hi és desat) i després s'esborra. Si no en té (versions
  molt antigues), es copia en connectar amb Google per primer cop.
- L'empremta, la clau de recuperació, els minuts de bloqueig i la vista de
  l'agenda van a l'espai de cada compte. El tema (clar o fosc) és del
  navegador: es necessita abans de saber el compte.

### 8.7 Neteja (punt 13)

- Les marques d'esborrat s'eliminen quan **tots els dispositius coneguts**
  ja les han vistes: cada diari diu fins a quin HLC el seu dispositiu ho ha
  vist tot. Un dispositiu que fa més de 180 dies que no escriu deixa de comptar;
  si torna, ho detecta i es refà a partir de la foto (conservant la seva cua),
  per no ressuscitar res esborrat.
- Les còpies `qi-danyada-*` s'esborren passats 30 dies.

### 8.8 Altres decisions que has de saber

- **Hora de Google (punt 5).** La capçalera `Date` de les respostes de Google
  potser no es pot llegir des del navegador (normes CORS). Si no es pot, faré
  servir l'hora que Drive posa al fitxer que l'app acaba d'escriure. Avís si
  el desfasament passa de 2 minuts.
- **Finestra privada (punt 3).** Cap navegador diu si una finestra és privada.
  La detectaré per la quota d'emmagatzematge (molt més petita en privat), i
  l'avís dirà «Sembla una finestra privada…». Pot equivocar-se en un disc
  gairebé ple.
- **Tancar la pestanya (punt 3).** L'avís `beforeunload` el mostra el
  navegador amb el seu text (no se'n pot posar un de propi). En amagar la
  pestanya, la pujada es llança amb `keepalive`, però el navegador pot no
  acabar-la si es tanca del tot: per això hi ha l'avís.
- **Sense memòria cau (punt 7).** GitHub Pages no deixa triar les capçaleres
  de memòria cau. El service worker es registrarà amb `updateViaCache:
  'none'` i `version.json` es baixarà amb `cache: 'no-store'`, que en la
  pràctica fa el mateix.
- **Treure l'empremta (punt 12).** Una web no pot esborrar una clau
  d'accés del Windows Hello o del gestor de Google. L'app esborra la seva
  part (sense la qual l'empremta no obre res) i, si el navegador ho permet
  (`PublicKeyCredential.signalUnknownCredential`), li demana que la retiri.

### 8.9 Com ha quedat (bloc 1)

Fet tal com es descriu a 8.1–8.6, amb aquestes precisions:

- **Cua:** una entrada per registre amb el `seq` de l'últim canvi
  (`canvisPropis`, `src/sincronia/escriptura.ts`). Totes les escriptures de
  dades que se sincronitzen hi passen, dins la mateixa transacció. La píndola
  diu «Drive: 2 canvis pendents de pujar».
- **Fusió** (`src/sincronia/aplicar.ts`, `registres.ts`): cada registre que
  arriba es fusiona amb el local tal com és en aquell moment i s'escriu només
  si no ha canviat entremig; si ha canviat, es torna a fusionar. Es manté la
  regla d'abans per a les contraindicacions (sí/no): si s'han editat alhora i
  una de les dues versions la té marcada, queda marcada. Si es desmarca
  després d'haver vist la versió marcada, es respecta.
- **Fitxer `.qi`** del mateix dispositiu, importat després d'haver fet canvis:
  els canvis fets després guanyen sense conflicte (s'han fet sobre el fitxer).
  Abans sortia un conflicte per revisar.
- **Comptes:** a més del que diu 8.6, en canviar de compte l'app torna a
  l'inici (l'adreça podia portar l'identificador d'un pacient de l'altre
  compte).
- **Pendent per als blocs 2 i 3:** l'avís de rellotge desfasat (ja es desa el
  desfasament, comparant amb l'hora de Drive del fitxer que s'acaba
  d'escriure), la pujada amb `keepalive` en tancar, l'actualització del
  service worker, el refresc de les pantalles obertes, el reintent amb espera
  creixent i la neteja de marques d'esborrat.

### 8.10 Com ha quedat (bloc 2)

- **Rellotge (punt 5):** l'app compara l'hora del dispositiu amb la de Google:
  la capçalera `Date` de les respostes, si el navegador la deixa llegir, i si
  no, l'hora que Drive posa al fitxer que l'app acaba d'escriure. Si el
  desfasament passa de 2 minuts, surt l'avís «El rellotge d'aquest dispositiu
  va 10 minuts endarrerit…» a la pantalla Avui i al panell de la píndola (amb
  els altres avisos de la còpia; una franja a totes les pantalles restava massa
  espai a l'agenda).
- **Actualitzacions (punt 7, `src/actualitzacio/`):** el service worker el
  registra l'app, amb `updateViaCache: 'none'`. Es busca una versió nova en
  obrir l'app, en tornar a la pestanya i cada 30 minuts, i també es mira
  `version.json` (amb `cache: 'no-store'`). Quan n'hi ha una de nova, surt la
  franja «Hi ha una versió nova · Actualitzar». Si l'app està bloquejada, o
  encara no s'ha obert, s'actualitza sola. La versió es veu a Ajustos > Quant
  a. GitHub Pages no deixa canviar les capçaleres de memòria cau
  d'`index.html` ni del manifest: no cal, perquè les serveix el service
  worker, i aquest només es renova amb una versió nova.
- **Pantalles (punt 8, `src/sincronia/revisio.tsx`):** quan la sincronia porta
  canvis, les pantalles es tornen a carregar soles, sense passar per
  «carregant». Si hi ha un formulari a mig fer, no es toca res i surt la franja
  «Hi ha canvis d'un altre dispositiu · Veure'ls». «Veure'ls» actualitza els
  camps que no s'han tocat i conserva els que s'estan escrivint.
- **Trobat i arreglat en fer el punt 8:** en desar un formulari, abans es
  desaven tots els camps tal com eren en obrir-lo. Si mentrestant havia
  arribat un canvi d'un altre dispositiu en un camp que la doctora no havia
  tocat, es trepitjava. Ara només compten com a canvis els camps que ha
  modificat respecte del que tenia en obrir el formulari (prova `b2)`).
- **Panell (punt 9):** «Última sincronia d'aquest dispositiu: …» i «Últim canvi
  a Drive (qualsevol dispositiu): …». Els detalls tècnics diuen «última
  sincronia», la mateixa hora que la primera línia.

### 8.11 Com ha quedat (bloc 3)

- **Tornar a la pestanya i reintents (punt 10):** en tornar a la pestanya es
  sincronitza de seguida (com a molt un cop cada 15 s). Davant un error
  temporal (429, 5xx o sense connexió) es torna a provar sol, esperant 5 s,
  15 s, 45 s, 2 min i després cada 5 min, fins que va bé.
- **«Tornar a connectar amb Google» (punt 11):** al panell de la píndola i a
  Ajustos > Drive. Renova el permís sense tocar cap dada. Si s'hi entra amb un
  altre compte, el permís no es fa servir (8.6).
- **«Desvincular aquest dispositiu» (punt 12, Ajustos > Seguretat):** només es
  pot si la píndola diu «al dia» i no queda res a la cua. Demana la contrasenya
  i que s'escrigui «DESVINCULAR», sincronitza un últim cop, torna a comprovar
  que no queda res pendent i esborra la base de dades d'aquest compte (dades,
  clau, empremta i ajustos d'aquest navegador). Drive no es toca. L'empremta:
  sense la seva part desada aquí ja no obre res, i si el navegador ho permet
  (`signalUnknownCredential`), se li demana que la retiri del gestor de claus.
- **Neteja (punt 13):** cada marca d'esborrat porta el dispositiu i el número
  de la cua que la va crear, i cada diari diu fins a quin número ha vist els
  diaris dels altres. Una marca es treu quan tots els dispositius coneguts
  l'han vista i ja no és a la cua pròpia. Un dispositiu que fa més de 180 dies
  que no escriu deixa de comptar; si torna, es queda només amb el que té a la
  cua i ho torna a llegir tot de Drive, per no ressuscitar res. Les marques
  del format 1 (sense origen) es treuen passats 180 dies. Les còpies
  `qi-danyada-*` s'esborren passats 30 dies. Si res no ha canviat a Drive, no
  es baixa res (només es llista).
- **Tancar la pestanya:** uns 300 ms després de cada desada, l'app deixa
  preparat el diari xifrat. En tancar la pestanya (`pagehide`), si n'hi ha de
  pendent i el diari fa menys de 60 KB, es puja amb `fetch` + `keepalive`, que
  el navegador acaba encara que la pàgina ja no hi sigui. Si és més gran, no
  es pot. Aleshores el navegador ja haurà avisat dels canvis pendents
  (`beforeunload`), i es pujarà en tornar a obrir l'app: res no surt de la cua
  fins que és a Drive. Limitació de la prova: Playwright no deixa sortir les
  peticions d'una pàgina que es tanca, i per això la prova llança l'esdeveniment
  `pagehide`.

### 8.12 Preguntes

**A. Versions antigues ja instal·lades que continuen escrivint a
qi-dades.json després de migrar.** La versió nova vigila qi-dades.json a
cada sincronia (en compara la `version` de Drive). Si hi troba dades del
format 1 en lloc de l'avís:

- n'importa els canvis amb la fusió normal (registre a registre, sense
  substituir res) i els apunta a la cua, perquè arribin als altres
  dispositius;
- hi torna a posar l'avís, de manera que aquella versió veu «Actualitzar
  l'app» (DRV-V) a la sincronia següent;
- mostra «Un dispositiu amb una versió antiga ha escrit dades. Actualitza'l»
  fins que la doctora toca «Entesos».

Si el que hi ha escrit no es pot obrir (una altra clau o a mig escriure), no
s'atura res: es guarda a part (`qi-v1-<data i hora>.json`) i surt el mateix
avís. Proves a `motor.test.ts`. Les versions de l'app d'abans de 7cb340f que
no entenen el format 2 llegeixen l'avís com a «còpia danyada» (DRV-C) o «d'una
versió més nova» (DRV-V). En tots dos casos no hi escriuen.

**B. Mida a Drive.** Mesurada amb el format 2 per a un any d'ús normal: 150
pacients amb fitxa i 780 cites (15 per setmana), cadascuna amb el motiu i unes
notes amb uns 15 punts. Els punts marcats encara no es desen: arribaran amb les
sessions de l'etapa 3, i les notes en fan el paper. La foto fa **2,1 MB**
(amb les versions per camp xifrades).

- Fotos: una de nova cada dia que hi ha canvis; es guarden les dues últimes
  generacions (≈ 4 MB).
- Còpies: 31 diàries i 13 mensuals, cadascuna una foto (≈ 92 MB).
- Diaris: un per dispositiu, amb només el que encara no és a cap foto
  (normalment pocs KB; s'escurça uns 10 minuts després de cada foto).
- **Total al cap d'un any: uns 100 MB.** Creix de manera lineal (uns 100 MB
  més cada any, sobretot per les còpies diàries i mensuals). Ocupa espai del
  compte de Google de la doctora.
- Trànsit: una sincronia normal només llista els fitxers i baixa els diaris
  que han canviat. Un dispositiu puja una foto i la còpia diària (≈ 4 MB) com
  a molt un cop al dia. Un dispositiu nou baixa les fotos de la generació més
  nova i els diaris.

### 8.13 Si un navegador es queda amb una versió antiga

Des de la versió `3d99274`, l'app detecta sola les versions noves: surt la
franja «Hi ha una versió nova · Actualitzar», o s'actualitza sola si està
bloquejada. Un navegador que encara té una versió **anterior** al sistema nou
(per exemple `2ac5318`) no té aquesta franja.

En aquests navegadors, la versió nova ja s'ha baixat, però queda esperant que
es tanquin totes les pestanyes de l'app. Mentrestant, recarregar no serveix
(prova del 6/11 amb el Firefox). Només cal fer-ho una vegada: a partir d'aquí,
la franja ja surt sola.

Com saber quina versió hi ha: Ajustos > Quant a (o els «Detalls tècnics» del
panell de la píndola, si encara no hi ha Quant a).

**Les dades no es perden:** són a la base de dades del navegador, que aquests
passos no toquen, i el que no s'havia pujat és a la cua. **No** facis
«Esborrar les dades del lloc» ni «Esborrar l'historial i les galetes»: aquests
sí que esborren les dades d'aquest dispositiu.

1. **Primer, el més senzill (qualsevol navegador):** tanca **totes** les
   pestanyes i finestres de Qi (també la de l'app instal·lada, si n'hi ha) i
   torna-la a obrir. La versió que esperava passa a ser l'activa.
2. **Si continua igual, Chrome (ordinador):**
   - Obre `chrome://serviceworker-internals`, cerca `rsala-edu.github.io/qi-consulta`
     i prem **Unregister**. També es pot fer des de les eines de
     desenvolupador (F12) > Application > Service workers > **Unregister**.
   - Tanca la pestanya de Qi i torna-la a obrir.
3. **Si continua igual, Firefox (ordinador):**
   - Obre `about:serviceworkers` (o `about:debugging#/runtime/this-firefox`,
     apartat «Service Workers»), cerca `rsala-edu.github.io` i prem
     **Unregister**.
   - Tanca la pestanya de Qi i torna-la a obrir.
4. **Navegador del mòbil:** tanca la pestanya (i l'app instal·lada, si n'hi ha;
   a Android, des de les apps recents) i torna-la a obrir. Si continua igual,
   a Chrome per a Android: Configuració > Configuració de llocs > Totes les
   dades dels llocs > rsala-edu.github.io. **Aquí no** premis «Esborra»: això
   esborraria les dades del dispositiu. Val més esperar o fer servir l'ordinador.
5. **Comprovar-ho:** després d'entrar, Ajustos > Quant a ha de dir la versió
   que es veu a `https://rsala-edu.github.io/qi-consulta/version.json`, i la
   píndola s'ha de posar «Drive: al dia». Si hi havia canvis pendents, es pugen
   sols.

Una finestra privada (incògnit) no té aquest problema: comença sempre sense
cap versió desada.

---

## Part tècnica

### Codi

| Fitxer | Què fa |
|---|---|
| `src/sincronia/sincronitzar.ts` | Una sincronia: llistar, baixar, fusionar, aplicar, pujar, còpies diària i mensual |
| `src/sincronia/copia.ts` | Format del fitxer, xifratge, `fusionar()` (registre a registre, guanya `modificatAt` més gran) i `aplicarContingut()` |
| `src/sincronia/fusioClinica.ts`, `fusioCamps.ts` | Fusió camp a camp de pacients, fitxes i cites amb base de tres vies (`baseSincronia`) |
| `src/sincronia/ContextSincronia.tsx` | Quan se sincronitza (ganxos de Dexie, `setInterval`, `online`), estat de la píndola |
| `src/sincronia/drive.ts` | Client de Drive (`fetch`): `files.list`, `alt=media`, `uploadType=multipart` (crear), `uploadType=media` amb `PATCH` (actualitzar) |
| `src/sincronia/google.ts` | OAuth implícit (`response_type=token`) en una finestra emergent; permís en memòria; llista de hashos permesos |
| `src/db/esquema.ts`, `src/db/esborrats.ts` | Taules de Dexie i marques d'esborrat |

### Format de `qi-dades.json`

```json
{ "format": "qi-copia", "versio": 1,
  "embolcalls": { "contrasenya": {…}, "contrasenyaAt": "…", "secrets": [ … ] },
  "clauId": "<SHA-256 de la clau, 64 hex>",
  "xifrat": { "iv": "…", "dades": "…" } }
```

`xifrat` és AES-GCM amb la clau mestra i dades associades `qi:copia:v1`; a dins
hi ha `{ versio: 1, taules: { <taula>: [registres tal com són a IndexedDB] },
esborrats: [ … ] }`. Els registres de pacient, fitxa, cita i conflicte ja van
xifrats individualment (context `qi:<taula>:<id>`).

### Algorisme de fusió (detall)

- `fusionar(a, b)`: unió per clau primària; guanya el `modificatAt` (o
  `confirmadaAt`) lexicogràficament més gran (ISO 8601, rellotge del
  dispositiu). Un esborrat guanya si `esborratAt >= modificatAt`.
- Abans, `fusionarClinics()`: per a `pacients`, `fitxesCliniques` i `cites`, si
  el registre local i el remot són diferents i **tots dos** tenen `modificatAt
  > darreraSincronia` (hora local d'inici de l'última sincronia correcta),
  fusió camp a camp amb la base `baseSincronia`. També fusiona dues fitxes del
  mateix pacient (índex únic `pacientId`).
- `aplicarContingut()` **substitueix** totes les taules sincronitzades dins una
  transacció: esborra els registres que no són al resultat i escriu la resta.
  Com que el resultat s'ha calculat amb una lectura feta abans de baixar Drive,
  el que s'ha escrit entremig s'esborra o es reescriu (risc 1).
- Els ganxos de Dexie (`creating`, `updating`, `deleting`) ignoren els canvis
  mentre `enCurs` és cert (per no reaccionar a les escriptures de la mateixa
  sincronia): també ignoren els de la doctora (risc 1).

### Concurrència a Drive

- `actualitzar()` és un `PATCH` sense precondicions. El simulat de les proves
  respondria 412 a un `If-Match` incorrecte i la prova `h)` comprova que l'app
  no n'envia cap.
- La pujada és d'un sol cop (`uploadType=media`): Drive guarda la versió nova
  sencera o es queda amb l'anterior; mai queda a mitges (prova `j)`).

### Rellotges i desfasaments

- `darreraSincronia` és l'hora local; els `modificatAt` remots són d'un altre
  rellotge. Amb desfasaments, la detecció d'«editat als dos llocs» falla i es
  passa a «guanya el més nou» (prova `g2)`: el valor més vell guanya perquè el
  dispositiu endarrerit l'ha fusionat amb `modificatAt` = la seva hora).

### Service worker (Chrome amb una versió antiga)

`vite-plugin-pwa` amb `registerType: 'autoUpdate'` i `injectRegister: 'auto'`:
el navegador només busca un `sw.js` nou en carregar la pàgina (navegació
completa; els canvis de pantalla de l'app són canvis del `#` i no compten).
Quan el troba, l'instal·la i l'activa, però la pàgina que hi ha oberta
continua amb el codi antic fins a la càrrega següent, i l'app no ho avisa ni
torna a carregar. No hi ha cap `registration.update()` periòdic (només el botó
«Actualitzar l'app» de DRV-V). Si la instal·lació del service worker nou falla
(per exemple, si falla la baixada d'algun dels fitxers grans precarregats,
fins a 8 MB), el vell es queda fins al pròxim intent. **Causa exacta del cas
del Chrome: no confirmada**; amb els detalls tècnics (versió) i
`chrome://serviceworker-internals` es podria confirmar la pròxima vegada.

### Codis de la píndola

`DRV-P` permís, `DRV-N` sense xarxa, `DRV-<estat HTTP>` Drive, `DRV-V` format
més nou, `DRV-K` una altra clau, `DRV-C` danyada, `DRV-D` fitxes duplicades,
`DRV-L` base de dades local, `DRV-X` desconegut.

### Drive simulat de les proves (`tests/e2e/drive-realista.ts`)

Diversos comptes (un Drive per correu) i dispositius; número de versió i ETag
per fitxer (capçalera `ETag`, 412 si `If-Match` no coincideix); latència per
petició (150 ms per defecte, 1,5 s a la prova `n)`); errors programats per
mètode i dispositiu; retenció de `PATCH` per forçar una cursa; dispositiu
sense connexió (la petició falla com sense xarxa) i permisos revocats (401).
Limitacions: la finestra d'incògnit es simula amb un context nou de Playwright
(no és el mode incògnit real), i esborrar les dades del navegador es fa amb
`Storage.clearDataForOrigin` (Chromium).
