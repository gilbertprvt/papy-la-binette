# Papy la Binette

Le carnet du jardinier : conseils de saison, sol et engrais, associations de plantes,
catalogues (légumes, fruits rouges, aromatiques, fleurs) et calendrier lunaire biodynamique.

Version web de l'application Mac « Mon Jardin ». Le site fonctionne sur ordinateur,
téléphone et tablette, sans installation. Les données personnelles (ville choisie, etc.)
sont enregistrées automatiquement dans le navigateur de chaque appareil.
Après une première visite, le site fonctionne aussi sans connexion Internet.

## Mettre le site en ligne avec GitHub Pages

1. Déposer tous les fichiers de ce dossier à la racine du dépôt.
2. Dans le dépôt : **Settings → Pages**.
3. Sous « Build and deployment », choisir **Deploy from a branch**, branche **main**, dossier **/ (root)**, puis **Save**.
4. Après une ou deux minutes, le site est disponible à l'adresse
   `https://VOTRE-PSEUDO.github.io/NOM-DU-DEPOT/`.

## Contenu

- `index.html` : la page d’entrée (le portillon qui s’ouvre)
- `accueil.html` : le site lui-même
- `son/grincement.mp3` : le grincement du portillon
- `js/app.js` : les écrans
- `js/plan.js` : le plan du jardin, année par année
- `js/carnet.js` : l’agenda et les relevés météo
- `js/suivis.js` : le suivi des plantations, les dépenses et les archives
- `js/parterres.js` : créer un parterre fleuri et y planter les fleurs du catalogue
- `js/lune.js` : les calculs lunaires (phases, constellations, nœuds, périgée, apogée)
- `data/contenu.js` : les textes et catalogues repris de l'application
- `img/` : les illustrations et les photos de fleurs
- `sw.js` : garde tout le site dans l’appareil pour l’utiliser hors ligne
- `vendor/astronomy.browser.min.js` : bibliothèque de calcul astronomique (licence MIT)
