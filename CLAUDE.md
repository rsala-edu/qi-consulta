# Qi — app de consulta d'acupuntura

## Context
App per a una metgessa (ORL i medicina xinesa) per gestionar pacients,
valoracions, sessions i punts d'acupuntura. Especificacions: docs/especificacions.md

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
- Després de cada push, esperar el resultat de GitHub Actions (gh run watch). Cap feina no està acabada ni «publicada» fins que el CI és verd i la versió de GitHub Pages (version.json) coincideix amb el commit. Si el CI falla, dir-ho el primer de tot al resum
- No fer cap push mentre el CI d'un altre commit encara corre si se n'ha d'informar del resultat (un push nou cancel·la l'anterior)
