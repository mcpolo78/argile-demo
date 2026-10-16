# argile-demo — maquette 3D paramétrique

Projet de démonstration pour une candidature chez **Argile** (SaaS pour les artisans RGE de la rénovation énergétique).
Poste : [développeur full-stack](https://www.welcometothejungle.com/fr/companies/remi/jobs/eb8dcc21-ed78-4502-8cf0-3ea0d488e583), CDI, Paris.

Argile intègre une reconstruction 3D du logement et un simulateur d'aides intégrable au site des artisans. Cette démo relie les deux. On décrit une maison en quelques paramètres et on la voit en 3D. Un clic sur les zones à rénover suffit : **le métré et l'estimation des aides se recalculent à partir de la géométrie**.

## Fonctionnalités

- **Configurateur** : dimensions, niveaux, toiture 2 pans / 4 pans / plate, pente, combles perdus ou aménagés, plancher bas, mitoyenneté, fenêtres par façade. Les paramètres incohérents sont refusés avec un message, et la maquette garde alors le dernier état valide.
- **Vue 3D** (react-three-fiber) :
  - le survol d'une zone affiche sa surface et le poste de travaux associé ;
  - un clic ajoute ou retire ce poste ;
  - toutes les zones d'un même poste se colorent ensemble.
- **Métré** : murs bruts, nets et mitoyens, ouvertures, pignons, rampants, plancher des combles, toiture-terrasse, plancher bas.
- **Estimation indicative** : coût, MaPrimeRénov' par tranche de revenus, primes CEE, plafonds par poste, écrêtement et reste à charge.
- **Projets enregistrés** en Postgres, avec une URL partageable `/projets/[id]`. Le serveur revalide l'entrée et **recalcule** surfaces et estimation : on ne fait pas confiance au client.
- **Version intégrable** sur `/embed` (en-tête `frame-ancestors *`), avec le snippet iframe affiché sur la page d'accueil.

## Architecture

```
src/lib/house/       géométrie paramétrique : fonctions pures, sans three.js
  params.ts          schéma zod + règles de cohérence (ouvertures, mitoyenneté…)
  geometry.ts        buildHouse(params) → zones planes (repère origin/u/v + contour 2D + trous)
  surfaces.ts        aires exactes par zone (formule du lacet) et totaux du métré
src/lib/estimate/    zones → postes de travaux, barème, estimation et écrêtement
src/components/house three.js uniquement pour l'affichage : ShapeGeometry + matrice du repère
src/db/              Drizzle : tables bareme et projects ; PGlite en local, Neon en prod
blender/             oracle de surfaces (voir ci-dessous)
fixtures/            cas de référence et aires mesurées par Blender
```

Le choix structurant : **chaque zone est un polygone plan décrit dans son propre repère orthonormé**. Une même donnée sert à la fois au calcul exact des aires en 2D et au rendu 3D, sans dupliquer la géométrie.

## Les tests, et un oracle Blender

```bash
npm test
```

- **Cas calculés à la main** : boîte, 2 pans à 45°, 4 pans, plan carré.
- **Invariants** sur des maisons variées :
  - surface de toiture = emprise / cos(pente) ;
  - normales unitaires et orientées vers l'extérieur ;
  - ouvertures dans leur mur, sans chevauchement.
- **Estimation** : plafonds par poste, écrêtement, transposition du poste toiture quand le toit change.
- **Oracle Blender** : `blender/house_oracle.py` reconstruit chaque cas de `fixtures/cases.json` face par face, en 3D (axe z vertical, sans repère 2D ni formule du lacet), et mesure les aires avec `bmesh`. `surfaces.oracle.test.ts` exige l'accord des deux implémentations à 0,01 % près. Pour régénérer les mesures :

```bash
npm run oracle
```

Cette commande demande `blender` dans le PATH. Le script fonctionne aussi depuis le MCP Blender via `run(cases, out)`.

## Lancer en local

```bash
npm install
```

```bash
npm run dev
```

Aucune base à installer : PGlite crée `.pglite/`, applique les migrations et charge le barème au premier appel. En production, il faut définir `DATABASE_URL` (Neon), puis lancer :

```bash
npm run db:migrate
```

## Équipements 3D (Tripo3D → Blender → web)

La PAC s'affiche aujourd'hui sous la forme d'un volume à ses dimensions réelles. Pour la remplacer par un vrai modèle :

1. Générer une unité extérieure de PAC air-eau sur tripo3d.ai, en image-to-3D ou text-to-3D, puis l'exporter en GLB.
2. Dans Blender (MCP ou à la main) :
   - remettre le modèle à l'échelle, soit 1,0 × 0,8 × 0,4 m ;
   - placer l'origine au sol, la face avant vers +Z ;
   - le décimer, puis l'exporter en GLB.
3. Compresser le fichier, puis renseigner `MODELS.pac` dans `src/lib/assets.ts` :

```bash
npx @gltf-transform/cli optimize pac.glb public/models/pac.glb --compress meshopt --texture-compress webp
```

## Limites assumées

- **Barème de démonstration** : ordres de grandeur inspirés des forfaits par geste, pas les montants officiels. La tranche de revenus est choisie directement, sans calcul à partir du revenu fiscal.
- **Volume simple** : un rectangle, faîtage parallèle à la longueur, ouvertures de taille standard, sans débord de toit ni lucarne.
- **Assets non métriques** : les modèles générés par IA servent au rendu, jamais à la mesure.

## Étapes

- [x] Socle Next.js, Drizzle, Vitest
- [x] Géométrie paramétrique et métré, testés
- [x] Oracle Blender et fixtures
- [x] Estimation et barème en base
- [x] Vue 3D interactive et configurateur
- [x] Projets enregistrés, page partageable, version `/embed`
- [ ] Modèle de PAC Tripo3D, optimisé pour le web
- [ ] Captures d'écran et GIF
- [ ] Déploiement Vercel + Neon
