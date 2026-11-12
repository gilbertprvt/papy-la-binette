/* Papy la Binette — Suivi des plantations, suivi des dépenses, archives */
(function () {
  'use strict';
  window.PapyExtensions = window.PapyExtensions || [];
  window.PapyExtensions.push(function (app) {
    const { PAGES, stock, esc, sansAccent, D, iso, aujourdhui, dateFr, nombre, euros, fenetre, confirmer } = app;

    const ETATS = ['Planifié', 'En cours', 'Terminé', 'Abandonné'];
    const COUL_ETAT = { 'Planifié': '#e3f0fb', 'En cours': '#e2f4e6', 'Terminé': '#ececec', 'Abandonné': '#f9e2e2' };
    const BORD_ETAT = { 'Planifié': '#4d8fc4', 'En cours': '#3f8f4f', 'Terminé': '#8a8a8a', 'Abandonné': '#b04040' };
    const ETAPES = [['semis', 'Semis'], ['germination', 'Germination'], ['plantation', 'Plantation'], ['floraison', 'Floraison'], ['recolte1', '1ʳᵉ récolte'], ['recolte_fin', 'Fin de récolte']];
    const CATEGORIES = ['Plants', 'Graines / Semences', 'Engrais / Amendements', 'Traitements / Phyto', 'Terreau / Substrat', 'Outils', 'Arrosage / Irrigation', 'Semences à échanger', 'Autre'];
    const ICO_CAT = { 'Plants': '🌱', 'Graines / Semences': '🌾', 'Engrais / Amendements': '🧪', 'Traitements / Phyto': '💊', 'Terreau / Substrat': '🪣', 'Outils': '🔧', 'Arrosage / Irrigation': '💧', 'Semences à échanger': '🔄', 'Autre': '📦' };
    let uid = Date.now();
    const nouvelId = () => 'x' + (uid++).toString(36);
    const anneeCourante = () => new Date().getFullYear();

    // toutes les plantes connues, pour la saisie
    const PLANTES_CONNUES = [...new Set([
      ...Object.values(D.plantes.catalogue).flat().map(r => r[0]),
      ...Object.values(D.aromatiques.catalogue).flat().map(r => r[0]),
      ...Object.values(D.fruits.catalogue).flat().map(r => r[0]),
      ...Object.values(D.fleurs.catalogue).flat().map(r => r[0])
    ])].sort((a, b) => a.localeCompare(b, 'fr'));
    function fichePlante(nom) {
      const n = sansAccent(nom || '');
      for (const [k, v] of Object.entries(D.fichesCulture)) if (sansAccent(k) === n) return v;
      const base = n.split(/[\s-]/)[0];
      for (const [k, v] of Object.entries(D.fichesCulture)) if (sansAccent(k) === base) return v;
      return null;
    }
    function ligneCatalogue(nom) {
      const n = sansAccent(nom || '');
      for (const lignes of Object.values(D.plantes.catalogue)) for (const r of lignes) if (sansAccent(r[0]) === n) return r;
      return null;
    }
    const cap1 = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    /* ---------- archives : structure commune ---------- */
    const lireArchives = () => stock.lire('archives', { suivi: {}, depenses: {} });
    const ecrireArchives = a => stock.ecrire('archives', a);

    function dialogueArchiver(quoi, lignes, apres) {
      const nom = quoi === 'suivi' ? 'le suivi des plantations' : 'les dépenses';
      if (!lignes.length) { confirmer('Il n’y a rien à archiver pour l’instant.', 'Fermer', () => {}); return; }
      const w = fenetre('<h2>📦 Archiver et vider</h2><p>Les ' + lignes.length + ' ligne(s) de ' + esc(nom) + ' seront rangées dans les archives, puis la page sera vidée pour la nouvelle saison. Les archives restent consultables et restaurables.</p>' +
        '<label class="pp-champ">Ranger sous l’année <input type="number" id="a-annee" min="1990" max="2100" value="' + anneeCourante() + '"></label><p class="message" id="a-msg" role="status"></p>' +
        '<div class="pp-actions"><button class="bouton" data-ok>📦 Archiver et vider</button><button class="bouton second" data-annuler>Annuler</button></div>');
      w.el.querySelector('[data-ok]').addEventListener('click', () => {
        const an = parseInt(w.el.querySelector('#a-annee').value, 10);
        if (!(an >= 1990 && an <= 2100)) { w.el.querySelector('#a-msg').textContent = 'Indiquez une année valide (par exemple ' + anneeCourante() + ').'; return; }
        const A = lireArchives();
        if (A[quoi][an]) { w.el.querySelector('#a-msg').textContent = 'L’année ' + an + ' est déjà archivée pour ' + nom + '. Choisissez une autre année ou supprimez d’abord cette archive.'; return; }
        A[quoi][an] = { date: new Date().toISOString(), lignes };
        ecrireArchives(A);
        w.fermer(); apres(an);
      });
    }

    /* =====================================================================
       SUIVI DES PLANTATIONS
       ===================================================================== */
    PAGES['suivi-plantations'] = c => {
      let filtre = '';
      const lire = () => stock.lire('suivi', []);
      const ecrire = l => stock.ecrire('suivi', l);

      c.innerHTML = '<h1>Suivi des plantations</h1><p class="intro">Notez pour chaque culture les dates clés, de la graine à la dernière récolte. Touchez une ligne pour la compléter.</p>' +
        '<div class="outils"><button class="bouton" id="s-ajout">🌿 Nouvelle plante</button><button class="bouton second" id="s-import">📥 Reprendre les plantes du plan</button><button class="bouton second" id="s-archiver">📦 Archiver et vider</button></div>' +
        '<div class="outils"><span><b>État</b></span><div class="pastilles" id="s-filtres"></div></div><p class="message" id="s-msg" role="status"></p><div id="s-liste"></div>';
      const zone = c.querySelector('#s-liste'), msg = c.querySelector('#s-msg');

      function dessiner() {
        const L = lire();
        c.querySelector('#s-filtres').innerHTML = [['', 'Toutes']].concat(ETATS.map(e => [e, e])).map(([k, n]) =>
          '<button class="pastille" data-filtre="' + esc(k) + '" aria-pressed="' + (k === filtre) + '">' + esc(n) + (k ? ' (' + L.filter(x => x.etat === k).length + ')' : ' (' + L.length + ')') + '</button>').join('');
        const vis = L.filter(x => !filtre || x.etat === filtre);
        if (!L.length) { zone.innerHTML = '<p class="vide">Aucune culture suivie pour l’instant. Ajoutez une plante, ou reprenez celles de votre plan du jardin.</p>'; return; }
        if (!vis.length) { zone.innerHTML = '<p class="vide">Aucune culture « ' + esc(filtre) + ' ».</p>'; return; }
        zone.innerHTML = '<div class="table-defile"><table class="tableau suivi"><thead><tr><th>Plante</th><th>Variété</th>' + ETAPES.map(([, n]) => '<th>' + n + '</th>').join('') + '<th>État</th><th>Notes</th></tr></thead><tbody>' +
          vis.map(x => '<tr data-id="' + x.id + '" tabindex="0" style="background:' + COUL_ETAT[x.etat] + '"><td class="fort">' + esc(x.plante) + '</td><td>' + esc(x.variete || '') + '</td>' +
            ETAPES.map(([f]) => '<td class="date">' + dateFr(x[f]) + '</td>').join('') +
            '<td><span class="badge-etat" style="border-color:' + BORD_ETAT[x.etat] + ';color:' + BORD_ETAT[x.etat] + '">' + esc(x.etat) + '</span></td><td class="notes">' + esc(x.notes || '') + '</td></tr>').join('') +
          '</tbody></table></div>';
      }
      function formulaire(x) {
        const neuf = !x;
        x = x || { id: nouvelId(), plante: '', variete: '', etat: 'En cours', notes: '' };
        const f = fichePlante(x.plante), cat = ligneCatalogue(x.plante);
        let fiche = '';
        if (cat) fiche += '<p class="m-sous">📅 Semis : ' + esc(cat[4]) + ' · Plantation : ' + esc(cat[8]) + ' · 1ʳᵉ récolte : ' + esc(cat[9]) + ' · Exposition : ' + esc(cat[3]) + '</p>';
        if (f) fiche += '<div class="culture">' + [['🌱 Conseils', f.conseils], ['🦠 Maladies', f.maladies], ['💊 Traitements', f.traitements]].filter(y => y[1] && y[1].length)
          .map(([t, l]) => '<div><h3>' + t + '</h3><ul>' + l.map(z => '<li>' + esc(z) + '</li>').join('') + '</ul></div>').join('') + '</div>';
        const w = fenetre('<h2>' + (neuf ? '🌿 Nouvelle plante' : '🌱 ' + esc(x.plante)) + '</h2>' +
          '<div class="dims"><label class="pp-champ">Plante * <input type="text" id="f-plante" list="liste-plantes" value="' + esc(x.plante) + '" maxlength="50" autocomplete="off"></label>' +
          '<label class="pp-champ">Variété <input type="text" id="f-variete" value="' + esc(x.variete || '') + '" maxlength="50"></label></div>' +
          '<datalist id="liste-plantes">' + PLANTES_CONNUES.map(p => '<option value="' + esc(p) + '">').join('') + '</datalist>' +
          '<div class="grille-dates">' + ETAPES.map(([k, n]) => '<label class="pp-champ">' + n + ' <input type="date" data-date="' + k + '" value="' + (x[k] || '') + '"></label>').join('') + '</div>' +
          '<label class="pp-champ">État <select id="f-etat">' + ETATS.map(e => '<option' + (e === x.etat ? ' selected' : '') + '>' + e + '</option>').join('') + '</select></label>' +
          '<label class="pp-champ">Notes <textarea id="f-notes" rows="3">' + esc(x.notes || '') + '</textarea></label>' +
          '<p class="message" id="f-msg" role="status"></p>' +
          '<div class="pp-actions"><button class="bouton" data-ok>Enregistrer</button><button class="bouton second" data-annuler>Annuler</button>' + (neuf ? '' : '<button class="bouton second danger" data-suppr>🗑 Supprimer</button>') + '</div>' +
          (fiche ? '<h3 class="fiche-titre">Fiche de la plante</h3>' + fiche : ''), true);
        w.el.querySelector('[data-ok]').addEventListener('click', () => {
          const plante = cap1(w.el.querySelector('#f-plante').value.trim());
          if (!plante) { w.el.querySelector('#f-msg').textContent = 'Le nom de la plante est obligatoire.'; return; }
          const y = Object.assign({}, x, { plante, variete: cap1(w.el.querySelector('#f-variete').value.trim()), etat: w.el.querySelector('#f-etat').value, notes: w.el.querySelector('#f-notes').value });
          w.el.querySelectorAll('[data-date]').forEach(i => { y[i.dataset.date] = i.value; });
          const L = lire(); const i = L.findIndex(z => z.id === y.id);
          if (i >= 0) L[i] = y; else L.push(y);
          ecrire(L); w.fermer(); dessiner();
        });
        const sup = w.el.querySelector('[data-suppr]');
        if (sup) sup.addEventListener('click', () => { w.fermer(); confirmer('Supprimer le suivi de « ' + x.plante + ' » ?', 'Supprimer', () => { ecrire(lire().filter(z => z.id !== x.id)); dessiner(); }); });
      }
      c.querySelector('#s-ajout').addEventListener('click', () => formulaire(null));
      c.querySelector('#s-import').addEventListener('click', () => {
        const plan = stock.lire('plan', null);
        if (!plan) { msg.textContent = 'Vous n’avez pas encore de plan du jardin. Créez-le dans Mon Jardin → Plan du jardin.'; return; }
        const an = String(anneeCourante());
        const annee = plan.annees[an] || plan.annees[Object.keys(plan.annees).sort().pop()];
        const L = lire();
        const deja = new Set(L.map(x => sansAccent(x.plante)));
        let n = 0;
        for (const el of annee.elements) for (const p of (el.plantes || [])) {
          if (deja.has(sansAccent(p))) continue;
          deja.add(sansAccent(p));
          L.push({ id: nouvelId(), plante: p, variete: '', etat: 'En cours', notes: 'Emplacement : ' + el.nom });
          n++;
        }
        ecrire(L); dessiner();
        msg.textContent = n ? n + ' plante(s) reprise(s) du plan du jardin.' : 'Toutes les plantes du plan sont déjà suivies.';
      });
      c.querySelector('#s-archiver').addEventListener('click', () => dialogueArchiver('suivi', lire(), an => { ecrire([]); dessiner(); msg.textContent = 'Suivi rangé dans les archives ' + an + '. La page est prête pour la nouvelle saison.'; }));
      c.addEventListener('click', e => {
        const f = e.target.closest('[data-filtre]'); if (f) { filtre = f.dataset.filtre; dessiner(); return; }
        const tr = e.target.closest('tr[data-id]'); if (tr) formulaire(lire().find(x => x.id === tr.dataset.id));
      });
      c.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') formulaire(lire().find(x => x.id === tr.dataset.id)); });
      dessiner();
    };

    /* =====================================================================
       SUIVI DES DÉPENSES
       ===================================================================== */
    function bilan(L) {
      const tot = {};
      for (const x of L) tot[x.categorie || 'Autre'] = (tot[x.categorie || 'Autre'] || 0) + (x.prix_total || 0);
      const lignes = Object.entries(tot).sort((a, b) => b[1] - a[1]);
      const total = lignes.reduce((s, [, v]) => s + v, 0);
      const max = Math.max(...lignes.map(([, v]) => v), 0.01);
      return '<h2>Bilan par catégorie</h2>' + (lignes.length ? '<ul class="bilan">' + lignes.map(([k, v]) =>
        '<li><span class="b-nom">' + (ICO_CAT[k] || '📦') + ' ' + esc(k) + '</span><span class="b-barre"><i style="width:' + (v / max * 100).toFixed(1) + '%"></i></span><span class="b-val">' + euros(v) + '</span></li>').join('') +
        '</ul><p class="b-total">Total général <b>' + euros(total) + '</b></p>' : '<p class="vide">Aucune dépense enregistrée.</p>');
    }
    function tableDepenses(L) {
      return '<div class="table-defile"><table class="tableau"><thead><tr><th>Date</th><th>Catégorie</th><th>Produit</th><th class="nb">Qté</th><th class="nb">Prix unit.</th><th class="nb">Total</th><th>Fournisseur</th><th>Notes</th></tr></thead><tbody>' +
        L.map(x => '<tr data-id="' + x.id + '" tabindex="0"><td class="date">' + dateFr(x.date) + '</td><td>' + (ICO_CAT[x.categorie] || '📦') + ' ' + esc(x.categorie) + '</td><td class="fort">' + esc(x.produit) +
          '</td><td class="nb">' + (x.quantite == null ? '' : x.quantite.toLocaleString('fr-FR')) + '</td><td class="nb">' + (x.prix_unitaire == null ? '' : euros(x.prix_unitaire)) + '</td><td class="nb fort">' + euros(x.prix_total) +
          '</td><td>' + esc(x.fournisseur || '') + '</td><td class="notes">' + esc(x.notes || '') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    const trierDepenses = L => L.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    PAGES.depenses = c => {
      const lire = () => stock.lire('depenses', []);
      const ecrire = l => stock.ecrire('depenses', l);
      c.innerHTML = '<h1>Suivi des dépenses</h1><div class="outils"><button class="bouton" id="d-ajout">➕ Nouvelle dépense</button><button class="bouton second" id="d-archiver">📦 Archiver et vider</button></div>' +
        '<p class="message" id="d-msg" role="status"></p><div class="dep-mise"><div id="d-liste"></div><aside class="panneau-plan" id="d-bilan"></aside></div>';
      const zone = c.querySelector('#d-liste'), zb = c.querySelector('#d-bilan'), msg = c.querySelector('#d-msg');
      function dessiner() {
        const L = trierDepenses(lire());
        zone.innerHTML = L.length ? '<p class="m-sous">Touchez une ligne pour la modifier.</p>' + tableDepenses(L) : '<p class="vide">Aucune dépense pour l’instant. Ajoutez votre premier achat.</p>';
        zb.innerHTML = bilan(L);
      }
      function formulaire(x) {
        const neuf = !x;
        x = x || { id: nouvelId(), date: iso(aujourdhui()), categorie: 'Plants', produit: '', quantite: 1, prix_unitaire: null, prix_total: 0, fournisseur: '', notes: '' };
        const fournisseurs = stock.lire('fournisseurs', []);
        const w = fenetre('<h2>💶 ' + (neuf ? 'Nouvelle dépense' : 'Modifier la dépense') + '</h2>' +
          '<div class="dims"><label class="pp-champ">Date <input type="date" id="f-date" value="' + (x.date || '') + '"></label>' +
          '<label class="pp-champ">Catégorie <select id="f-cat">' + CATEGORIES.map(k => '<option value="' + esc(k) + '"' + (k === x.categorie ? ' selected' : '') + '>' + ICO_CAT[k] + ' ' + esc(k) + '</option>').join('') + '</select></label></div>' +
          '<label class="pp-champ">Produit / désignation * <input type="text" id="f-produit" value="' + esc(x.produit) + '" maxlength="80"></label>' +
          '<div class="dims"><label class="pp-champ">Quantité <input type="text" inputmode="decimal" autocomplete="off" id="f-qte" value="' + (x.quantite == null ? '' : String(x.quantite).replace('.', ',')) + '"></label>' +
          '<label class="pp-champ">Prix unitaire (€) <input type="text" inputmode="decimal" autocomplete="off" id="f-pu" value="' + (x.prix_unitaire == null ? '' : x.prix_unitaire.toFixed(2).replace('.', ',')) + '"></label>' +
          '<label class="pp-champ">Prix total (€) <input type="text" inputmode="decimal" autocomplete="off" id="f-total" value="' + (x.prix_total == null ? '' : x.prix_total.toFixed(2).replace('.', ',')) + '"></label></div>' +
          '<label class="pp-champ">Fournisseur / magasin <input type="text" id="f-four" list="liste-four" value="' + esc(x.fournisseur || '') + '" maxlength="60" autocomplete="off"></label>' +
          '<datalist id="liste-four">' + fournisseurs.map(f => '<option value="' + esc(f) + '">').join('') + '</datalist>' +
          '<label class="pp-champ">Notes <textarea id="f-notes" rows="2">' + esc(x.notes || '') + '</textarea></label><p class="message" id="f-msg" role="status"></p>' +
          '<div class="pp-actions"><button class="bouton" data-ok>💾 Enregistrer</button><button class="bouton second" data-annuler>Annuler</button>' + (neuf ? '' : '<button class="bouton second danger" data-suppr>🗑 Supprimer</button>') + '</div>', true);
        const $ = s => w.el.querySelector(s);
        let totalManuel = !neuf && x.prix_unitaire != null && x.quantite != null && Math.abs(x.quantite * x.prix_unitaire - x.prix_total) > 0.005;
        function calc() {
          const q = nombre($('#f-qte').value), pu = nombre($('#f-pu').value);
          if (!totalManuel && q != null && pu != null) $('#f-total').value = (Math.round(q * pu * 100) / 100).toFixed(2).replace('.', ',');
        }
        $('#f-qte').addEventListener('input', calc); $('#f-pu').addEventListener('input', calc);
        $('#f-total').addEventListener('input', () => { totalManuel = true; });
        $('[data-ok]').addEventListener('click', () => {
          const produit = $('#f-produit').value.trim();
          if (!produit) { $('#f-msg').textContent = 'Le nom du produit est obligatoire.'; return; }
          const q = nombre($('#f-qte').value), pu = nombre($('#f-pu').value);
          let tot = nombre($('#f-total').value);
          if (tot == null && q != null && pu != null) tot = Math.round(q * pu * 100) / 100;
          if ([q, pu, tot].some(v => v != null && v < 0)) { $('#f-msg').textContent = 'Quantité et prix ne peuvent pas être négatifs.'; return; }
          const four = $('#f-four').value.trim();
          const y = Object.assign({}, x, { date: $('#f-date').value, categorie: $('#f-cat').value, produit: cap1(produit), quantite: q, prix_unitaire: pu, prix_total: tot || 0, fournisseur: four, notes: $('#f-notes').value });
          const L = lire(); const i = L.findIndex(z => z.id === y.id);
          if (i >= 0) L[i] = y; else L.push(y);
          ecrire(L);
          if (four && !fournisseurs.some(f => f.toLowerCase() === four.toLowerCase())) { fournisseurs.push(four); fournisseurs.sort((a, b) => a.localeCompare(b, 'fr')); stock.ecrire('fournisseurs', fournisseurs); }
          w.fermer(); dessiner();
        });
        const sup = $('[data-suppr]');
        if (sup) sup.addEventListener('click', () => { w.fermer(); confirmer('Supprimer la dépense « ' + x.produit + ' » ?', 'Supprimer', () => { ecrire(lire().filter(z => z.id !== x.id)); dessiner(); }); });
      }
      c.querySelector('#d-ajout').addEventListener('click', () => formulaire(null));
      c.querySelector('#d-archiver').addEventListener('click', () => dialogueArchiver('depenses', trierDepenses(lire()), an => { ecrire([]); dessiner(); msg.textContent = 'Dépenses rangées dans les archives ' + an + '. La page est prête pour la nouvelle saison.'; }));
      c.addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) formulaire(lire().find(x => x.id === tr.dataset.id)); });
      c.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') formulaire(lire().find(x => x.id === tr.dataset.id)); });
      dessiner();
    };

    /* =====================================================================
       ARCHIVES
       ===================================================================== */
    PAGES.archives = c => {
      let onglet = stock.lire('archives.onglet', 'suivi');
      let annee = null;
      function dessiner() {
        const A = lireArchives();
        const ans = Object.keys(A[onglet]).sort().reverse();
        if (!ans.includes(annee)) annee = ans[0] || null;
        let h = '<h1>Archives du jardin</h1><div class="outils"><div class="pastilles">' +
          [['suivi', '🌱 Suivi des plantations'], ['depenses', '💶 Dépenses']].map(([k, n]) => '<button class="pastille" data-onglet="' + k + '" aria-pressed="' + (k === onglet) + '">' + n + '</button>').join('') + '</div></div>';
        if (!annee) {
          h += '<p class="vide">Aucune archive pour l’instant. À la fin d’une saison, utilisez « 📦 Archiver et vider » dans ' + (onglet === 'suivi' ? 'le suivi des plantations' : 'le suivi des dépenses') + '.</p>' +
            '<p class="m-sous">Le plan du jardin garde déjà lui-même un plan par année.</p>';
          c.innerHTML = h; return;
        }
        const arc = A[onglet][annee];
        h += '<div class="outils"><label class="plan-annee">Année <select id="ar-annee">' + ans.map(a => '<option' + (a === annee ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></label>' +
          '<button class="bouton second" id="ar-restaurer">↩ Restaurer dans la page active</button><button class="bouton second danger" id="ar-suppr">🗑 Supprimer cette archive</button></div>' +
          '<p class="m-sous">' + arc.lignes.length + ' ligne(s), archivées le ' + new Date(arc.date).toLocaleDateString('fr-FR') + '.</p><p class="message" id="ar-msg" role="status"></p>';
        if (onglet === 'suivi') {
          h += '<div class="table-defile"><table class="tableau suivi"><thead><tr><th>Plante</th><th>Variété</th>' + ETAPES.map(([, n]) => '<th>' + n + '</th>').join('') + '<th>État</th><th>Notes</th></tr></thead><tbody>' +
            arc.lignes.slice().sort((a, b) => a.plante.localeCompare(b.plante, 'fr')).map(x => '<tr style="background:' + COUL_ETAT[x.etat] + '"><td class="fort">' + esc(x.plante) + '</td><td>' + esc(x.variete || '') + '</td>' +
              ETAPES.map(([f]) => '<td class="date">' + dateFr(x[f]) + '</td>').join('') + '<td>' + esc(x.etat) + '</td><td class="notes">' + esc(x.notes || '') + '</td></tr>').join('') + '</tbody></table></div>';
        } else {
          h += '<div class="dep-mise"><div>' + tableDepenses(arc.lignes) + '</div><aside class="panneau-plan">' + bilan(arc.lignes) + '</aside></div>';
        }
        c.innerHTML = h;
      }
      c.addEventListener('click', e => {
        const o = e.target.closest('[data-onglet]');
        if (o) { onglet = o.dataset.onglet; stock.ecrire('archives.onglet', onglet); annee = null; dessiner(); return; }
        const nom = onglet === 'suivi' ? 'Suivi des plantations' : 'Dépenses';
        const cle = onglet === 'suivi' ? 'suivi' : 'depenses';
        if (e.target.closest('#ar-suppr')) confirmer('Supprimer définitivement l’archive « ' + nom + ' ' + annee + ' » ?\nCette action est irréversible.', 'Supprimer', () => {
          const A = lireArchives(); delete A[onglet][annee]; ecrireArchives(A); annee = null; dessiner();
        });
        if (e.target.closest('#ar-restaurer')) {
          if (stock.lire(cle, []).length) { c.querySelector('#ar-msg').textContent = 'La page « ' + nom + ' » contient déjà des données. Archivez-la ou videz-la d’abord.'; return; }
          confirmer('Remettre « ' + nom + ' ' + annee + ' » dans la page active ?\nLes lignes seront retirées des archives.', 'Restaurer', () => {
            const A = lireArchives(); const l = A[onglet][annee].lignes; delete A[onglet][annee]; ecrireArchives(A);
            stock.ecrire(cle, l); annee = null; dessiner();
            const m = c.querySelector('#ar-msg'); if (m) m.textContent = l.length + ' ligne(s) restaurée(s) dans « ' + nom + ' ».'; else c.insertAdjacentHTML('beforeend', '<p class="message">' + l.length + ' ligne(s) restaurée(s) dans « ' + esc(nom) + ' ».</p>');
          });
        }
      });
      c.addEventListener('change', e => { if (e.target.id === 'ar-annee') { annee = e.target.value; dessiner(); } });
      dessiner();
    };
  });
})();
