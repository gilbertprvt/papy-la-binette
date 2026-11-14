/* Papy la Binette — carnet du jardinier (version web de l'application Mon Jardin) */
(function () {
  'use strict';
  const D = window.DONNEES;
  const L = window.Lune;
  const page = document.getElementById('page');
  const fil = document.getElementById('fil');

  /* ---------- Stockage dans l'appareil ---------- */
  const PREFIXE = 'monjardin.';
  const memoire = {};
  // chaque modification note son heure, pour que la synchronisation garde toujours la plus récente
  const HORLOGE = 'papy.horloge';
  const ecouteurs = [];
  function lireHorloge() { try { return JSON.parse(localStorage.getItem(HORLOGE)) || {}; } catch (e) { return memoire.__horloge || {}; } }
  function noterHeure(cle, t) {
    const h = lireHorloge(); h[cle] = t; memoire.__horloge = h;
    try { localStorage.setItem(HORLOGE, JSON.stringify(h)); } catch (e) { /* stockage indisponible */ }
  }
  const stock = {
    lire(cle, defaut) {
      try { const v = localStorage.getItem(PREFIXE + cle); return v === null ? defaut : JSON.parse(v); }
      catch (e) { return cle in memoire ? memoire[cle] : defaut; }
    },
    ecrire(cle, val) {
      memoire[cle] = val;
      try { localStorage.setItem(PREFIXE + cle, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ }
      noterHeure(cle, Date.now());
      ecouteurs.forEach(f => { try { f(cle); } catch (e) { /* rien */ } });
    },
    // valeur reçue d'un autre appareil : enregistrée avec son heure d'origine, sans relancer d'envoi
    appliquer(cle, val, t) {
      memoire[cle] = val;
      try { localStorage.setItem(PREFIXE + cle, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ }
      noterHeure(cle, t);
    },
    horloge: lireHorloge,
    surModif(fn) { ecouteurs.push(fn); },
    tout() {
      const res = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.startsWith(PREFIXE)) res[k.slice(PREFIXE.length)] = JSON.parse(localStorage.getItem(k));
        }
      } catch (e) { for (const k in memoire) if (k !== '__horloge') res[k] = memoire[k]; }
      return res;
    }
  };

  function ville() {
    const nom = stock.lire('ville', D.villeDefaut);
    const v = D.villes[nom] || D.villes[D.villeDefaut];
    return Object.assign({ nom: D.villes[nom] ? nom : D.villeDefaut }, v);
  }

  /* ---------- Outils ---------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  function aujourdhui() { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; }
  const memeJour = (a, b) => a.y === b.y && a.m === b.m && a.d === b.d;
  function jourSemaine(j) { return new Date(Date.UTC(j.y, j.m - 1, j.d)).getUTCDay(); }
  function dateLongue(j) { return cap(JOURS[jourSemaine(j)]) + ' ' + j.d + ' ' + MOIS[j.m - 1]; }
  function sansEmoji(s) { return s.replace(/^[^\p{L}]+/u, '').trim(); }

  /* ---------- Navigation ---------- */
  const PARENTS = {
    jardin: '', conseil: '', lune: '', parterre: '', agenda: '', meteo: '',
    saisons: 'conseil', engrais: 'conseil', associations: 'conseil', plantes: 'conseil', fruits: 'conseil', aromatiques: 'conseil',
    calendrier: 'lune', 'meilleurs-jours': 'lune', 'fiches-lune': 'lune',
    fleurs: 'parterre', parterres: 'parterre', planter: 'parterre', plan: 'jardin', 'suivi-plantations': 'jardin', depenses: 'jardin', archives: 'jardin'
  };
  const NOMS = {
    '': 'Accueil', jardin: 'Mon Jardin', conseil: 'Conseil & Culture', lune: 'Calendrier lunaire', parterre: 'Parterre fleuri',
    agenda: 'Agenda personnel', meteo: 'Relevés météo', saisons: 'Conseils saisonniers', engrais: 'Sol & Engrais',
    associations: 'Associations', plantes: 'Plantes potagères', fruits: 'Fruits rouges', aromatiques: 'Aromatiques',
    calendrier: 'Calendrier', 'meilleurs-jours': 'Meilleurs jours', 'fiches-lune': 'Fiches plantes', fleurs: 'Catalogue fleurs', parterres: 'Créer un parterre', planter: 'Planter un parterre',
    plan: 'Plan du jardin', 'suivi-plantations': 'Suivi des plantations', depenses: 'Suivi des dépenses', archives: 'Archives'
  };

  function majFil(route) {
    const chaine = [];
    let r = route;
    while (r !== undefined && r !== '') { chaine.unshift(r); r = PARENTS[r]; }
    fil.innerHTML = chaine.map((x, i) => i === chaine.length - 1 ? esc(NOMS[x]) : '<a href="#' + x + '">' + esc(NOMS[x]) + '</a>').join(' › ');
  }

  function rendre() {
    const route = decodeURIComponent(location.hash.replace(/^#/, ''));
    const fn = PAGES[route] || PAGES[''];
    document.body.classList.toggle('theme-nuit', route === 'lune' || PARENTS[route] === 'lune');
    majFil(PAGES[route] ? route : '');
    btnPrec.hidden = !PAGES[route] || route === '';
    document.getElementById('accueil-btn').hidden = btnPrec.hidden;
    document.title = (route && NOMS[route] ? NOMS[route] + ' — ' : '') + 'Papy la Binette';
    page.innerHTML = '';
    const zone = document.createElement('div');
    page.appendChild(zone);
    fn(zone);
    window.scrollTo(0, 0);
  }
  // chaque page visitée dans le site est numérotée dans l'historique du navigateur
  let niveau = 0;
  function noterNiveau() {
    const st = history.state;
    if (st && typeof st.n === 'number') niveau = st.n;
    else { niveau = niveau + 1; try { history.replaceState({ n: niveau }, ''); } catch (e) { /* rien */ } }
  }
  window.addEventListener('hashchange', () => { noterNiveau(); rendre(); });

  /* Bouton « Page précédente » : revient en arrière dans le site,
     ou remonte d'un niveau si on est arrivé directement sur une page */
  const btnPrec = document.getElementById('precedent');
  btnPrec.addEventListener('click', () => {
    if (history.state && history.state.n > 0) history.back();
    else {
      const r = decodeURIComponent(location.hash.replace(/^#/, ''));
      const parent = PARENTS[r] || '';
      history.replaceState({ n: 0 }, '', parent ? '#' + parent : location.pathname + location.search);
      rendre();
    }
  });

  /* Sauvegarde automatique : chaque modification est enregistrée aussitôt dans l'appareil,
     et tout ce qui est en cours de saisie l'est aussi quand on quitte ou ferme le site */
  const aSauver = new Set();
  window.MonJardinAutoSave = fn => aSauver.add(fn);
  function sauverTout() { aSauver.forEach(fn => { try { fn(); } catch (e) { /* rien */ } }); }
  window.addEventListener('pagehide', sauverTout);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sauverTout(); });

  /* ---------- Pages menu ---------- */
  function etiquette(e) {
    if (e.plusTard) {
      return '<div class="etiquette plus-tard" aria-disabled="true"><span class="ico">' + e.ico + '</span><span><span class="nom">' +
        esc(e.nom) + '</span><span class="note">' + esc(e.plusTard) + '</span></span></div>';
    }
    return '<a class="etiquette' + (e.retour ? ' retour' : '') + '" href="#' + e.lien + '"><span class="ico">' + e.ico +
      '</span><span><span class="nom">' + esc(e.nom) + '</span>' + (e.note ? '<span class="note">' + esc(e.note) + '</span>' : '') + '</span></a>';
  }
  function pageMenu(cible, image, alt, titre, etiquettes) {
    cible.innerHTML = '<section class="menu-page"><div class="illus"><img src="' + image + '" alt="' + esc(alt) + '" width="800" height="900"></div>' +
      '<div><h1 class="sr-titre">' + esc(titre) + '</h1><div class="etiquettes">' + etiquettes.map(etiquette).join('') + '</div></div></section>';
  }
  const RETOUR = { nom: 'Retour à l’accueil', ico: '⬅', lien: '', retour: true };
  const PLUS_TARD = 'Mis de côté pour plus tard';

  const PAGES = {};
  PAGES[''] = c => pageMenu(c, 'img/accueil.webp', 'Papy la Binette arrose ses salades', 'Papy la Binette', [
    { nom: 'Mon Jardin', ico: '🏡', lien: 'jardin', note: 'Plan du jardin, plantations, dépenses' },
    { nom: 'Conseil & Culture', ico: '📚', lien: 'conseil', note: 'Saisons, sol, associations, catalogues' },
    { nom: 'Calendrier lunaire', ico: '🌙', lien: 'lune', note: 'Jardiner avec la Lune' },
    { nom: 'Agenda personnel', ico: '📅', lien: 'agenda', note: 'Vos notes jour par jour' },
    { nom: 'Relevés météo', ico: '🌦️', lien: 'meteo', note: 'Saisie, statistiques et graphiques' },
    { nom: 'Parterre fleuri', ico: '🌸', lien: 'parterre', note: 'Catalogue des fleurs' }
  ]);
  PAGES.conseil = c => pageMenu(c, 'img/pratique.webp', 'Un jardinier explique au tableau', 'Conseil & Culture', [
    { nom: 'Conseils saisonniers', ico: '🍂', lien: 'saisons' },
    { nom: 'Sol & Engrais', ico: '🪱', lien: 'engrais' },
    { nom: 'Associations', ico: '🤝', lien: 'associations' },
    { nom: 'Plantes potagères', ico: '🥕', lien: 'plantes' },
    { nom: 'Fruits rouges', ico: '🍓', lien: 'fruits' },
    { nom: 'Aromatiques', ico: '🌿', lien: 'aromatiques' },
    RETOUR
  ]);
  PAGES.lune = c => pageMenu(c, 'img/lune.webp', 'Un jardinier sous la pleine lune', 'Jardiner avec la Lune', [
    { nom: 'Calendrier lunaire', ico: '🗓️', lien: 'calendrier', note: 'Ville : ' + ville().nom },
    { nom: 'Meilleurs jours', ico: '⭐', lien: 'meilleurs-jours' },
    { nom: 'Fiches plantes', ico: '🌱', lien: 'fiches-lune' },
    RETOUR
  ]);
  PAGES.parterre = c => pageMenu(c, 'img/parterre.webp', 'Un parterre de fleurs', 'Parterre fleuri', [
    { nom: 'Catalogue fleurs', ico: '💐', lien: 'fleurs' },
    { nom: 'Créer un parterre', ico: '✏️', lien: 'parterres', note: 'Choisir une forme et ses dimensions' },
    { nom: 'Planter un parterre', ico: '🌷', lien: 'planter', note: 'Placer les fleurs du catalogue' },
    RETOUR
  ]);
  PAGES.jardin = c => pageMenu(c, 'img/implantation.webp', 'Plan d’un jardin', 'Mon Jardin', [
    { nom: 'Plan du jardin', ico: '📐', lien: 'plan', note: 'Planches, allées et plantes, année par année' },
    { nom: 'Suivi des plantations', ico: '🌱', lien: 'suivi-plantations', note: 'Semis, plantation, récolte' },
    { nom: 'Suivi des dépenses', ico: '💶', lien: 'depenses', note: 'Achats et bilan par catégorie' },
    { nom: 'Archives', ico: '🗄️', lien: 'archives', note: 'Les années passées' },
    RETOUR
  ]);

  /* ---------- Catalogues (plantes, fruits, aromatiques, fleurs) ---------- */
  function pageCatalogue(cle, intro) {
    return c => {
      const cat = D[cle];
      const noms = Object.keys(cat.catalogue);
      c.innerHTML = '<h1>' + esc(sansEmoji(cat.titre)) + '</h1><p class="intro">' + esc(intro) + '</p>' +
        '<div class="outils"><label for="f-cat">Catégorie</label><select id="f-cat"><option value="">Toutes</option>' +
        noms.map(n => '<option>' + esc(n) + '</option>').join('') + '</select>' +
        '<input type="search" id="f-txt" placeholder="Rechercher une plante…" aria-label="Rechercher"></div><div id="res"></div>';
      const res = c.querySelector('#res'), fCat = c.querySelector('#f-cat'), fTxt = c.querySelector('#f-txt');
      const photo = cle === 'fleurs';
      const cols = photo ? cat.colonnes.slice(1) : cat.colonnes;
      function valeur(v) {
        if (v === 'Oui') return '<span class="oui">Oui</span>';
        if (v === 'Non') return '<span class="non">Non</span>';
        if (v === 'Léger') return '<span class="leger">Léger</span>';
        return esc(v);
      }
      function maj() {
        const q = sansAccent(fTxt.value.trim());
        let html = '';
        for (const n of noms) {
          if (fCat.value && fCat.value !== n) continue;
          const lignes = cat.catalogue[n].filter(r => !q || sansAccent(r.join(' ')).includes(q));
          if (!lignes.length) continue;
          const coul = cat.coulEntete[n] || cat.couleur;
          html += '<section class="categorie"><h2 style="background:' + coul + '">' + esc(n) + '</h2><div class="fiches">' +
            lignes.map(r => {
              const obs = r[r.length - 1];
              const nom = cle === 'fruits' ? r[0] + ' — ' + r[1] : r[0];
              const debut = cle === 'fruits' ? 2 : 1;
              let dl = '';
              for (let i = debut; i < r.length - 1; i++) dl += '<dt>' + esc(cols[i]) + '</dt><dd>' + valeur(r[i]) + '</dd>';
              const img = photo && cat.images[r[0]] ? '<img class="photo" loading="lazy" src="' + cat.images[r[0]] + '" alt="' + esc(r[0]) + '" data-zoom="' + esc(r[0]) + '">' : '';
              return '<article class="fiche" style="border-left-color:' + coul + '"><div class="tete">' + img + '<h3>' + esc(nom) + '</h3></div><dl>' + dl +
                '</dl><p class="obs">' + esc(obs) + '</p></article>';
            }).join('') + '</div></section>';
        }
        res.innerHTML = html || '<p class="vide">Aucune plante ne correspond à « ' + esc(fTxt.value) + ' ».</p>';
      }
      fCat.addEventListener('change', maj);
      fTxt.addEventListener('input', maj);
      res.addEventListener('click', e => {
        const im = e.target.closest('[data-zoom]');
        if (!im) return;
        const z = document.createElement('div');
        z.className = 'zoom';
        z.innerHTML = '<div><img src="' + im.src + '" alt=""><p>' + esc(im.dataset.zoom) + '</p></div>';
        z.addEventListener('click', () => z.remove());
        document.body.appendChild(z);
      });
      maj();
    };
  }
  PAGES.plantes = pageCatalogue('plantes', 'Sol, exposition, dates de semis et de plantation, espacements et première récolte des légumes.');
  PAGES.fruits = pageCatalogue('fruits', 'Variétés de petits fruits, floraison, récolte et utilisations.');
  PAGES.aromatiques = pageCatalogue('aromatiques', 'Cueillette, conservation, usages en cuisine et vertus des plantes aromatiques.');
  PAGES.fleurs = pageCatalogue('fleurs', 'Des idées de fleurs pour vos parterres. Touchez une photo pour l’agrandir.');

  /* ---------- Conseils saisonniers ---------- */
  PAGES.saisons = c => {
    let climat = stock.lire('climat', 'doux');
    const moisCourant = new Date().getMonth() + 1;
    const saisonsDe = cl => cl === 'doux' ? D.saisons.doux : D.saisons.froid;
    let saison = Object.keys(saisonsDe(climat)).find(s => saisonsDe(climat)[s].mois.includes(moisCourant)) || 'Printemps';
    function maj() {
      const S = saisonsDe(climat), s = S[saison];
      const conseilsMois = (climat === 'doux' ? D.saisons.moisDoux : D.saisons.moisFroid)[String(moisCourant)] || [];
      c.innerHTML = '<h1>Conseils saisonniers</h1>' +
        '<div class="outils"><span><b>Climat</b></span><div class="pastilles">' +
        [['doux', '🌞 Climat doux'], ['froid', '❄️ Climat froid']].map(([k, t]) => '<button class="pastille" data-climat="' + k + '" aria-pressed="' + (k === climat) + '">' + t + '</button>').join('') +
        '</div></div><div class="outils"><span><b>Saison</b></span><div class="pastilles">' +
        Object.keys(S).map(k => '<button class="pastille" data-saison="' + esc(k) + '" aria-pressed="' + (k === saison) + '">' + S[k].emoji + ' ' + esc(k) + '</button>').join('') +
        '</div></div>' +
        '<div class="mois-encart"><h2>Ce mois-ci : ' + MOIS[moisCourant - 1] + '</h2><ul>' + conseilsMois.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
        '<h2>' + s.emoji + ' ' + esc(saison) + ' — ' + (climat === 'doux' ? 'climat doux' : 'climat froid') + '</h2>' +
        '<div class="rubriques">' + Object.entries(s.rubriques).map(([t, l]) =>
          '<section class="rubrique" style="border-top-color:' + s.bord + '"><h3>' + esc(t) + '</h3><ul>' + l.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></section>').join('') + '</div>';
    }
    c.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.climat) { climat = b.dataset.climat; stock.ecrire('climat', climat); }
      if (b.dataset.saison) saison = b.dataset.saison;
      maj();
    });
    maj();
  };

  /* ---------- Sol & engrais ---------- */
  PAGES.engrais = c => {
    const sections = Object.keys(D.engrais);
    let actif = sections[0];
    function maj() {
      c.innerHTML = '<h1>Sol & Engrais</h1><p class="intro">Guide de référence sur les engrais, les amendements et l’entretien du sol.</p>' +
        '<div class="outils"><div class="pastilles">' + sections.map(s => '<button class="pastille" data-s="' + esc(s) + '" aria-pressed="' + (s === actif) + '">' + esc(s.replace(/\s+/g, ' ')) + '</button>').join('') + '</div></div>' +
        Object.entries(D.engrais[actif]).map(([t, txt]) => '<section class="sous-section"><h3>' + esc(t) + '</h3><p class="texte-long">' + esc(txt) + '</p></section>').join('');
    }
    c.addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) { actif = b.dataset.s; maj(); } });
    maj();
  };

  /* ---------- Associations ---------- */
  PAGES.associations = c => {
    const toutes = Object.keys(D.associations).sort((a, b) => a.localeCompare(b, 'fr'));
    let choix = null;
    c.innerHTML = '<h1>Associations de plantes</h1><p class="intro">Choisissez une plante pour voir ses bonnes voisines et celles à éviter.</p>' +
      '<div class="assoc"><div><div class="outils"><input type="search" id="q" placeholder="Rechercher…" aria-label="Rechercher une plante"></div><div class="liste-plantes" id="liste"></div></div><div id="detail"></div></div>';
    const liste = c.querySelector('#liste'), detail = c.querySelector('#detail'), q = c.querySelector('#q');
    function majListe() {
      const f = sansAccent(q.value.trim());
      liste.innerHTML = toutes.filter(p => !f || sansAccent(p).includes(f))
        .map(p => '<button data-p="' + esc(p) + '" aria-current="' + (p === choix) + '">' + esc(p) + '</button>').join('') || '<p class="vide">Aucune plante</p>';
    }
    function lien(p) { return D.associations[p] ? '<button class="lien-plante" data-p="' + esc(p) + '">' + esc(p) + '</button>' : '<b>' + esc(p) + '</b>'; }
    function majDetail() {
      if (!choix) { detail.innerHTML = '<p class="vide">💡 Sélectionnez une plante dans la liste.</p>'; return; }
      const a = D.associations[choix];
      const pris = new Set([choix, ...a.bonnes.map(x => x[0]), ...a.mauvaises.map(x => x[0])]);
      const neutres = toutes.filter(p => !pris.has(p));
      detail.innerHTML = '<h2 style="margin-top:0">Associations pour : ' + esc(choix) + '</h2>' +
        '<p>' + a.bonnes.length + ' bonne(s) association(s) · ' + a.mauvaises.length + ' incompatibilité(s) · ' + neutres.length + ' neutre(s)</p>' +
        '<div class="colonnes-assoc">' +
        '<section class="bloc-assoc bonnes"><h3>✅ Bonnes associations</h3><ul>' + (a.bonnes.map(([p, r]) => '<li>' + lien(p) + '<span class="raison">' + esc(r) + '</span></li>').join('') || '<li>Aucune association notable connue</li>') + '</ul></section>' +
        '<section class="bloc-assoc mauvaises"><h3>❌ À éviter</h3><ul>' + (a.mauvaises.map(([p, r]) => '<li>' + lien(p) + '<span class="raison">' + esc(r) + '</span></li>').join('') || '<li>Aucune incompatibilité connue</li>') + '</ul></section>' +
        '<section class="bloc-assoc neutres"><h3>◯ Neutres</h3><ul>' + neutres.map(p => '<li>' + lien(p) + '</li>').join('') + '</ul></section></div>';
    }
    c.addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      choix = b.dataset.p; majListe(); majDetail();
      if (window.innerWidth < 900) detail.scrollIntoView({ behavior: 'smooth' });
    });
    q.addEventListener('input', majListe);
    majListe(); majDetail();
  };

  /* ---------- Calendrier lunaire ---------- */
  const TYPES = ['Racines', 'Feuilles', 'Fleurs', 'Fruits'];
  const cache = {};
  function moisLunaire(y, m) {
    const v = ville(), k = y + '-' + m + '-' + v.nom;
    if (!cache[k]) cache[k] = L.calendrierMensuel(y, m, v);
    return cache[k];
  }
  function navMois(etat, maj) {
    return {
      html: '<div class="nav-mois"><button data-nav="-1" aria-label="Mois précédent">◀</button><span class="mois">' + cap(MOIS[etat.m - 1]) + ' ' + etat.y +
        '</span><button data-nav="1" aria-label="Mois suivant">▶</button><button data-nav="0">Mois actuel</button></div>',
      clic(e) {
        const b = e.target.closest('[data-nav]');
        if (!b) return false;
        const n = +b.dataset.nav;
        if (n === 0) { const t = aujourdhui(); etat.y = t.y; etat.m = t.m; }
        else { etat.m += n; if (etat.m < 1) { etat.m = 12; etat.y--; } if (etat.m > 12) { etat.m = 1; etat.y++; } }
        etat.sel = null; maj(); return true;
      }
    };
  }
  function legende() {
    return '<div class="legende">' + TYPES.map(t => '<span><i style="background:' + D.lune.couleurs[t] + ';border-color:' + D.lune.bords[t] + '"></i>' + D.lune.icones[t] + ' ' + t + '</span>').join('') +
      '<span><i style="background:#e0e0e0;border-color:#888"></i>⚠️ Jour défavorable</span></div>';
  }
  function detailJour(r) {
    const c = D.lune.conseils[r.type];
    const renf = r.typeSoleil === r.type;
    let h = '<h2>' + dateLongue(r.date) + '</h2>';
    h += '<p class="ligne">' + esc(r.phase) + '</p>';
    for (const [e, n, hr] of r.heuresPhases) h += '<p class="ligne">' + e + ' ' + esc(n) + ' à ' + hr + ' (heure locale)</p>';
    h += '<p class="ligne">🌙 Lune en ' + esc(r.constellation) + ' → ' + D.lune.icones[r.type] + ' ' + esc(r.type) + '</p>';
    h += '<p class="ligne">☀️ Soleil en ' + esc(r.constSoleil) + ' (' + esc(r.typeSoleil) + ')' + (renf ? ' <span class="renforce">✨ effet renforcé !</span>' : '') + '</p>';
    h += '<p class="ligne">Lever : ' + r.lever + ' · Coucher : ' + r.coucher + ' (' + esc(ville().nom) + ')</p>';
    if (r.evenements.length) {
      h += '<div class="alerte-bloc"><b>⚠️ Jour défavorable pour jardiner</b>' + r.evenements.map(e => '<div>' + esc(e) + '</div>').join('') +
        '<div>❌ Reportez semis, plantations et récoltes.</div></div>';
    } else if (c) {
      h += '<h3>✅ Activités favorables</h3><ul>' + c.favorables.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
      h += '<h3>❌ À éviter</h3><ul>' + c.defavorables.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    }
    return h;
  }

  PAGES.calendrier = c => {
    const t = aujourdhui();
    const etat = { y: t.y, m: t.m, sel: null };
    const nav = navMois(etat, maj);
    function maj() {
      const jours = moisLunaire(etat.y, etat.m);
      const sel = etat.sel ? jours[etat.sel - 1] : (etat.y === t.y && etat.m === t.m ? jours[t.d - 1] : jours[0]);
      const decal = (jourSemaine(jours[0].date) + 6) % 7;
      let g = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => '<div class="jsem">' + j + '</div>').join('');
      for (let i = 0; i < decal; i++) g += '<div></div>';
      for (const r of jours) {
        const def = r.evenements.length > 0;
        const cls = 'jour' + (def ? ' defavorable' : '') + (memeJour(r.date, t) ? ' aujourdhui' : '');
        g += '<button class="' + cls + '" data-j="' + r.date.d + '" aria-pressed="' + (r === sel) + '" style="background:' + D.lune.couleurs[r.type] + ';border-color:' + D.lune.bords[r.type] +
          '" aria-label="' + esc(dateLongue(r.date) + ', ' + r.type + (def ? ', jour défavorable' : '')) + '">' +
          '<span class="num">' + r.date.d + '</span><span class="typ">' + D.lune.icones[r.type] + '</span><span class="ph">' + [...r.phase][0] +
          (r.heuresPhases.length ? ' ' + r.heuresPhases[0][2] : '') + '</span><span class="cst">' + esc(r.constellation) + '</span>' +
          (def ? '<span class="alerte" aria-hidden="true">⚠️</span>' : '') + '</button>';
      }
      // résumé : 3 meilleurs jours par type, concordance Lune/Soleil d'abord
      let resume = '';
      for (const ty of TYPES) {
        const l = jours.filter(r => r.type === ty && L.estFavorable(r))
          .sort((a, b) => (a.typeSoleil === ty ? 0 : 1) - (b.typeSoleil === ty ? 0 : 1)).slice(0, 3)
          .sort((a, b) => a.date.d - b.date.d);
        resume += '<p class="resume-type"><b>' + D.lune.icones[ty] + ' ' + ty + '</b>' +
          (l.length ? l.map(r => r.date.d + ' ' + MOIS_COURT[r.date.m - 1] + (r.typeSoleil === ty ? ' ✨' : '')).join(', ') : 'Aucun jour favorable') + '</p>';
      }
      c.innerHTML = '<h1>Calendrier lunaire</h1><p class="intro">Calendrier biodynamique (Maria Thun) calculé pour ' + esc(ville().nom) +
        '. Touchez un jour pour voir le détail.</p><p class="outils"><label class="choix-ville">Ville <select id="ville">' + Object.keys(D.villes).sort((a, b) => a.localeCompare(b, 'fr')).map(n => '<option' + (n === ville().nom ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label></p>' + nav.html + legende() +
        '<div class="lune-mise"><div class="grille">' + g + '</div><div><div class="panneau">' + detailJour(sel) +
        '</div><div class="panneau"><h2>Meilleurs jours du mois</h2>' + resume + '<p class="ligne">✨ = Lune et Soleil concordants</p><p><a class="bouton second" href="#meilleurs-jours">Détail</a></p></div></div></div>';
    }
    c.addEventListener('change', e => { if (e.target.id === 'ville') { stock.ecrire('ville', e.target.value); maj(); } });
    c.addEventListener('click', e => {
      if (nav.clic(e)) return;
      const b = e.target.closest('[data-j]');
      if (b) { etat.sel = +b.dataset.j; maj(); if (window.innerWidth < 900) c.querySelector('.panneau').scrollIntoView({ behavior: 'smooth' }); }
    });
    maj();
  };

  PAGES['meilleurs-jours'] = c => {
    const t = aujourdhui();
    const etat = { y: t.y, m: t.m };
    const nav = navMois(etat, maj);
    function maj() {
      const jours = moisLunaire(etat.y, etat.m);
      let h = '';
      for (const ty of TYPES) {
        const l = jours.filter(r => r.type === ty && L.estFavorable(r));
        h += '<section class="col-mj" style="border-top-color:' + D.lune.bords[ty] + '"><h2>' + D.lune.icones[ty] + ' ' + ty + '</h2><p class="compte">' + l.length + ' jour' + (l.length > 1 ? 's' : '') + ' favorable' + (l.length > 1 ? 's' : '') + '</p>' +
          (l.length ? l.map(r => '<div class="jour-mj' + (memeJour(r.date, t) ? ' auj' : '') + '"><div class="date">' + dateLongue(r.date) + (memeJour(r.date, t) ? ' 🔴' : '') + (r.typeSoleil === ty ? ' ✨' : '') +
            '</div><div class="det">' + esc(r.phase) + '</div><div class="det">🌙 ' + esc(r.constellation) + ' · ☀️ Soleil en ' + esc(r.constSoleil) + (r.typeSoleil === ty ? ' — effet renforcé !' : '') + '</div></div>').join('')
            : '<p class="vide">Aucun jour favorable ce mois-ci</p>') + '</section>';
      }
      c.innerHTML = '<h1>Meilleurs jours du mois</h1><p class="intro">Jours sans nœud lunaire, périgée, apogée, nouvelle ni pleine lune. ✨ = Lune et Soleil dans le même type (effet renforcé). 🔴 = aujourd’hui.</p>' +
        nav.html + '<div class="colonnes-mj">' + h + '</div><p class="astuce">💡 Combinez un jour favorable avec une météo clémente pour un meilleur résultat.</p>';
    }
    c.addEventListener('click', e => nav.clic(e));
    maj();
  };

  PAGES['fiches-lune'] = c => {
    const cats = Object.keys(D.fichesLunaires);
    let cat = cats[0], plante = null;
    const culture = {};
    for (const k of Object.keys(D.fichesCulture)) culture[sansAccent(k)] = [k, D.fichesCulture[k]];
    function majTout() {
      const C = D.fichesLunaires[cat];
      c.innerHTML = '<h1>Fiches plantes & calendrier lunaire</h1>' +
        '<div class="outils"><div class="pastilles">' + cats.map(k => '<button class="pastille" data-cat="' + esc(k) + '" aria-pressed="' + (k === cat) + '">' + D.fichesLunaires[k].emoji + ' ' + esc(k) + '</button>').join('') + '</div></div>' +
        '<div class="fiches-lune"><div><div class="liste-plantes">' + C.plantes.map((p, i) => '<button data-pl="' + i + '" aria-current="' + (plante === i) + '">' + p[2] + ' ' + esc(p[0]) + '</button>').join('') +
        '</div></div><div id="fiche"></div></div>';
      majFiche();
    }
    function majFiche() {
      const f = c.querySelector('#fiche');
      if (plante === null) { f.innerHTML = '<p class="vide">← Choisissez une plante pour voir sa fiche lunaire.</p>'; return; }
      const [nom, type, emoji, semis, conseil] = D.fichesLunaires[cat].plantes[plante];
      const cult = culture[sansAccent(nom)];
      let h = '<article class="fiche-lune"><div class="titre-plante"><span>' + emoji + '</span><h1>' + esc(nom) + '</h1></div>' +
        '<p><span class="badge-type" style="background:' + D.lune.couleurs[type] + ';border-color:' + D.lune.bords[type] + '">Type lunaire idéal : ' + D.lune.icones[type] + ' ' + esc(type) + '</span></p>' +
        '<p>📅 Semis : <b>' + esc(semis) + '</b></p><h3>💡 Conseil cultural</h3><p>' + esc(conseil) + '</p>';
      h += '<h2>Prochains jours idéaux (jours ' + esc(type) + ')</h2><div id="prochains"><p>⏳ Calcul en cours…</p></div>';
      if (cult) {
        const [, d] = cult;
        h += '<h2>Culture, maladies et traitements</h2><div class="culture">' +
          [['🌱 Conseils', d.conseils], ['🦠 Maladies', d.maladies], ['💊 Traitements', d.traitements]].filter(x => x[1] && x[1].length)
            .map(([t, l]) => '<div><h3>' + t + '</h3><ul>' + l.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>').join('') + '</div>';
      }
      f.innerHTML = h + '</article>';
      setTimeout(() => {
        const t = aujourdhui();
        const jours = L.prochainsJoursIdeaux(type, t, 60, 8);
        const p = f.querySelector('#prochains');
        if (!p) return;
        if (!jours.length) { p.innerHTML = '<p>Aucun jour favorable dans les 60 prochains jours.</p>'; return; }
        p.innerHTML = '<div class="prochains">' + jours.map(r => {
          const ecart = Math.round((Date.UTC(r.date.y, r.date.m - 1, r.date.d) - Date.UTC(t.y, t.m - 1, t.d)) / 86400000);
          const quand = ecart === 0 ? 'Aujourd’hui !' : ecart === 1 ? 'Demain' : 'Dans ' + ecart + ' jours';
          return '<div class="prochain" style="background:' + D.lune.couleurs[type] + ';border-color:' + D.lune.bords[type] + '"><b>' + dateLongue(r.date) + '</b><div class="quand">' + quand + '</div><div>' + [...r.phase][0] + ' 🌙 ' + esc(r.constellation) + '</div></div>';
        }).join('') + '</div><p class="astuce">Ces jours sont sans événement défavorable (nœud, périgée, apogée) et hors nouvelle et pleine lune.</p>';
      }, 30);
      if (window.innerWidth < 900) f.scrollIntoView({ behavior: 'smooth' });
    }
    c.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.cat) { cat = b.dataset.cat; plante = null; majTout(); }
      else if (b.dataset.pl !== undefined) {
        plante = +b.dataset.pl;
        c.querySelectorAll('[data-pl]').forEach(x => x.setAttribute('aria-current', String(+x.dataset.pl === plante)));
        majFiche();
      }
    });
    majTout();
  };

  /* ---------- Outils partagés par les modules ---------- */
  const deux = n => String(n).padStart(2, '0');
  const iso = j => j.y + '-' + deux(j.m) + '-' + deux(j.d);
  const deIso = s => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const dateFr = s => s ? s.split('-').reverse().join('/') : '';
  function nombre(v) { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.').replace(/\s/g, '')); return isNaN(n) ? null : n; }
  const euros = n => (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  function fenetre(html, large) {
    const f = document.createElement('div');
    f.className = 'plan-dialogue';
    f.innerHTML = '<div class="plan-boite' + (large ? ' large' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(f);
    const fermer = () => { f.remove(); document.removeEventListener('keydown', echap); };
    function echap(e) { if (e.key === 'Escape') fermer(); }
    document.addEventListener('keydown', echap);
    f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-annuler]')) fermer(); });
    window.addEventListener('hashchange', fermer, { once: true });
    const premier = f.querySelector('input, select, textarea, button'); if (premier) premier.focus();
    return { el: f, fermer };
  }
  function confirmer(texte, libelle, ok) {
    const w = fenetre('<p>' + esc(texte).replace(/\n/g, '<br>') + '</p><div class="pp-actions"><button class="bouton" data-ok>' + esc(libelle) + '</button><button class="bouton second" data-annuler>Annuler</button></div>');
    w.el.querySelector('[data-ok]').addEventListener('click', () => { w.fermer(); ok(); });
  }

  /* ---------- Démarrage ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude|anthropic/.test(location.hostname)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  (window.PapyExtensions || []).forEach(f => f({ PAGES, stock, esc, sansAccent, D, rendre, MOIS, MOIS_COURT, JOURS, cap, aujourdhui, memeJour, jourSemaine, dateLongue, iso, deIso, dateFr, nombre, euros, fenetre, confirmer, Lune: L }));
  try { if (!history.state || typeof history.state.n !== 'number') history.replaceState({ n: 0 }, ''); else niveau = history.state.n; } catch (e) { /* rien */ }
  rendre();
})();
