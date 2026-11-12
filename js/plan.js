/* Papy la Binette — Plan du jardin (version simplifiée de l'implantation)
   Un plan quadrillé par année : on trace des rectangles (planches, allées, abri…),
   on choisit les plantes de chaque planche, le site signale les mauvais voisinages
   et rappelle ce qui poussait au même endroit l'année précédente. */
(function () {
  'use strict';
  window.PapyExtensions = window.PapyExtensions || [];
  window.PapyExtensions.push(function (app) {
    const { PAGES, stock, esc, sansAccent, D } = app;
    const CELL = 40; // unités SVG par case

    const TYPES = {
      planche:    { nom: 'Planche',    ico: '🌱', fond: '#b8854f', bord: '#6b4320', texte: '#2a1a08', culture: true },
      allee:      { nom: 'Allée',      ico: '👣', fond: '#e6dcc4', bord: '#a8997a', texte: '#4a3f2a' },
      serre:      { nom: 'Serre',      ico: '🪟', fond: '#bfe3f2', bord: '#4d93b3', texte: '#14384a', culture: true },
      abri:       { nom: 'Abri',       ico: '🏠', fond: '#d9785a', bord: '#8a3a22', texte: '#3a1407' },
      arbre:      { nom: 'Arbre',      ico: '🌳', fond: '#86c06a', bord: '#3f7a2b', texte: '#173a0d', rond: true },
      composteur: { nom: 'Composteur', ico: '♻️', fond: '#b3a855', bord: '#6b6320', texte: '#2e2a07' },
      bassin:     { nom: 'Point d’eau', ico: '💧', fond: '#6ab8e0', bord: '#2a6f96', texte: '#0b2a3d', rond: true },
      autre:      { nom: 'Autre',      ico: '📦', fond: '#cfc9d8', bord: '#7a7090', texte: '#2a2438' }
    };

    /* ---------- Plantes : catalogue, familles, associations ---------- */
    const FAMILLES = {}; // nom de plante -> famille (catégorie du catalogue)
    const GROUPES = [];   // pour la liste de choix
    for (const [cat, lignes] of Object.entries(D.plantes.catalogue)) {
      const noms = lignes.map(r => r[0]);
      GROUPES.push([cat, noms]);
      for (const n of noms) FAMILLES[n] = cat;
    }
    const fruits = [...new Set(Object.values(D.fruits.catalogue).flat().map(r => r[0]))];
    GROUPES.push(['🍓 Petits fruits', fruits]);
    const EMOJI = {};
    for (const c of Object.values(D.fichesLunaires)) for (const p of c.plantes) EMOJI[p[0]] = p[2];
    function emoji(n) {
      if (EMOJI[n]) return EMOJI[n];
      const f = FAMILLES[n];
      return f ? [...f][0] : (fruits.includes(n) ? '🍓' : '🌿');
    }
    function fiche(n) {
      if (D.associations[n]) return [n, D.associations[n]];
      const base = n.split(/[\s-]/)[0];
      if (D.associations[base]) return [base, D.associations[base]];
      return [n, null];
    }
    function memePlante(a, b) { return a === b || fiche(a)[0] === fiche(b)[0]; }
    // renvoie la raison si a et b se gênent, sinon null
    function incompatibles(a, b) {
      const [, fa] = fiche(a), [, fb] = fiche(b);
      if (fa) for (const [p, r] of fa.mauvaises) if (memePlante(p, b)) return r;
      if (fb) for (const [p, r] of fb.mauvaises) if (memePlante(p, a)) return r;
      return null;
    }
    function amies(a, b) {
      const [, fa] = fiche(a), [, fb] = fiche(b);
      if (fa) for (const [p, r] of fa.bonnes) if (memePlante(p, b)) return r;
      if (fb) for (const [p, r] of fb.bonnes) if (memePlante(p, a)) return r;
      return null;
    }

    /* ---------- Données ---------- */
    function lire() { return stock.lire('plan', null); }
    function ecrire(p) { stock.ecrire('plan', p); }
    let uid = Date.now();
    const nouvelId = () => 'e' + (uid++).toString(36);
    const fmt = v => (Math.round(v * 100) / 100).toLocaleString('fr-FR');

    function chevauche(a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; }
    function touche(a, b) {
      const horiz = (a.x + a.w === b.x || b.x + b.w === a.x) && a.y < b.y + b.h && b.y < a.y + a.h;
      const vert = (a.y + a.h === b.y || b.y + b.h === a.y) && a.x < b.x + b.w && b.x < a.x + a.w;
      return horiz || vert;
    }

    /* ---------- Page ---------- */
    PAGES.plan = c => {
      let plan = lire();
      if (!plan) return pageCreation(c);
      let annee = String(stock.lire('plan.annee', '')) ;
      if (!plan.annees[annee]) annee = Object.keys(plan.annees).sort().pop();
      let outil = 'choisir';
      let selId = null;

      const elems = () => plan.annees[annee].elements;
      const anneePrec = () => {
        const ks = Object.keys(plan.annees).sort();
        const i = ks.indexOf(annee);
        return i > 0 ? plan.annees[ks[i - 1]] : null;
      };
      const sauver = () => ecrire(plan);
      const pas = () => plan.pas; // mètres par case

      c.innerHTML =
        '<h1>Plan du jardin</h1>' +
        '<div class="plan-barre">' +
          '<label class="plan-annee">Année <select id="annee"></select></label>' +
          '<button class="bouton second" id="nouvelle-annee"></button>' +
          '<button class="bouton second" id="dimensions">📐 Dimensions</button>' +
        '</div>' +
        '<div class="outils plan-outils" role="toolbar" aria-label="Outils de dessin">' +
          '<button class="pastille" data-outil="choisir">👆 Choisir / déplacer</button>' +
          Object.entries(TYPES).map(([k, t]) => '<button class="pastille" data-outil="' + k + '"><i class="pastille-coul" style="background:' + t.fond + ';border-color:' + t.bord + '"></i>' + t.ico + ' ' + t.nom + '</button>').join('') +
        '</div>' +
        '<p class="plan-aide" id="aide"></p>' +
        '<div class="plan-mise"><div class="plan-cadre"><svg id="svg" class="plan-svg" role="img" aria-label="Plan du jardin"></svg></div><aside class="panneau-plan" id="panneau"></aside></div>' +
        '<div class="plan-dialogue" id="dlg" hidden></div>';

      const svg = c.querySelector('#svg');
      const panneau = c.querySelector('#panneau');
      const aide = c.querySelector('#aide');

      /* ----- barre des années ----- */
      function majAnnees() {
        const ks = Object.keys(plan.annees).sort();
        c.querySelector('#annee').innerHTML = ks.map(k => '<option' + (k === annee ? ' selected' : '') + '>' + k + '</option>').join('');
        const prochaine = String(+ks[ks.length - 1] + 1);
        c.querySelector('#nouvelle-annee').textContent = '➕ Préparer ' + prochaine;
        c.querySelector('#nouvelle-annee').dataset.annee = prochaine;
      }
      c.querySelector('#annee').addEventListener('change', e => { annee = e.target.value; stock.ecrire('plan.annee', annee); selId = null; tout(); });
      c.querySelector('#nouvelle-annee').addEventListener('click', e => {
        const na = e.currentTarget.dataset.annee;
        const derniere = plan.annees[Object.keys(plan.annees).sort().pop()];
        plan.annees[na] = {
          elements: derniere.elements.map(el => Object.assign({}, el, {
            plantes: [], notes: TYPES[el.type].culture ? '' : (el.notes || '')
          }))
        };
        annee = na; stock.ecrire('plan.annee', annee); selId = null; sauver(); tout();
        message('Plan ' + na + ' préparé : même disposition, planches vides. Sur chaque planche, le site vous rappelle ce qui y poussait en ' + (na - 1) + '.');
      });
      c.querySelector('#dimensions').addEventListener('click', () => dialogueDimensions());

      /* ----- outils ----- */
      function majOutils() {
        c.querySelectorAll('[data-outil]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.outil === outil)));
        aide.textContent = outil === 'choisir'
          ? 'Touchez un élément pour le modifier. Faites-le glisser pour le déplacer, ou tirez sa poignée ronde pour l’agrandir.'
          : 'Tracez ' + (outil === 'allee' ? 'l’allée' : 'un rectangle') + ' sur la grille en faisant glisser le doigt ou la souris (1 case = ' + fmt(pas()) + ' m).';
        svg.classList.toggle('en-dessin', outil !== 'choisir');
      }
      c.querySelector('.plan-outils').addEventListener('click', e => {
        const b = e.target.closest('[data-outil]');
        if (b) { outil = b.dataset.outil; majOutils(); }
      });

      /* ----- dessin du plan ----- */
      function dessiner(apercu) {
        const W = plan.largeur, H = plan.longueur;
        const marge = 26;
        svg.setAttribute('viewBox', (-marge) + ' ' + (-marge) + ' ' + (W * CELL + marge + 16) + ' ' + (H * CELL + marge + 16));
        let s = '<rect class="sol" x="0" y="0" width="' + W * CELL + '" height="' + H * CELL + '"/>';
        let lignes = '';
        for (let i = 0; i <= W; i++) lignes += '<line x1="' + i * CELL + '" y1="0" x2="' + i * CELL + '" y2="' + H * CELL + '"/>';
        for (let j = 0; j <= H; j++) lignes += '<line x1="0" y1="' + j * CELL + '" x2="' + W * CELL + '" y2="' + j * CELL + '"/>';
        s += '<g class="grille-plan">' + lignes + '</g>';
        // repères en mètres
        const tous = Math.max(1, Math.round(1 / pas()));
        const saut = W / tous > 24 ? tous * 5 : (W / tous > 12 ? tous * 2 : tous);
        let rep = '';
        for (let i = 0; i <= W; i += saut) rep += '<text x="' + i * CELL + '" y="-8" text-anchor="middle">' + fmt(i * pas()) + '</text>';
        for (let j = 0; j <= H; j += saut) rep += '<text x="-6" y="' + (j * CELL + 4) + '" text-anchor="end">' + fmt(j * pas()) + '</text>';
        s += '<g class="reperes">' + rep + '</g>';
        const prec = anneePrec();
        // l'élément choisi est dessiné en dernier pour que sa poignée reste au-dessus
        const ordre = elems().filter(e => e.id !== selId).concat(elems().filter(e => e.id === selId));
        for (const el of ordre) {
          const t = TYPES[el.type];
          const x = el.x * CELL, y = el.y * CELL, w = el.w * CELL, h = el.h * CELL;
          const sel = el.id === selId;
          const alerte = TYPES[el.type].culture && alertes(el).length > 0;
          s += '<g class="elem' + (sel ? ' choisi' : '') + '" data-id="' + el.id + '">';
          s += t.rond
            ? '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="' + Math.min(w, h) / 2 + '" fill="' + t.fond + '" stroke="' + t.bord + '"/>'
            : '<rect x="' + (x + 2) + '" y="' + (y + 2) + '" width="' + (w - 4) + '" height="' + (h - 4) + '" rx="5" fill="' + t.fond + '" stroke="' + t.bord + '"' + (el.type === 'allee' ? ' stroke-dasharray="6 5"' : '') + '/>';
          const plantes = el.plantes || [];
          // taille du nom adaptée à la place disponible, sans couper les mots
          // parcelle en hauteur (au moins 1,5 fois plus haute que large) : le nom s'écrit verticalement
          const verticale = !t.rond && h >= 1.5 * w && h >= 2 * CELL;
          const lg = verticale ? h : w, ht = verticale ? w : h; // longueur et hauteur « de lecture »
          const petite = lg < 2.5 * CELL || ht < 1.5 * CELL;
          const place = (t.rond ? 0.78 : 1) * (lg - 12);
          const plusLong = Math.max(...el.nom.split(/\s+/).map(m => m.length), 3) + (petite ? 0 : 2);
          const etroite = lg < 2.5 * CELL;
          const taille = Math.max(9, Math.min(petite ? 15 : 19, place / (plusLong * 0.62), (ht - 10) * (etroite ? 0.3 : 0.55)));
          let texte = '<div class="etq-nom" style="font-size:' + taille.toFixed(1) + 'px">' + (etroite ? '<span class="etq-ico">' + t.ico + '</span>' : t.ico + ' ') + esc(el.nom) + (alerte ? ' ⚠️' : '') + '</div>';
          if (plantes.length) texte += '<div class="etq-plantes">' + plantes.map(p => emoji(p) + ' ' + esc(p)).join(', ') + '</div>';
          else if (t.culture && prec) {
            const av = prec.elements.find(e => e.id === el.id);
            if (av && av.plantes && av.plantes.length) texte += '<div class="etq-avant">l’an dernier : ' + av.plantes.map(esc).join(', ') + '</div>';
          }
          if (verticale) {
            // texte vertical en SVG natif (tourné d'un quart de tour autour du centre) : fiable dans tous les navigateurs, Safari compris
            const cx = x + w / 2, cy = y + h / 2;
            const tp = Math.max(9, Math.min(15, taille * 0.8));
            let ligne2 = '';
            if (plantes.length) ligne2 = plantes.join(', ');
            else if (t.culture && prec) {
              const av = prec.elements.find(e => e.id === el.id);
              if (av && av.plantes && av.plantes.length) ligne2 = 'l’an dernier : ' + av.plantes.join(', ');
            }
            const maxCar = Math.floor((h - 16) / (tp * 0.55));
            if (ligne2.length > maxCar) ligne2 = ligne2.slice(0, Math.max(1, maxCar - 1)) + '…';
            const deux = ligne2 && ht >= taille + tp + 8;
            const dy1 = deux ? -(tp * 0.6) : 0, dy2 = taille * 0.6;
            s += '<g class="etq-svg" transform="rotate(-90 ' + cx + ' ' + cy + ')" fill="' + t.texte + '">' +
              '<text x="' + cx + '" y="' + (cy + dy1) + '" text-anchor="middle" dominant-baseline="central" font-size="' + taille.toFixed(1) + '" font-weight="700">' + t.ico + ' ' + esc(el.nom) + (alerte ? ' ⚠️' : '') + '</text>' +
              (deux ? '<text x="' + cx + '" y="' + (cy + dy2) + '" text-anchor="middle" dominant-baseline="central" font-size="' + tp.toFixed(1) + '"' + (plantes.length ? '' : ' font-style="italic"') + '>' + esc(ligne2) + '</text>' : '') +
              '</g>';
          } else {
            s += '<foreignObject x="' + (x + 4) + '" y="' + (y + 4) + '" width="' + Math.max(0, w - 8) + '" height="' + Math.max(0, h - 8) + '"><div xmlns="http://www.w3.org/1999/xhtml" class="etq' + (petite ? ' petite' : '') + '" style="color:' + t.texte + '">' + texte + '</div></foreignObject>';
          }
          if (sel && outil === 'choisir') s += '<circle class="poignee" data-poignee="' + el.id + '" cx="' + (x + w - 2) + '" cy="' + (y + h - 2) + '" r="11"/>';
          s += '</g>';
        }
        if (apercu) {
          const ok = apercu.ok;
          s += '<rect class="apercu' + (ok ? '' : ' refuse') + '" x="' + apercu.x * CELL + '" y="' + apercu.y * CELL + '" width="' + apercu.w * CELL + '" height="' + apercu.h * CELL + '" rx="5"/>';
          s += '<text class="apercu-taille" x="' + (apercu.x + apercu.w) * CELL + '" y="' + (apercu.y * CELL - 6) + '" text-anchor="end">' + fmt(apercu.w * pas()) + ' × ' + fmt(apercu.h * pas()) + ' m</text>';
        }
        svg.innerHTML = s;
      }

      /* ----- conversion position → case ----- */
      function caseDe(ev) {
        const pt = svg.createSVGPoint();
        pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        return { fx: p.x / CELL, fy: p.y / CELL };
      }
      const borne = (v, a, b) => Math.max(a, Math.min(b, v));
      function libre(r, sauf) {
        if (r.x < 0 || r.y < 0 || r.x + r.w > plan.largeur || r.y + r.h > plan.longueur || r.w < 1 || r.h < 1) return false;
        return !elems().some(e => e.id !== sauf && chevauche(e, r));
      }

      /* ----- interactions souris / doigt ----- */
      let geste = null;
      svg.addEventListener('pointerdown', ev => {
        if (ev.button !== undefined && ev.button !== 0) return;
        const { fx, fy } = caseDe(ev);
        const poignee = ev.target.closest('[data-poignee]');
        const g = ev.target.closest('.elem');
        if (outil === 'choisir') {
          if (poignee) {
            const el = elems().find(e => e.id === poignee.dataset.poignee);
            geste = { mode: 'taille', el, orig: Object.assign({}, el) };
          } else if (g) {
            const el = elems().find(e => e.id === g.dataset.id);
            selId = el.id;
            geste = { mode: 'deplacer', el, orig: Object.assign({}, el), dx: fx - el.x, dy: fy - el.y, bouge: false };
            dessiner(); majPanneau();
          } else {
            selId = null; dessiner(); majPanneau(); return;
          }
        } else {
          const cx = Math.floor(fx), cy = Math.floor(fy);
          if (cx < 0 || cy < 0 || cx >= plan.largeur || cy >= plan.longueur) return;
          geste = { mode: 'tracer', x0: cx, y0: cy, r: { x: cx, y: cy, w: 1, h: 1 } };
          geste.r.ok = libre(geste.r);
          dessiner(geste.r);
        }
        svg.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      });
      svg.addEventListener('pointermove', ev => {
        if (!geste) return;
        const { fx, fy } = caseDe(ev);
        if (geste.mode === 'tracer') {
          const cx = borne(Math.floor(fx), 0, plan.largeur - 1), cy = borne(Math.floor(fy), 0, plan.longueur - 1);
          const r = { x: Math.min(cx, geste.x0), y: Math.min(cy, geste.y0), w: Math.abs(cx - geste.x0) + 1, h: Math.abs(cy - geste.y0) + 1 };
          r.ok = libre(r); geste.r = r; dessiner(r);
        } else if (geste.mode === 'deplacer') {
          const nx = Math.round(fx - geste.dx), ny = Math.round(fy - geste.dy);
          if (nx === geste.el.x && ny === geste.el.y) return;
          const r = { x: nx, y: ny, w: geste.el.w, h: geste.el.h };
          if (libre(r, geste.el.id)) { geste.el.x = nx; geste.el.y = ny; geste.bouge = true; dessiner(); }
        } else if (geste.mode === 'taille') {
          const el = geste.el;
          const r = { x: el.x, y: el.y, w: Math.max(1, Math.round(fx - el.x)), h: Math.max(1, Math.round(fy - el.y)) };
          if ((r.w !== el.w || r.h !== el.h) && libre(r, el.id)) { el.w = r.w; el.h = r.h; dessiner(); majPanneau(); }
        }
      });
      function finGeste() {
        if (!geste) return;
        const g = geste; geste = null;
        if (g.mode === 'tracer') {
          if (g.r.ok) {
            const t = TYPES[outil];
            const n = elems().filter(e => e.type === outil).length + 1;
            const el = { id: nouvelId(), type: outil, nom: t.nom + (outil === 'planche' || outil === 'autre' ? ' ' + n : (n > 1 ? ' ' + n : '')), x: g.r.x, y: g.r.y, w: g.r.w, h: g.r.h, plantes: [], notes: '' };
            elems().push(el);
            selId = el.id; outil = 'choisir'; majOutils(); sauver();
          } else message('Cet emplacement est déjà occupé. Tracez dans une zone libre.');
        } else sauver();
        dessiner(); majPanneau();
      }
      svg.addEventListener('pointerup', finGeste);
      svg.addEventListener('pointercancel', finGeste);

      /* ----- alertes d'associations ----- */
      function alertes(el) {
        const res = [];
        const pl = el.plantes || [];
        for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
          const r = incompatibles(pl[i], pl[j]);
          if (r) res.push({ a: pl[i], b: pl[j], r, ou: 'dans cette planche' });
        }
        for (const v of elems()) {
          if (v.id === el.id || !touche(el, v) || !(v.plantes || []).length) continue;
          for (const a of pl) for (const b of v.plantes) {
            const r = incompatibles(a, b);
            if (r) res.push({ a, b, r, ou: 'avec « ' + v.nom + ' » juste à côté' });
          }
        }
        return res;
      }
      function bonnesNouvelles(el) {
        const res = [];
        const pl = el.plantes || [];
        for (let i = 0; i < pl.length; i++) for (let j = i + 1; j < pl.length; j++) {
          const r = amies(pl[i], pl[j]);
          if (r) res.push({ a: pl[i], b: pl[j], r });
        }
        return res;
      }
      function rotation(el) {
        const prec = anneePrec();
        if (!prec) return null;
        const av = prec.elements.find(e => e.id === el.id);
        if (!av || !(av.plantes || []).length) return null;
        const familles = new Set(av.plantes.map(p => FAMILLES[p]).filter(Boolean));
        const repetees = (el.plantes || []).filter(p => FAMILLES[p] && familles.has(FAMILLES[p]));
        return { avant: av.plantes, repetees };
      }

      /* ----- panneau de droite ----- */
      function optionsPlantes() {
        return '<option value="">Choisir une plante…</option>' + GROUPES.map(([g, noms]) =>
          '<optgroup label="' + esc(g) + '">' + noms.map(n => '<option>' + esc(n) + '</option>').join('') + '</optgroup>').join('') +
          '<option value="__autre">Autre (saisir le nom)…</option>';
      }
      function majPanneau() {
        const el = elems().find(e => e.id === selId);
        if (!el) { panneau.innerHTML = resume(); return; }
        const t = TYPES[el.type];
        const surf = el.w * el.h * pas() * pas();
        let h = '<div class="pp-tete"><h2>' + t.ico + ' ' + esc(el.nom) + '</h2><button class="fermer" id="pp-fermer" aria-label="Fermer">✕</button></div>' +
          '<p class="pp-taille">' + fmt(el.w * pas()) + ' m × ' + fmt(el.h * pas()) + ' m = <b>' + fmt(surf) + ' m²</b></p>' +
          '<label class="pp-champ">Nom <input type="text" id="pp-nom" value="' + esc(el.nom) + '" maxlength="40"></label>' +
          '<label class="pp-champ">Type <select id="pp-type">' + Object.entries(TYPES).map(([k, x]) => '<option value="' + k + '"' + (k === el.type ? ' selected' : '') + '>' + x.ico + ' ' + x.nom + '</option>').join('') + '</select></label>';
        if (t.culture) {
          const pl = el.plantes || [];
          h += '<h3>Plantes ' + esc(annee) + '</h3>' +
            (pl.length ? '<ul class="pp-plantes">' + pl.map((p, i) => '<li>' + emoji(p) + ' ' + esc(p) + ' <button class="retirer" data-retirer="' + i + '" aria-label="Retirer ' + esc(p) + '">✕</button></li>').join('') + '</ul>' : '<p class="pp-vide">Aucune plante pour l’instant.</p>') +
            '<div class="pp-ajout"><select id="pp-plante" aria-label="Plante à ajouter">' + optionsPlantes() + '</select></div>';
          const al = alertes(el);
          if (al.length) h += '<div class="pp-alerte"><b>⚠️ Association déconseillée</b>' + al.map(x => '<p>' + esc(x.a) + ' et ' + esc(x.b) + ' (' + esc(x.ou) + ') : ' + esc(x.r) + '</p>').join('') + '</div>';
          const bn = bonnesNouvelles(el);
          if (bn.length) h += '<div class="pp-ok"><b>✅ Bonnes associations</b>' + bn.map(x => '<p>' + esc(x.a) + ' et ' + esc(x.b) + ' : ' + esc(x.r) + '</p>').join('') + '</div>';
          const ro = rotation(el);
          if (ro) {
            h += '<div class="pp-rotation"><b>🔄 L’an dernier ici :</b> ' + ro.avant.map(p => emoji(p) + ' ' + esc(p)).join(', ');
            if (ro.repetees.length) h += '<p>⚠️ ' + ro.repetees.map(esc).join(', ') + ' : même famille que l’an dernier. Mieux vaut changer de famille chaque année pour ne pas épuiser le sol ni garder les maladies.</p>';
            h += '</div>';
          }
        }
        h += '<label class="pp-champ">Notes <textarea id="pp-notes" rows="3" placeholder="Variétés, date de semis, observations…">' + esc(el.notes || '') + '</textarea></label>' +
          '<div class="pp-actions"><button class="bouton second" id="pp-suppr">🗑 Supprimer</button></div>';
        panneau.innerHTML = h;
      }
      function resume() {
        const surfTot = plan.largeur * plan.longueur * pas() * pas();
        const cult = elems().filter(e => TYPES[e.type].culture);
        const surfCult = cult.reduce((s, e) => s + e.w * e.h * pas() * pas(), 0);
        let h = '<h2>Jardin ' + esc(annee) + '</h2><p class="pp-taille">' + fmt(plan.largeur * pas()) + ' m × ' + fmt(plan.longueur * pas()) + ' m = <b>' + fmt(surfTot) + ' m²</b><br>Surface cultivée : <b>' + fmt(surfCult) + ' m²</b></p>';
        if (!elems().length) {
          h += '<p>Pour commencer, choisissez <b>🌱 Planche</b> dans les outils puis tracez-la sur la grille. Faites de même pour les allées, l’abri, les arbres…</p>';
        } else if (cult.length) {
          h += '<h3>Planches</h3><ul class="pp-liste">' + cult.map(e => {
            const al = alertes(e).length ? ' ⚠️' : '';
            return '<li><button class="lien-plante" data-choisir="' + e.id + '">' + esc(e.nom) + '</button>' + al + '<span>' + ((e.plantes || []).length ? e.plantes.map(p => emoji(p) + ' ' + esc(p)).join(', ') : 'vide') + '</span></li>';
          }).join('') + '</ul>';
        }
        h += '<p class="pp-astuce">Tout est enregistré automatiquement dans cet appareil.</p>';
        return h;
      }
      panneau.addEventListener('click', e => {
        const el = elems().find(x => x.id === selId);
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.choisir) { selId = b.dataset.choisir; outil = 'choisir'; majOutils(); dessiner(); majPanneau(); return; }
        if (!el) return;
        if (b.id === 'pp-fermer') { selId = null; dessiner(); majPanneau(); }
        else if (b.dataset.retirer !== undefined) { el.plantes.splice(+b.dataset.retirer, 1); sauver(); dessiner(); majPanneau(); }
        else if (b.id === 'pp-suppr') dialogueConfirmer('Supprimer « ' + el.nom + ' » du plan ' + annee + ' ?', () => {
          plan.annees[annee].elements = elems().filter(x => x.id !== el.id); selId = null; sauver(); dessiner(); majPanneau();
        });
      });
      panneau.addEventListener('change', e => {
        const el = elems().find(x => x.id === selId);
        if (!el) return;
        if (e.target.id === 'pp-plante' && e.target.value) {
          if (e.target.value === '__autre') { dialogueSaisie('Nom de la plante', '', v => ajouterPlante(el, v)); e.target.value = ''; return; }
          ajouterPlante(el, e.target.value);
        } else if (e.target.id === 'pp-type') {
          el.type = e.target.value; if (!TYPES[el.type].culture) el.plantes = []; sauver(); dessiner(); majPanneau();
        }
      });
      function ajouterPlante(el, nom) {
        nom = nom.trim(); if (!nom) return;
        el.plantes = el.plantes || [];
        if (!el.plantes.includes(nom)) el.plantes.push(nom);
        sauver(); dessiner(); majPanneau();
      }
      panneau.addEventListener('input', e => {
        const el = elems().find(x => x.id === selId);
        if (!el) return;
        if (e.target.id === 'pp-nom') { el.nom = e.target.value || TYPES[el.type].nom; sauver(); dessiner(); panneau.querySelector('h2').textContent = TYPES[el.type].ico + ' ' + el.nom; }
        if (e.target.id === 'pp-notes') { el.notes = e.target.value; sauver(); }
      });

      /* ----- petites fenêtres ----- */
      const dlg = c.querySelector('#dlg');
      function fermerDlg() { dlg.hidden = true; dlg.innerHTML = ''; }
      function ouvrirDlg(html, apres) {
        dlg.innerHTML = '<div class="plan-boite" role="dialog" aria-modal="true">' + html + '</div>';
        dlg.hidden = false;
        dlg.querySelector('[data-annuler]').addEventListener('click', fermerDlg);
        apres(dlg);
        const f = dlg.querySelector('input, button'); if (f) f.focus();
      }
      function dialogueConfirmer(texte, ok) {
        ouvrirDlg('<p>' + esc(texte) + '</p><div class="pp-actions"><button class="bouton" data-ok>Supprimer</button><button class="bouton second" data-annuler>Annuler</button></div>',
          d => d.querySelector('[data-ok]').addEventListener('click', () => { fermerDlg(); ok(); }));
      }
      function dialogueSaisie(titre, val, ok) {
        ouvrirDlg('<label class="pp-champ">' + esc(titre) + ' <input type="text" id="saisie" value="' + esc(val) + '" maxlength="40"></label><div class="pp-actions"><button class="bouton" data-ok>Ajouter</button><button class="bouton second" data-annuler>Annuler</button></div>',
          d => {
            const go = () => { const v = d.querySelector('#saisie').value; fermerDlg(); ok(v); };
            d.querySelector('[data-ok]').addEventListener('click', go);
            d.querySelector('#saisie').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
          });
      }
      function dialogueDimensions() {
        ouvrirDlg('<h2>Dimensions du jardin</h2>' + champsDimensions(plan.largeur * plan.pas, plan.longueur * plan.pas, plan.pas) +
          '<p class="pp-astuce">Les éléments déjà tracés gardent leur taille en mètres.</p><p class="message" id="dim-msg" role="status"></p>' +
          '<div class="pp-actions"><button class="bouton" data-ok>Enregistrer</button><button class="bouton second" data-annuler>Annuler</button></div>', d => {
          d.querySelector('[data-ok]').addEventListener('click', () => {
            const v = lireDimensions(d);
            if (!v) { d.querySelector('#dim-msg').textContent = 'Indiquez une largeur et une longueur entre 1 et 200 m.'; return; }
            const k = plan.pas / v.pas; // conversion des cases
            const conv = Object.values(plan.annees).every(a => a.elements.every(e => Number.isInteger(e.x * k) && Number.isInteger(e.w * k) && Number.isInteger(e.y * k) && Number.isInteger(e.h * k)));
            if (!conv) { d.querySelector('#dim-msg').textContent = 'Avec des cases d’1 m, certains éléments tracés au demi-mètre ne tomberaient plus juste. Gardez des cases de 50 cm.'; return; }
            const nl = Math.round(v.largeur / v.pas), nL = Math.round(v.longueur / v.pas);
            const depasse = Object.values(plan.annees).some(a => a.elements.some(e => (e.x + e.w) * k > nl || (e.y + e.h) * k > nL));
            if (depasse) { d.querySelector('#dim-msg').textContent = 'Certains éléments dépasseraient du jardin. Déplacez-les ou supprimez-les d’abord.'; return; }
            for (const a of Object.values(plan.annees)) for (const e of a.elements) { e.x *= k; e.y *= k; e.w *= k; e.h *= k; }
            plan.largeur = nl; plan.longueur = nL; plan.pas = v.pas;
            sauver(); fermerDlg(); tout();
          });
        });
      }

      let minuterie;
      function message(t) {
        aide.textContent = t; aide.classList.add('note-info');
        clearTimeout(minuterie);
        minuterie = setTimeout(() => { aide.classList.remove('note-info'); majOutils(); }, 6000);
      }

      function tout() { majAnnees(); majOutils(); dessiner(); majPanneau(); }
      tout();
    };

    /* ---------- Création du plan ---------- */
    function champsDimensions(l, L, p) {
      return '<div class="dims"><label class="pp-champ">Largeur (m) <input type="number" id="d-l" min="1" max="200" step="0.5" value="' + l + '" inputmode="decimal"></label>' +
        '<label class="pp-champ">Longueur (m) <input type="number" id="d-L" min="1" max="200" step="0.5" value="' + L + '" inputmode="decimal"></label>' +
        '<label class="pp-champ">Taille d’une case <select id="d-p"><option value="1"' + (p === 1 ? ' selected' : '') + '>1 m</option><option value="0.5"' + (p === 0.5 ? ' selected' : '') + '>50 cm</option></select></label></div>';
    }
    function lireDimensions(d) {
      const l = parseFloat(String(d.querySelector('#d-l').value).replace(',', '.'));
      const L = parseFloat(String(d.querySelector('#d-L').value).replace(',', '.'));
      const pas = parseFloat(d.querySelector('#d-p').value);
      if (!(l >= 1 && l <= 200 && L >= 1 && L <= 200)) return null;
      return { largeur: Math.max(pas, Math.round(l / pas) * pas), longueur: Math.max(pas, Math.round(L / pas) * pas), pas };
    }
    function pageCreation(c) {
      const an = String(new Date().getFullYear());
      c.innerHTML = '<h1>Plan du jardin</h1><section class="carte"><h2>Votre jardin</h2>' +
        '<p>Indiquez la taille de votre jardin. Il sera représenté par une grille : vous y tracerez ensuite vos planches, allées, abri, arbres… comme sur du papier quadrillé.</p>' +
        champsDimensions(12, 8, 1) +
        '<p class="pp-astuce">Pour un petit potager, des cases de 50 cm permettent plus de précision.</p><p class="message" id="msg" role="status"></p>' +
        '<div class="pp-actions"><button class="bouton" id="creer">Créer le plan ' + an + '</button></div></section>';
      c.querySelector('#creer').addEventListener('click', () => {
        const v = lireDimensions(c);
        if (!v) { c.querySelector('#msg').textContent = 'Indiquez une largeur et une longueur entre 1 et 200 m.'; return; }
        const plan = { version: 1, largeur: Math.round(v.largeur / v.pas), longueur: Math.round(v.longueur / v.pas), pas: v.pas, annees: {} };
        plan.annees[an] = { elements: [] };
        ecrire(plan);
        stock.ecrire('plan.annee', an);
        app.rendre();
      });
    }
  });
})();
