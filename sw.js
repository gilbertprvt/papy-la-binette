/* Papy la Binette — garde tout le site dans l'appareil pour l'utiliser sans Internet.
   À la première visite, toutes les pages, images et sons sont rangés en mémoire ;
   ensuite le site essaie d'abord Internet (pour les mises à jour) et se replie sur la mémoire. */
const CACHE = 'papy-la-binette-20261114a';
const FICHIERS = [
 "./",
 "accueil.html",
 "css/style.css?v=20261114a",
 "data/contenu.js?v=20261114a",
 "img/accueil.webp",
 "img/fleurs/abelia.webp",
 "img/fleurs/achillee.webp",
 "img/fleurs/agapanthe.webp",
 "img/fleurs/agastache.webp",
 "img/fleurs/alstroemere.webp",
 "img/fleurs/ancolie.webp",
 "img/fleurs/anemone_du_japon.webp",
 "img/fleurs/arabette.webp",
 "img/fleurs/astilbe.webp",
 "img/fleurs/astrance.webp",
 "img/fleurs/aubriete.webp",
 "img/fleurs/begonia.webp",
 "img/fleurs/bidens.webp",
 "img/fleurs/bignone.webp",
 "img/fleurs/bourrache.webp",
 "img/fleurs/buddleia.webp",
 "img/fleurs/bugle_rampante.webp",
 "img/fleurs/calibrachoa.webp",
 "img/fleurs/calla.webp",
 "img/fleurs/calystegia.webp",
 "img/fleurs/canna.webp",
 "img/fleurs/capucine.webp",
 "img/fleurs/centauree.webp",
 "img/fleurs/ceraiste.webp",
 "img/fleurs/cheveux_dange.webp",
 "img/fleurs/chevrefeuille.webp",
 "img/fleurs/clematite.webp",
 "img/fleurs/cobee.webp",
 "img/fleurs/coreopsis.webp",
 "img/fleurs/cosmos.webp",
 "img/fleurs/crucianelle.webp",
 "img/fleurs/dahlia.webp",
 "img/fleurs/delphinium.webp",
 "img/fleurs/deutzia.webp",
 "img/fleurs/echinacee.webp",
 "img/fleurs/erigeron.webp",
 "img/fleurs/euphorbe.webp",
 "img/fleurs/ficoide.webp",
 "img/fleurs/forsythia.webp",
 "img/fleurs/freesia.webp",
 "img/fleurs/fuchsia.webp",
 "img/fleurs/gaillardia.webp",
 "img/fleurs/gaura.webp",
 "img/fleurs/gazania.webp",
 "img/fleurs/geranium_vivace.webp",
 "img/fleurs/geranium_zonal.webp",
 "img/fleurs/gerbera.webp",
 "img/fleurs/giroflee.webp",
 "img/fleurs/glycine.webp",
 "img/fleurs/groseillier_a_fleurs.webp",
 "img/fleurs/gypsophile.webp",
 "img/fleurs/hemerocalle.webp",
 "img/fleurs/heuchere.webp",
 "img/fleurs/hibiscus.webp",
 "img/fleurs/hortensia.webp",
 "img/fleurs/iberis.webp",
 "img/fleurs/immortelle.webp",
 "img/fleurs/impatiente.webp",
 "img/fleurs/ipomee.webp",
 "img/fleurs/iris.webp",
 "img/fleurs/jasmin.webp",
 "img/fleurs/jasmin_etoile.webp",
 "img/fleurs/lamier.webp",
 "img/fleurs/lavande.webp",
 "img/fleurs/lilas.webp",
 "img/fleurs/lobelia.webp",
 "img/fleurs/lupin.webp",
 "img/fleurs/marguerite.webp",
 "img/fleurs/millepertuis.webp",
 "img/fleurs/miscanthus.webp",
 "img/fleurs/montbretia.webp",
 "img/fleurs/muflier.webp",
 "img/fleurs/muguet.webp",
 "img/fleurs/narcisse.webp",
 "img/fleurs/nigelle.webp",
 "img/fleurs/osmanthus.webp",
 "img/fleurs/osteospermum.webp",
 "img/fleurs/passiflore.webp",
 "img/fleurs/pavot.webp",
 "img/fleurs/pennisetum.webp",
 "img/fleurs/perovskia.webp",
 "img/fleurs/pervenche.webp",
 "img/fleurs/petunia.webp",
 "img/fleurs/phlox.webp",
 "img/fleurs/phlox_rampant.webp",
 "img/fleurs/physostegia.webp",
 "img/fleurs/pied_dalouette.webp",
 "img/fleurs/pivoine.webp",
 "img/fleurs/pois_de_senteur.webp",
 "img/fleurs/portulaca.webp",
 "img/fleurs/potentille.webp",
 "img/fleurs/renoncule.webp",
 "img/fleurs/rose_grimpante.webp",
 "img/fleurs/rosier_ancien.webp",
 "img/fleurs/rosier_arbustif.webp",
 "img/fleurs/rosier_buisson.webp",
 "img/fleurs/rosier_couvre-sol.webp",
 "img/fleurs/rosier_floribunda.webp",
 "img/fleurs/rosier_grimpant.webp",
 "img/fleurs/rosier_miniature.webp",
 "img/fleurs/rosier_parfume.webp",
 "img/fleurs/rosier_paysager.webp",
 "img/fleurs/rosier_tige.webp",
 "img/fleurs/rudbeckia.webp",
 "img/fleurs/salvia_vivace.webp",
 "img/fleurs/saponaire.webp",
 "img/fleurs/sauge_royale.webp",
 "img/fleurs/scaevola.webp",
 "img/fleurs/sedum.webp",
 "img/fleurs/sedum_tapissant.webp",
 "img/fleurs/seringat.webp",
 "img/fleurs/souci.webp",
 "img/fleurs/spiree.webp",
 "img/fleurs/stachys.webp",
 "img/fleurs/statice.webp",
 "img/fleurs/tournesol.webp",
 "img/fleurs/veronique_vivace.webp",
 "img/fleurs/vinca_minor.webp",
 "img/fleurs/vitadenia.webp",
 "img/fleurs/weigela.webp",
 "img/fleurs/zinnia.webp",
 "img/icone-512.png",
 "img/icone-apple.png",
 "img/icone-maskable.png",
 "img/icone.png",
 "img/implantation.webp",
 "img/lune.webp",
 "img/parterre.webp",
 "img/portillon-ferme.webp",
 "img/portillon-ouvert.webp",
 "img/pratique.webp",
 "index.html",
 "js/app.js?v=20261114a",
 "js/carnet.js?v=20261114a",
 "js/lune.js?v=20261114a",
 "js/parterres.js?v=20261114a",
 "js/plan.js?v=20261114a",
 "js/suivis.js?v=20261114a",
 "manifest.webmanifest",
 "son/grincement.mp3",
 "vendor/astronomy.browser.min.js?v=20261114a"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k.startsWith('papy-la-binette') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function avecDelai(promesse, ms) {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('délai')), ms); promesse.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); }); });
}
async function depuisMemoire(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req)) || (await c.match(req, { ignoreSearch: true })) ||
    (req.mode === 'navigate' ? (await c.match('accueil.html', { ignoreSearch: true })) : undefined);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // polices Google : mémoire d'abord (elles ne changent pas)
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const m = await c.match(req); if (m) return m;
      const r = await fetch(req); if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  // fichiers du site : Internet d'abord (mises à jour), mémoire si pas de réseau ou réseau trop lent
  e.respondWith(avecDelai(fetch(req), 5000).then(r => {
    if (r && r.ok) { const copie = r.clone(); caches.open(CACHE).then(c => c.put(req, copie)); }
    return r;
  }).catch(async () => (await depuisMemoire(req)) || Response.error()));
});
