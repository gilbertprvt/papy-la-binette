/* Papy la Binette — Parterres fleuris : créer un parterre (forme + dimensions), puis y planter les fleurs du catalogue */
(function () {
  'use strict';
  window.PapyExtensions = window.PapyExtensions || [];
  window.PapyExtensions.push(function (app) {
    const { PAGES, stock, esc, sansAccent, D, nombre, fenetre, confirmer } = app;
    const CM = 100; // unités du dessin par mètre (1 unité = 1 cm)
    let uid = Date.now();
    const nouvelId = () => 'p' + (uid++).toString(36);
    const fmt = v => (Math.round(v * 100) / 100).toLocaleString('fr-FR');

    /* =====================================================================
       FORMES : chaque forme donne ses points (en mètres) et ses cotes
       ===================================================================== */
    function arc(cx, cy, rx, ry, a0, a1, n) {
      const p = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
      return p;
    }
    const FORMES = {
      rectangle: { nom: 'Rectangle', champs: [['longueur', 'Longueur (m)', 3], ['largeur', 'Largeur (m)', 1.2]],
        points: d => [[0, 0], [d.longueur, 0], [d.longueur, d.largeur], [0, d.largeur]] },
      carre: { nom: 'Carré', champs: [['cote', 'Côté (m)', 2]],
        points: d => [[0, 0], [d.cote, 0], [d.cote, d.cote], [0, d.cote]] },
      cercle: { nom: 'Cercle', champs: [['diametre', 'Diamètre (m)', 2]],
        points: d => arc(d.diametre / 2, d.diametre / 2, d.diametre / 2, d.diametre / 2, 0, 2 * Math.PI, 72).slice(0, -1), rond: true },
      ellipse: { nom: 'Ovale', champs: [['longueur', 'Longueur (m)', 3], ['largeur', 'Largeur (m)', 1.6]],
        points: d => arc(d.longueur / 2, d.largeur / 2, d.longueur / 2, d.largeur / 2, 0, 2 * Math.PI, 72).slice(0, -1), rond: true },
      demi: { nom: 'Demi-cercle', champs: [['diametre', 'Diamètre (m)', 3]],
        points: d => arc(d.diametre / 2, d.diametre / 2, d.diametre / 2, d.diametre / 2, Math.PI, 2 * Math.PI, 48) },
      arrondi: { nom: 'Bouts ronds', champs: [['longueur', 'Longueur (m)', 4], ['largeur', 'Largeur (m)', 1.2]],
        verifier: d => d.longueur > d.largeur ? '' : 'La longueur doit être plus grande que la largeur.',
        points: d => { const r = d.largeur / 2; return arc(d.longueur - r, r, r, r, -Math.PI / 2, Math.PI / 2, 24).concat(arc(r, r, r, r, Math.PI / 2, 3 * Math.PI / 2, 24)); } },
      triangle: { nom: 'Triangle', champs: [['base', 'Base (m)', 3], ['hauteur', 'Hauteur (m)', 2]],
        points: d => [[d.base / 2, 0], [d.base, d.hauteur], [0, d.hauteur]] },
      losange: { nom: 'Losange', champs: [['dh', 'Diagonale horizontale (m)', 3], ['dv', 'Diagonale verticale (m)', 2]],
        points: d => [[d.dh / 2, 0], [d.dh, d.dv / 2], [d.dh / 2, d.dv], [0, d.dv / 2]] },
      trapeze: { nom: 'Trapèze', champs: [['grande', 'Grande base (m)', 4], ['petite', 'Petite base (m)', 2], ['hauteur', 'Hauteur (m)', 1.5]],
        verifier: d => d.petite < d.grande ? '' : 'La petite base doit être plus courte que la grande.',
        points: d => [[(d.grande - d.petite) / 2, 0], [(d.grande + d.petite) / 2, 0], [d.grande, d.hauteur], [0, d.hauteur]] },
      equerre: { nom: 'En L', champs: [['longueur', 'Longueur (m)', 4], ['largeur', 'Hauteur (m)', 3], ['epaisseur', 'Épaisseur (m)', 1]],
        verifier: d => d.epaisseur < Math.min(d.longueur, d.largeur) ? '' : 'L’épaisseur doit être plus petite que la longueur et la hauteur.',
        points: d => [[0, 0], [d.epaisseur, 0], [d.epaisseur, d.largeur - d.epaisseur], [d.longueur, d.largeur - d.epaisseur], [d.longueur, d.largeur], [0, d.largeur]] },
      hexagone: { nom: 'Hexagone', champs: [['cote', 'Côté (m)', 1.2]],
        points: d => { const c = d.cote, h = Math.sqrt(3) * c; return [[c / 2, 0], [1.5 * c, 0], [2 * c, h / 2], [1.5 * c, h], [c / 2, h], [0, h / 2]]; } }
    };
    const COULEURS = [['#cfe3b4', 'Herbe'], ['#d9bf98', 'Terre'], ['#b98f68', 'Écorce'], ['#e4ded0', 'Gravier'], ['#a9c98a', 'Mousse'], ['#cdd2d8', 'Ardoise'], ['#f2d6de', 'Rose'], ['#efe2bf', 'Sable']];

    function geometrie(p) {
      const pts = FORMES[p.forme].points(p.dims);
      let s = 0, per = 0, w = 0, h = 0;
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        s += x1 * y2 - x2 * y1; per += Math.hypot(x2 - x1, y2 - y1);
        w = Math.max(w, x1); h = Math.max(h, y1);
      }
      return { pts, surface: Math.abs(s) / 2, perimetre: per, w, h };
    }
    function dedans(pts, x, y) {
      let ok = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
      }
      return ok;
    }
    const chemin = pts => 'M' + pts.map(([x, y]) => (x * CM).toFixed(1) + ',' + (y * CM).toFixed(1)).join('L') + 'Z';
    function dimsTexte(p) {
      const d = p.dims, f = FORMES[p.forme];
      return f.champs.map(([k, lib]) => lib.replace(' (m)', '').toLowerCase() + ' ' + fmt(d[k]) + ' m').join(' · ');
    }
    // cotes : largeur totale au-dessus, hauteur totale à gauche
    function cotes(p, g) {
      const W = g.w * CM, H = g.h * CM, e = Math.max(W, H) / 40;
      const fs = Math.max(W, H) / 16;
      const t = (x, y, s, rot) => '<text class="cote" x="' + x + '" y="' + y + '" font-size="' + fs.toFixed(1) + '" text-anchor="middle"' + (rot ? ' transform="rotate(-90 ' + x + ' ' + y + ')"' : '') + '>' + s + '</text>';
      let s = '<g class="cotes">';
      s += '<line x1="0" y1="' + (-e * 2) + '" x2="' + W + '" y2="' + (-e * 2) + '"/><line x1="0" y1="' + (-e * 3) + '" x2="0" y2="' + (-e) + '"/><line x1="' + W + '" y1="' + (-e * 3) + '" x2="' + W + '" y2="' + (-e) + '"/>';
      s += t(W / 2, -e * 2.6, fmt(g.w) + ' m');
      if (!FORMES[p.forme].rond || p.forme === 'ellipse') {
        s += '<line x1="' + (-e * 2) + '" y1="0" x2="' + (-e * 2) + '" y2="' + H + '"/><line x1="' + (-e * 3) + '" y1="0" x2="' + (-e) + '" y2="0"/><line x1="' + (-e * 3) + '" y1="' + H + '" x2="' + (-e) + '" y2="' + H + '"/>';
        s += t(-e * 2.6, H / 2, fmt(g.h) + ' m', true);
      }
      if (p.forme === 'equerre') s += t(p.dims.epaisseur * CM / 2, H / 2, 'ép. ' + fmt(p.dims.epaisseur) + ' m', true);
      if (p.forme === 'trapeze') s += t(W / 2, fs * 1.3, 'petite base ' + fmt(p.dims.petite) + ' m');
      return s + '</g>';
    }
    function cadre(g) {
      const W = g.w * CM, H = g.h * CM, m = Math.max(W, H) * 0.16 + 20;
      return (-m) + ' ' + (-m) + ' ' + (W + 2 * m) + ' ' + (H + 2 * m);
    }
    function miniature(p) {
      const g = geometrie(p), m = Math.max(g.w, g.h) * CM * 0.06;
      return '<svg viewBox="' + (-m) + ' ' + (-m) + ' ' + (g.w * CM + 2 * m) + ' ' + (g.h * CM + 2 * m) + '" aria-hidden="true"><path d="' + chemin(g.pts) + '" fill="' + p.couleur + '" stroke="#6b5a40" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
        (p.plantes || []).map(pl => { const f = fleur(pl.nom); return '<circle cx="' + pl.x * CM + '" cy="' + pl.y * CM + '" r="' + rayon(f) + '" fill="' + teinte(f) + '"/>'; }).join('') + '</svg>';
    }

    /* =====================================================================
       FLEURS : informations tirées du catalogue
       ===================================================================== */
    const FLEURS = {};
    for (const [cat, lignes] of Object.entries(D.fleurs.catalogue)) for (const r of lignes) FLEURS[r[0]] = { r, cat, img: D.fleurs.images[r[0]] };
    const fleur = nom => FLEURS[nom] || { r: [nom, '', 'Tout terrain', '', '', '', '', '30 cm', '', '', '', '', ''], cat: '', img: null };
    function plage(txt) {
      const t = (txt || '').replace(/,/g, '.');
      const nums = (t.match(/\d+(\.\d+)?/g) || []).map(Number);
      if (!nums.length) return null;
      const k = /\bm\b/.test(t) && !/cm/.test(t) ? 100 : 1;
      return [nums[0] * k, nums[nums.length - 1] * k];
    }
    function rayon(f) { const p = plage(f.r[7]) || [30, 30]; return Math.max(8, (p[0] + p[1]) / 4); } // demi-espacement moyen, en cm
    const TEINTES = [['blanc', '#f4f1e6'], ['crème', '#f3e7c4'], ['rose', '#e98ab0'], ['rouge', '#d23b3b'], ['jaune', '#f2c94c'], ['orange', '#ee8a35'], ['abricot', '#f2a66a'], ['violet', '#8d5bb8'], ['bleu', '#5b7fd1'], ['mauve', '#b98bd0'], ['lilas', '#c3a3dd'], ['lavande', '#a68fd3'], ['pourpre', '#8a2f6b'], ['bronze', '#a6743d']];
    function teinte(f) {
      const c = sansAccent(f.r[4] || '');
      for (const [k, v] of TEINTES) if (c.startsWith(sansAccent(k))) return v;
      for (const [k, v] of TEINTES) if (c.includes(sansAccent(k))) return v;
      return '#c9a3c8';
    }

    /* ---------- alertes : la fleur convient-elle à la situation ? ---------- */
    const EXPOS = ['Plein soleil', 'Mi-ombre', 'Ombre'];
    const SOLS = ['Ordinaire', 'Calcaire', 'Acide (terre de bruyère)', 'Sableux / sec', 'Argileux / humide'];
    const USAGES = ['Indifférent', 'Bordure', 'En massif', 'À couper (bouquets)', 'Couvre-sol', 'Grimpant'];
    const HAUTEURS = [['', 'Indifférente'], ['30', '30 cm'], ['50', '50 cm'], ['80', '80 cm'], ['120', '1,20 m']];
    function alertesFleur(nom, sit) {
      const f = fleur(nom), r = f.r, a = [];
      if (!FLEURS[nom]) return a;
      const rang = { 'Plein soleil': 2, 'Mi-ombre': 1, 'Ombre': 0 };
      const P = rang[r[3]], S = rang[sit.expo];
      if (P != null && S != null) {
        if (P - S >= 2) a.push(['🔴', 'a besoin de plein soleil, votre parterre est à l’ombre']);
        else if (P - S === 1) a.push(['🟠', 'demande ' + r[3].toLowerCase() + ' : la floraison sera moins abondante']);
        else if (S > P) a.push(['🟠', 'préfère ' + (P === 0 ? 'l’ombre' : 'la mi-ombre') + ', risque de brûlure au plein soleil']);
      }
      const nat = r[2], etat = r[1];
      if (/Acide/.test(nat)) { if (sit.sol === 'Calcaire') a.push(['🔴', 'demande un sol acide, il dépérira en sol calcaire']); else if (!/Acide/.test(sit.sol)) a.push(['🟠', 'préfère un sol acide : ajoutez de la terre de bruyère']); }
      if (/Calcaire/.test(nat) && /Acide/.test(sit.sol)) a.push(['🟠', 'préfère un sol calcaire']);
      if (/Argileux/.test(sit.sol) && /drainé/i.test(etat)) a.push([/Très/.test(etat) ? '🔴' : '🟠', 'craint l’humidité stagnante : drainez avec du sable ou du gravier']);
      if (/Sableux/.test(sit.sol) && /(frais|humide)/i.test(etat)) a.push(['🟠', 'a besoin d’un sol frais : paillez et arrosez en été']);
      const oui = v => v === 'Oui' || v === 'Léger';
      if (sit.usage === 'Bordure' && !oui(r[9])) a.push(['🟠', 'peu adaptée en bordure']);
      if (sit.usage === 'En massif' && !oui(r[11])) a.push(['🟠', 'peu adaptée en massif']);
      if (sit.usage === 'À couper (bouquets)' && !oui(r[10])) a.push(['🟠', 'peu adaptée aux bouquets']);
      if (sit.usage === 'Couvre-sol' && !/Couvre/.test(f.cat)) a.push(['🟠', 'n’est pas un couvre-sol']);
      if (sit.usage === 'Grimpant' && !/Grimpante/.test(f.cat)) a.push(['🟠', 'n’est pas une grimpante']);
      const hm = parseInt(sit.hmax, 10), hp = plage(r[6]);
      if (hm && hp) { if (hp[0] > hm) a.push(['🔴', 'mesure ' + r[6] + ', trop haute pour ' + hm + ' cm']); else if (hp[1] > hm) a.push(['🟠', 'peut atteindre ' + r[6]]); }
      return a;
    }

    /* ---------- données ---------- */
    const lire = () => stock.lire('parterres', []);
    const ecrire = l => stock.ecrire('parterres', l);

    /* =====================================================================
       PAGE « CRÉER UN PARTERRE »
       ===================================================================== */
    PAGES.parterres = c => {
      let msg = '';
      function liste() {
        const L = lire();
        let h = '<h1>Créer un parterre</h1><p class="intro">Choisissez une forme toute prête et donnez ses dimensions en mètres. Vous y planterez ensuite vos fleurs.</p>' +
          '<div class="outils"><button class="bouton" id="nouveau">➕ Nouveau parterre</button></div>' + (msg ? '<p class="message" role="status">' + msg + '</p>' : '');
        msg = '';
        if (!L.length) h += '<p class="vide">Vous n’avez pas encore de parterre. Créez le premier.</p>';
        else h += '<h2>Mes parterres</h2><div class="parterres">' + L.map(p => {
          const g = geometrie(p);
          return '<article class="carte-parterre"><div class="mini">' + miniature(p) + '</div><div class="cp-texte"><h3>' + esc(p.nom) + '</h3><p>' + FORMES[p.forme].nom + ' · ' + esc(dimsTexte(p)) + '</p><p><b>' + fmt(g.surface) + ' m²</b> · ' + (p.plantes || []).length + ' plante(s)</p>' +
            '<div class="pp-actions"><a class="bouton" href="#planter" data-planter="' + p.id + '">🌷 Planter</a><button class="bouton second" data-modif="' + p.id + '">✏️ Modifier</button><button class="bouton second danger" data-suppr="' + p.id + '">🗑</button></div></div></article>';
        }).join('') + '</div>';
        c.innerHTML = h;
      }
      function editeur(p) {
        const neuf = !p;
        p = p ? JSON.parse(JSON.stringify(p)) : { id: nouvelId(), nom: 'Parterre ' + (lire().length + 1), forme: 'rectangle', dims: {}, couleur: COULEURS[0][0], plantes: [], situation: { expo: 'Plein soleil', sol: 'Ordinaire', usage: 'Indifférent', hmax: '' } };
        function remplirDims() { for (const [k, , d] of FORMES[p.forme].champs) if (!(p.dims[k] > 0)) p.dims[k] = d; }
        remplirDims();
        function dessiner() {
          const f = FORMES[p.forme];
          c.innerHTML = '<h1>' + (neuf ? 'Nouveau parterre' : 'Modifier « ' + esc(p.nom) + ' »') + '</h1>' +
            '<div class="ed-mise"><div class="ed-reglages">' +
            '<h2>1. La forme</h2><div class="formes">' + Object.entries(FORMES).map(([k, x]) => {
              const d = {}; for (const [kk, , v] of x.champs) d[kk] = v;
              return '<button class="forme-btn" data-forme="' + k + '" aria-pressed="' + (k === p.forme) + '">' + miniature({ forme: k, dims: d, couleur: k === p.forme ? '#a9c98a' : '#e6ece0', plantes: [] }) + '<span>' + x.nom + '</span></button>';
            }).join('') + '</div>' +
            '<h2>2. Les dimensions</h2><div class="dims">' + f.champs.map(([k, lib]) => '<label class="pp-champ">' + lib + ' <input type="text" inputmode="decimal" autocomplete="off" data-dim="' + k + '" value="' + String(p.dims[k]).replace('.', ',') + '"></label>').join('') + '</div>' +
            '<p class="message" id="ed-msg" role="status"></p>' +
            '<h2>3. Le nom et la couleur</h2><label class="pp-champ">Nom <input type="text" id="ed-nom" maxlength="40" value="' + esc(p.nom) + '"></label>' +
            '<div class="couleurs" role="radiogroup" aria-label="Couleur du parterre">' + COULEURS.map(([v, n]) => '<button class="coul-btn" data-coul="' + v + '" aria-pressed="' + (v === p.couleur) + '" title="' + n + '"><i style="background:' + v + '"></i>' + n + '</button>').join('') + '</div>' +
            '<div class="pp-actions"><button class="bouton" id="ed-ok">💾 Enregistrer</button><button class="bouton second" id="ed-annuler">Annuler</button></div>' +
            '</div><div class="ed-apercu"><h2>Aperçu</h2><div id="apercu"></div></div></div>';
          majApercu();
        }
        function majApercu() {
          const z = c.querySelector('#apercu'); if (!z) return;
          const err = (FORMES[p.forme].verifier || (() => ''))(p.dims);
          c.querySelector('#ed-msg').textContent = err;
          if (err) return;
          const g = geometrie(p);
          z.innerHTML = '<svg class="apercu-parterre" viewBox="' + cadre(g) + '" role="img" aria-label="Aperçu du parterre"><path d="' + chemin(g.pts) + '" fill="' + p.couleur + '" stroke="#6b5a40" stroke-width="2" vector-effect="non-scaling-stroke"/>' + cotes(p, g) + '</svg>' +
            '<p class="mesures"><span>Surface <b>' + fmt(g.surface) + ' m²</b></span><span>Périmètre <b>' + fmt(g.perimetre) + ' m</b></span></p>';
        }
        c.onclick = e => {
          const fb = e.target.closest('[data-forme]');
          if (fb) { p.forme = fb.dataset.forme; p.dims = Object.assign({}, p.dims); for (const [k] of FORMES[p.forme].champs) if (!(p.dims[k] > 0)) delete p.dims[k]; remplirDims(); dessiner(); return; }
          const cb = e.target.closest('[data-coul]');
          if (cb) { p.couleur = cb.dataset.coul; c.querySelectorAll('[data-coul]').forEach(x => x.setAttribute('aria-pressed', String(x === cb))); majApercu(); return; }
          if (e.target.closest('#ed-annuler')) { c.oninput = null; c.onclick = clicListe; liste(); return; }
          if (e.target.closest('#ed-ok')) {
            for (const [k] of FORMES[p.forme].champs) if (!(p.dims[k] > 0 && p.dims[k] <= 50)) { c.querySelector('#ed-msg').textContent = 'Chaque dimension doit être comprise entre 0,1 et 50 m.'; return; }
            const err = (FORMES[p.forme].verifier || (() => ''))(p.dims);
            if (err) { c.querySelector('#ed-msg').textContent = err; return; }
            p.nom = c.querySelector('#ed-nom').value.trim() || 'Parterre';
            // ne garder que les dimensions de la forme choisie, et les plantes encore dans le parterre
            const d = {}; for (const [k] of FORMES[p.forme].champs) d[k] = p.dims[k]; p.dims = d;
            const g = geometrie(p);
            const avant = (p.plantes || []).length;
            p.plantes = (p.plantes || []).filter(pl => dedans(g.pts, pl.x, pl.y));
            const L = lire(); const i = L.findIndex(x => x.id === p.id);
            if (i >= 0) L[i] = p; else L.push(p);
            ecrire(L); stock.ecrire('parterre.actif', p.id);
            msg = 'Parterre « ' + esc(p.nom) + ' » enregistré.' + (avant > p.plantes.length ? ' ' + (avant - p.plantes.length) + ' plante(s) hors de la nouvelle forme ont été retirées.' : '') + ' <a href="#planter">Planter ce parterre</a>';
            c.onclick = null; c.oninput = null; liste(); c.onclick = clicListe;
          }
        };
        c.oninput = e => {
          if (e.target.dataset.dim) { const v = nombre(e.target.value); if (v > 0) { p.dims[e.target.dataset.dim] = v; majApercu(); } }
        };
        dessiner();
      }
      function clicListe(e) {
        if (e.target.closest('#nouveau')) { c.onclick = null; editeur(null); return; }
        const m = e.target.closest('[data-modif]'); if (m) { c.onclick = null; editeur(lire().find(x => x.id === m.dataset.modif)); return; }
        const pl = e.target.closest('[data-planter]'); if (pl) { stock.ecrire('parterre.actif', pl.dataset.planter); return; }
        const s = e.target.closest('[data-suppr]');
        if (s) { const p = lire().find(x => x.id === s.dataset.suppr); confirmer('Supprimer le parterre « ' + p.nom + ' » et ses ' + (p.plantes || []).length + ' plante(s) ?', 'Supprimer', () => { ecrire(lire().filter(x => x.id !== p.id)); liste(); }); }
      }
      c.onclick = clicListe;
      liste();
    };

    /* =====================================================================
       PAGE « PLANTER UN PARTERRE »
       ===================================================================== */
    PAGES.planter = c => {
      const L0 = lire();
      if (!L0.length) {
        c.innerHTML = '<h1>Planter un parterre</h1><p class="vide">Vous n’avez pas encore de parterre. <a href="#parterres">Créez-en un</a> d’abord : choisissez sa forme et ses dimensions.</p>';
        return;
      }
      let actif = stock.lire('parterre.actif', L0[0].id);
      if (!L0.some(p => p.id === actif)) actif = L0[0].id;
      let choixFleur = null, selPlante = null, cat = '', recherche = '';
      const parterre = () => lire().find(p => p.id === actif);
      function modifier(fn) { const L = lire(); const p = L.find(x => x.id === actif); fn(p); ecrire(L); }

      c.innerHTML = '<h1>Planter un parterre</h1>' +
        '<div class="plan-barre"><label class="plan-annee">Parterre <select id="pa-choix"></select></label><a class="bouton second" href="#parterres">✏️ Mes parterres</a><button class="bouton second" id="pa-effacer">🗑 Tout effacer</button></div>' +
        '<p class="plan-aide" id="pa-aide"></p>' +
        '<div class="pa-mise"><div class="pa-plan"><div class="plan-cadre"><svg id="pa-svg" class="plan-svg pa-svg" role="img" aria-label="Plan du parterre"></svg></div><div id="pa-sel"></div></div>' +
        '<aside class="pa-cata"><h2>🌱 Choisir une fleur</h2><div class="outils"><select id="pa-cat" aria-label="Catégorie"><option value="">Toutes</option>' + Object.keys(D.fleurs.catalogue).map(k => '<option>' + esc(k) + '</option>').join('') + '</select>' +
        '<input type="search" id="pa-q" placeholder="Rechercher…" aria-label="Rechercher une fleur"></div><div class="pa-liste" id="pa-liste"></div></aside>' +
        '<aside class="pa-infos" id="pa-infos"></aside></div>';
      const svg = c.querySelector('#pa-svg'), aide = c.querySelector('#pa-aide');

      function majChoix() {
        c.querySelector('#pa-choix').innerHTML = lire().map(p => '<option value="' + p.id + '"' + (p.id === actif ? ' selected' : '') + '>' + esc(p.nom) + ' (' + fmt(geometrie(p).surface) + ' m²)</option>').join('');
      }
      function majAide(t) {
        aide.textContent = t || (choixFleur ? 'Touchez le parterre pour planter « ' + choixFleur + ' ». Touchez une plante pour la déplacer ou la retirer.' : 'Choisissez une fleur dans la liste, puis touchez le parterre pour la planter.');
      }

      /* ----- catalogue ----- */
      function majListe() {
        const q = sansAccent(recherche.trim());
        let h = '';
        for (const [k, lignes] of Object.entries(D.fleurs.catalogue)) {
          if (cat && cat !== k) continue;
          const l = lignes.filter(r => !q || sansAccent(r.join(' ')).includes(q));
          if (!l.length) continue;
          h += '<h3>' + esc(k) + '</h3>' + l.map(r => {
            const f = FLEURS[r[0]];
            const al = alertesFleur(r[0], parterre().situation || {});
            return '<button class="pa-fleur" data-fleur="' + esc(r[0]) + '" aria-pressed="' + (r[0] === choixFleur) + '">' + (f.img ? '<img src="' + f.img + '" alt="" loading="lazy">' : '<span class="pa-pastille" style="background:' + teinte(f) + '"></span>') +
              '<span><b>' + esc(r[0]) + (al.some(x => x[0] === '🔴') ? ' 🔴' : al.length ? ' 🟠' : '') + '</b><small>↕ ' + esc(r[6]) + ' · ' + esc(r[3]) + ' · ' + esc(r[4]) + '</small></span></button>';
          }).join('');
        }
        c.querySelector('#pa-liste').innerHTML = h || '<p class="vide">Aucune fleur trouvée.</p>';
      }
      c.querySelector('#pa-cat').addEventListener('change', e => { cat = e.target.value; majListe(); });
      c.querySelector('#pa-q').addEventListener('input', e => { recherche = e.target.value; majListe(); });
      c.querySelector('#pa-liste').addEventListener('click', e => {
        const b = e.target.closest('[data-fleur]'); if (!b) return;
        choixFleur = choixFleur === b.dataset.fleur ? null : b.dataset.fleur;
        c.querySelectorAll('.pa-fleur').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.fleur === choixFleur)));
        majAide();
        if (choixFleur && window.innerWidth < 900) svg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      /* ----- dessin du parterre ----- */
      function dessiner() {
        const p = parterre(), g = geometrie(p);
        const W = g.w * CM, H = g.h * CM;
        svg.setAttribute('viewBox', cadre(g));
        const noms = [...new Set((p.plantes || []).map(x => x.nom))];
        let defs = '<clipPath id="pa-clip"><path d="' + chemin(g.pts) + '"/></clipPath>' + noms.map((n, i) => {
          const f = fleur(n);
          return f.img ? '<pattern id="pa-img-' + i + '" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="' + f.img + '" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/></pattern>' : '';
        }).join('');
        let s = '<defs>' + defs + '</defs><path d="' + chemin(g.pts) + '" fill="' + p.couleur + '"/>';
        // quadrillage tous les 50 cm, limité au parterre
        let q = '';
        for (let x = 50; x < W; x += 50) q += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + H + '"/>';
        for (let y = 50; y < H; y += 50) q += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '"/>';
        s += '<g class="pa-grille" clip-path="url(#pa-clip)">' + q + '</g><path d="' + chemin(g.pts) + '" fill="none" stroke="#6b5a40" stroke-width="2" vector-effect="non-scaling-stroke"/>' + cotes(p, g);
        for (const pl of (p.plantes || [])) {
          const f = fleur(pl.nom), r = rayon(f), i = noms.indexOf(pl.nom);
          const sel = pl.id === selPlante;
          s += '<g class="pa-plante' + (sel ? ' choisie' : '') + '" data-pl="' + pl.id + '"><title>' + esc(pl.nom) + '</title>' +
            '<circle cx="' + pl.x * CM + '" cy="' + pl.y * CM + '" r="' + r + '" fill="' + (f.img ? 'url(#pa-img-' + i + ')' : teinte(f)) + '" stroke="' + (sel ? '#f2a400' : teinte(f)) + '" stroke-width="' + (sel ? 4 : 3) + '" vector-effect="non-scaling-stroke"/></g>';
        }
        svg.innerHTML = s;
      }

      /* ----- panneau : plante choisie, situation, alertes, liste ----- */
      function majSelection() {
        const z = c.querySelector('#pa-sel');
        const pl = selPlante && (parterre().plantes || []).find(x => x.id === selPlante);
        if (!pl) { z.innerHTML = ''; return; }
        const f = fleur(pl.nom), al = alertesFleur(pl.nom, parterre().situation || {});
        z.innerHTML = '<div class="pa-choisie">' + (f.img ? '<img src="' + f.img + '" alt="">' : '') + '<div><b>' + esc(pl.nom) + '</b><small>↕ ' + esc(f.r[6]) + ' · espacement ' + esc(f.r[7]) + ' · floraison ' + esc(f.r[5]) + '</small>' +
          al.map(x => '<small>' + x[0] + ' ' + esc(x[1]) + '</small>').join('') + '</div><button class="bouton second danger" id="pa-retirer">Retirer</button></div>';
      }
      function majInfos() {
        const p = parterre(), sit = p.situation || {}, g = geometrie(p);
        const sel = (id, opts, val) => '<select data-sit="' + id + '">' + opts.map(o => { const [v, t] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (v === (val || '') ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
        const compte = {};
        for (const pl of (p.plantes || [])) compte[pl.nom] = (compte[pl.nom] || 0) + 1;
        const noms = Object.keys(compte).sort((a, b) => a.localeCompare(b, 'fr'));
        const alertes = noms.map(n => [n, alertesFleur(n, sit)]).filter(x => x[1].length);
        // floraison : mois couverts par les fleurs du parterre
        c.querySelector('#pa-infos').innerHTML =
          '<section class="panneau-plan"><h2>🌍 Votre situation</h2><p class="m-sous">Les alertes comparent ces conditions avec le catalogue.</p>' +
          '<label class="pp-champ">☀️ Exposition ' + sel('expo', EXPOS, sit.expo) + '</label>' +
          '<label class="pp-champ">🪨 Nature du sol ' + sel('sol', SOLS, sit.sol) + '</label>' +
          '<label class="pp-champ">🌿 Usage souhaité ' + sel('usage', USAGES, sit.usage) + '</label>' +
          '<label class="pp-champ">📏 Hauteur maximale ' + sel('hmax', HAUTEURS, sit.hmax) + '</label>' +
          (alertes.length ? '<div class="pp-alerte"><b>⚠️ À surveiller</b>' + alertes.map(([n, a]) => '<p><b>' + esc(n) + '</b> : ' + a.map(x => x[0] + ' ' + esc(x[1])).join(' ; ') + '</p>').join('') + '</div>'
            : (noms.length ? '<div class="pp-ok"><b>✅ Toutes les fleurs conviennent à cette situation.</b></div>' : '')) + '</section>' +
          '<section class="panneau-plan"><h2>🗒 Plantes placées</h2><p class="m-sous">' + esc(p.nom) + ' · ' + fmt(g.surface) + ' m² · ' + (p.plantes || []).length + ' plante(s)</p>' +
          (noms.length ? '<ul class="pa-compte">' + noms.map(n => { const f = fleur(n); return '<li>' + (f.img ? '<img src="' + f.img + '" alt="">' : '<span class="pa-pastille" style="background:' + teinte(f) + '"></span>') + '<span>' + esc(n) + '</span><b>× ' + compte[n] + '</b></li>'; }).join('') + '</ul>' : '<p class="pp-vide">Aucune plante pour l’instant.</p>') + '</section>';
      }
      c.querySelector('#pa-infos').addEventListener('change', e => {
        const k = e.target.dataset.sit; if (!k) return;
        modifier(p => { p.situation = Object.assign({}, p.situation, { [k]: e.target.value }); });
        majInfos(); majListe(); majSelection();
      });
      c.querySelector('#pa-sel').addEventListener('click', e => {
        if (e.target.closest('#pa-retirer')) { modifier(p => { p.plantes = p.plantes.filter(x => x.id !== selPlante); }); selPlante = null; tout(); }
      });

      /* ----- souris / doigt ----- */
      function point(ev) {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const q = pt.matrixTransform(svg.getScreenCTM().inverse());
        return { x: q.x / CM, y: q.y / CM };
      }
      let geste = null;
      svg.addEventListener('pointerdown', ev => {
        if (ev.button !== undefined && ev.button !== 0) return;
        const pos = point(ev), g = geometrie(parterre());
        const gp = ev.target.closest('[data-pl]');
        if (gp) {
          selPlante = gp.dataset.pl;
          const pl = parterre().plantes.find(x => x.id === selPlante);
          geste = { id: selPlante, dx: pos.x - pl.x, dy: pos.y - pl.y };
          dessiner(); majSelection();
        } else if (choixFleur) {
          if (!dedans(g.pts, pos.x, pos.y)) { majAide('Touchez à l’intérieur du parterre pour planter.'); setTimeout(() => majAide(), 2500); return; }
          const pl = { id: nouvelId(), nom: choixFleur, x: +pos.x.toFixed(3), y: +pos.y.toFixed(3) };
          modifier(p => { p.plantes = (p.plantes || []).concat([pl]); });
          selPlante = pl.id; geste = { id: pl.id, dx: 0, dy: 0 };
          dessiner(); majSelection(); majInfos();
        } else { selPlante = null; dessiner(); majSelection(); return; }
        svg.setPointerCapture(ev.pointerId); ev.preventDefault();
      });
      svg.addEventListener('pointermove', ev => {
        if (!geste) return;
        const pos = point(ev), g = geometrie(parterre());
        const x = pos.x - geste.dx, y = pos.y - geste.dy;
        if (!dedans(g.pts, x, y)) return;
        const L = lire(), p = L.find(z => z.id === actif), pl = p.plantes.find(z => z.id === geste.id);
        pl.x = +x.toFixed(3); pl.y = +y.toFixed(3);
        geste.L = L;
        const cercle = svg.querySelector('[data-pl="' + pl.id + '"] circle');
        if (cercle) { cercle.setAttribute('cx', pl.x * CM); cercle.setAttribute('cy', pl.y * CM); }
      });
      function fin() { if (geste && geste.L) ecrire(geste.L); geste = null; }
      svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
      c.addEventListener('keydown', e => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selPlante && !e.target.matches('input, textarea')) { modifier(p => { p.plantes = p.plantes.filter(x => x.id !== selPlante); }); selPlante = null; tout(); }
      });

      c.querySelector('#pa-choix').addEventListener('change', e => { actif = e.target.value; stock.ecrire('parterre.actif', actif); selPlante = null; tout(); });
      c.querySelector('#pa-effacer').addEventListener('click', () => {
        const p = parterre();
        if (!(p.plantes || []).length) return;
        confirmer('Retirer les ' + p.plantes.length + ' plante(s) du parterre « ' + p.nom + ' » ?', 'Tout effacer', () => { modifier(x => { x.plantes = []; }); selPlante = null; tout(); });
      });
      function tout() { majChoix(); dessiner(); majSelection(); majInfos(); majListe(); majAide(); }
      tout();
    };
  });
})();
