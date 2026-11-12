# Qi — app de consulta d'acupuntura

## Context
App per a una metgessa (ORL i medicina xinesa) per gestionar pacients,
valoracions, sessions i punts d'acupuntura. Especificacions: docs/especificacions.md
Estat actual, decisions pendents i el que queda: docs/estat.md (llegir-lo en començar)

## Tecnologia
- TypeScript estricte, React, Vite, Dexie (IndexedDB), vite-plugin-pwa
- Cos 3D amb Three.js i React Three Fiber; orella en SVG
- Formularis amb React Hook Form i Zod
- Proves amb Vitest (unitàries) i Playwright (flux complet)
- Dades xifrades al dispositiu i sincronitzades amb Google Drive (appDataFolder)
- Publicació a GitHub Pages amb GitHub Actions

## Regles
- Mai dades reals de pacients al repositori ni a les proves: només dades inventades
- Totes les dades de pacient passen per src/crypto abans de guardar-se o pujar-se
- Cap recurs carregat d'internet en temps d'execució (tipografies i icones locals)
- Interfície en català, amb els textos en un fitxer de traduccions
- Cada funcionalitat nova amb proves; npm test ha de passar abans de cada commit
- Abans de cada push, executar en local la tanda completa: npm run lint, npm test, npx playwright test i npm run test:e2e:produccio
- CI amb dos workflows. «Publicar» (lint, unitàries, E2E @essencial, producció i build) bloqueja el desplegament. «Proves completes» (totes les E2E, en 4 shards) no bloqueja
- Després de cada push, esperar «Publicar» (gh run watch). Una versió no està publicada fins que «Publicar» és verd i version.json de GitHub Pages coincideix amb el commit. Si falla, dir-ho el primer de tot al resum
- Abans de començar la part següent, comprovar que «Proves completes» és verd. Si ha fallat, dir-ho el primer de tot i arreglar-ho abans de continuar amb res més
- No fer cap push nou fins que el «Publicar» anterior ha acabat (un push nou el cancel·la). Mentrestant es pot continuar treballant en local
- Els commits que només toquen docs/ o fitxers .md no executen el CI ni publiquen (paths-ignore): per a aquests no cal esperar res
- Treballar per parts, amb un commit per part i un resum curt de cada una quan el CI és verd
- Que no es perdi mai feina: la feina en curs es desa sempre dins el repositori, mai en worktrees ni carpetes temporals fora del repo (el scratchpad només per a fitxers d'un sol ús: registres, captures de prova). Commits petits i freqüents a la branca de treball, i push d'aquesta branca (no de main) com a mínim cada hora i sempre abans d'aturar-se. Si una sessió s'acaba, la següent ha de poder continuar des de GitHub (els pushos de branques que no són main no executen el CI ni publiquen)
