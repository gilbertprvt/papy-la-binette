/* Papy la Binette — Agenda personnel et relevés météo */
(function () {
  'use strict';
  window.PapyExtensions = window.PapyExtensions || [];
  window.PapyExtensions.push(function (app) {
    const { PAGES, stock, esc, MOIS, MOIS_COURT, JOURS, cap, aujourdhui, memeJour, jourSemaine, dateLongue, iso, deIso, dateFr, nombre, confirmer } = app;

    const CIEL = [['☀️', 'Beau temps'], ['⛅', 'Nuageux'], ['☁️', 'Couvert'], ['🌧️', 'Pluvieux'], ['⛈️', 'Orageux'], ['🌫️', 'Brouillard']];
    const ICONE_CIEL = Object.fromEntries(CIEL.map(([i, n]) => [n, i]));
    const VENTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    const nf = (v, d) => v == null ? '–' : v.toLocaleString('fr-FR', { maximumFractionDigits: d == null ? 1 : d });
    function decaler(j, n) { const t = new Date(Date.UTC(j.y, j.m - 1, j.d + n)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }

    /* =====================================================================
       AGENDA
       ===================================================================== */
    PAGES.agenda = c => {
      const t = aujourdhui();
      const etat = { y: t.y, m: t.m, sel: iso(t) };
      const notes = () => stock.lire('agenda', {});

      c.innerHTML = '<h1>Agenda du jardin</h1><p class="intro">Touchez un jour pour y écrire une note. Elle est enregistrée au fur et à mesure.</p>' +
        '<div class="nav-mois agenda-nav"><button data-nav="-1" aria-label="Mois précédent">◀</button><span class="mois" id="titre-mois"></span><button data-nav="1" aria-label="Mois suivant">▶</button><button data-nav="0">Aujourd’hui</button></div>' +
        '<div class="agenda-mise"><div class="grille agenda-grille" id="grille"></div><aside class="panneau agenda-panneau" id="note"></aside></div>' +
        '<section class="agenda-liste" id="liste"></section>';
      const grille = c.querySelector('#grille'), panneau = c.querySelector('#note'), liste = c.querySelector('#liste');

      function dessinerMois() {
        c.querySelector('#titre-mois').textContent = cap(MOIS[etat.m - 1]) + ' ' + etat.y;
        const N = notes(), meteo = stock.lire('meteo', {});
        const nb = new Date(Date.UTC(etat.y, etat.m, 0)).getUTCDate();
        const decal = (jourSemaine({ y: etat.y, m: etat.m, d: 1 }) + 6) % 7;
        let g = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => '<div class="jsem">' + j + '</div>').join('');
        for (let i = 0; i < decal; i++) g += '<div></div>';
        for (let d = 1; d <= nb; d++) {
          const k = iso({ y: etat.y, m: etat.m, d });
          const txt = N[k] || '';
          const ciel = meteo[k] && (meteo[k].ciel_matin || meteo[k].ciel_apm);
          g += '<button class="jour-agenda' + (txt ? ' a-note' : '') + (k === iso(t) ? ' aujourdhui' : '') + '" data-j="' + k + '" aria-pressed="' + (k === etat.sel) + '" aria-label="' + esc(dateLongue({ y: etat.y, m: etat.m, d }) + (txt ? ', une note' : '')) + '">' +
            '<span class="num">' + d + '</span>' + (ciel ? '<span class="ciel" aria-hidden="true">' + ICONE_CIEL[ciel] + '</span>' : '') +
            (txt ? '<span class="apercu-note">' + esc(txt.slice(0, 60)) + '</span>' : '') + '</button>';
        }
        grille.innerHTML = g;
        // notes du mois
        const ks = Object.keys(N).filter(k => k.startsWith(etat.y + '-' + String(etat.m).padStart(2, '0'))).sort();
        liste.innerHTML = ks.length ? '<h2>Notes de ' + MOIS[etat.m - 1] + '</h2>' + ks.map(k => '<article class="note-mois"><button class="lien-plante" data-j="' + k + '">' + esc(dateLongue(deIso(k))) + '</button><p>' + esc(N[k]) + '</p></article>').join('') : '';
      }
      function dessinerNote() {
        const k = etat.sel, j = deIso(k);
        const txt = notes()[k] || '';
        const m = stock.lire('meteo', {})[k];
        panneau.innerHTML = '<h2>' + esc(dateLongue(j)) + ' ' + j.y + '</h2>' +
          (m ? '<p class="ligne">' + resumeMeteo(m) + '</p>' : '') +
          '<label class="pp-champ" for="txt-note">📝 Note</label><textarea id="txt-note" class="zone-note" placeholder="Travaux faits, semis, récoltes, observations…">' + esc(txt) + '</textarea>' +
          '<p class="etat-sauvegarde" id="etat-note" role="status">' + (txt ? 'Note enregistrée.' : '') + '</p>' +
          '<div class="pp-actions">' + (txt ? '<button class="bouton second" id="suppr-note">🗑 Supprimer la note</button>' : '') + '<a class="bouton second" href="#meteo" id="vers-meteo">🌦️ Météo du jour</a></div>';
        const ta = panneau.querySelector('#txt-note');
        ta.addEventListener('input', () => {
          const N = notes();
          const v = ta.value;
          if (v.trim()) N[k] = v; else delete N[k];
          stock.ecrire('agenda', N);
          panneau.querySelector('#etat-note').textContent = v.trim() ? 'Note enregistrée.' : '';
          dessinerMois();
        });
        panneau.querySelector('#vers-meteo').addEventListener('click', () => stock.ecrire('meteo.jour', k));
        const sup = panneau.querySelector('#suppr-note');
        if (sup) sup.addEventListener('click', () => confirmer('Supprimer la note du ' + dateLongue(j) + ' ?', 'Supprimer', () => {
          const N = notes(); delete N[k]; stock.ecrire('agenda', N); dessinerMois(); dessinerNote();
        }));
      }
      c.addEventListener('click', e => {
        const nav = e.target.closest('[data-nav]');
        if (nav) {
          const n = +nav.dataset.nav;
          if (n === 0) { etat.y = t.y; etat.m = t.m; etat.sel = iso(t); dessinerNote(); }
          else { etat.m += n; if (etat.m < 1) { etat.m = 12; etat.y--; } if (etat.m > 12) { etat.m = 1; etat.y++; } }
          dessinerMois(); return;
        }
        const b = e.target.closest('[data-j]');
        if (b) {
          etat.sel = b.dataset.j;
          const j = deIso(etat.sel); etat.y = j.y; etat.m = j.m;
          dessinerMois(); dessinerNote();
          if (window.innerWidth < 900 || b.closest('#liste')) panneau.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const ta = panneau.querySelector('textarea'); if (ta && window.innerWidth >= 900) ta.focus();
        }
      });
      dessinerMois(); dessinerNote();
    };

    function resumeMeteo(m) {
      const p = [];
      if (m.ciel_matin) p.push(ICONE_CIEL[m.ciel_matin] + ' matin');
      if (m.ciel_apm) p.push(ICONE_CIEL[m.ciel_apm] + ' après-midi');
      if (m.temp_min != null || m.temp_max != null) p.push('🌡 ' + nf(m.temp_min) + ' / ' + nf(m.temp_max) + ' °C');
      if (m.pluie_mm) p.push('🌧 ' + nf(m.pluie_mm) + ' mm');
      return esc(p.join(' · '));
    }

    /* =====================================================================
       RELEVÉS MÉTÉO
       ===================================================================== */
    const CHAMPS_NUM = ['temp_min', 'temp_max', 'humidite', 'vent_vitesse', 'vent_rafales', 'pluie_mm', 'neige_cm'];

    PAGES.meteo = c => {
      const t = aujourdhui();
      let jour = stock.lire('meteo.jour', iso(t));
      stock.ecrire('meteo.jour', iso(t)); // la prochaine visite repart d'aujourd'hui
      let periodeStats = stock.lire('meteo.periode', '30');
      let periodeGraph = { type: '15' };

      c.innerHTML = '<h1>Relevés météo</h1>' +
        '<div class="meteo-date outils"><button class="bouton second" data-decal="-1" aria-label="Jour précédent">◀</button>' +
        '<label class="plan-annee">Date du relevé <input type="date" id="m-date"></label>' +
        '<button class="bouton second" data-decal="1" aria-label="Jour suivant">▶</button><button class="bouton second" data-decal="0">Aujourd’hui</button></div>' +
        '<div class="meteo-mise"><section class="carte-meteo" id="saisie"></section><section class="carte-meteo" id="stats"></section></div>' +
        '<section class="carte-meteo" id="graph"></section><section class="carte-meteo" id="histo"></section>';
      const zSaisie = c.querySelector('#saisie'), zStats = c.querySelector('#stats'), zGraph = c.querySelector('#graph'), zHisto = c.querySelector('#histo');
      const inDate = c.querySelector('#m-date');

      const toutes = () => stock.lire('meteo', {});
      function enregistrer(k, r) {
        const M = toutes();
        const vide = !r.ciel_matin && !r.ciel_apm && CHAMPS_NUM.every(f => r[f] == null) && !r.grele && !r.arrosage && !(r.notes || '').trim() && !r.vent_direction;
        if (vide) delete M[k]; else M[k] = r;
        stock.ecrire('meteo', M);
      }

      /* ----- saisie ----- */
      function dessinerSaisie() {
        inDate.value = jour;
        const r = toutes()[jour] || {};
        const boutonsCiel = champ => '<div class="choix-ciel" role="group">' + CIEL.map(([i, n]) =>
          '<button type="button" class="ciel-btn" data-champ="' + champ + '" data-val="' + n + '" aria-pressed="' + (r[champ] === n) + '" title="' + n + '"><span>' + i + '</span><small>' + n + '</small></button>').join('') + '</div>';
        const num = (f, lib, pas, min, max) => '<label class="m-champ">' + lib + '<input type="text" inputmode="decimal" autocomplete="off" data-f="' + f + '" value="' + (r[f] == null ? '' : String(r[f]).replace('.', ',')) + '"></label>';
        zSaisie.innerHTML = '<h2>✏️ Relevé du ' + esc(dateLongue(deIso(jour)).toLowerCase()) + '</h2>' +
          '<p class="alerte-gel" id="gel"' + ((r.temp_min != null && r.temp_min < 0) ? '' : ' hidden') + '>❄️ Température sous 0 °C : risque de gel ! Protégez les plantes sensibles.</p>' +
          '<h3>🌤 État du ciel</h3><p class="m-sous">Matin</p>' + boutonsCiel('ciel_matin') + '<p class="m-sous">Après-midi</p>' + boutonsCiel('ciel_apm') +
          '<h3>🌡 Températures & humidité</h3><div class="m-ligne">' + num('temp_min', 'Min (°C)', '0.5') + num('temp_max', 'Max (°C)', '0.5') + num('humidite', 'Humidité (%)', '1', 0, 100) + '</div>' +
          '<h3>💨 Vent</h3><div class="m-ligne">' + num('vent_vitesse', 'Vitesse moy. (km/h)', '1', 0) + num('vent_rafales', 'Rafales max (km/h)', '1', 0) +
          '<label class="m-champ">Direction<select data-f="vent_direction"><option value="">–</option>' + VENTS.map(v => '<option' + (r.vent_direction === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label></div>' +
          '<h3>🌧 Précipitations</h3><div class="m-ligne">' + num('pluie_mm', 'Pluie (mm)', '0.5', 0) + num('neige_cm', 'Neige (cm)', '0.5', 0) + '</div>' +
          '<div class="m-cases"><label><input type="checkbox" data-f="grele"' + (r.grele ? ' checked' : '') + '> ⛈ Grêle</label><label><input type="checkbox" data-f="arrosage"' + (r.arrosage ? ' checked' : '') + '> 🚿 Arrosage fait</label></div>' +
          '<h3>📝 Notes du jour</h3><textarea data-f="notes" class="zone-note" rows="3">' + esc(r.notes || '') + '</textarea>' +
          '<div class="pp-actions"><p class="etat-sauvegarde" id="m-etat" role="status">' + (toutes()[jour] ? 'Relevé enregistré.' : 'Rien de saisi pour ce jour.') + '</p>' +
          (toutes()[jour] ? '<button class="bouton second" id="m-effacer">🗑 Effacer ce relevé</button>' : '') + '</div>';
        const ef = zSaisie.querySelector('#m-effacer');
        if (ef) ef.addEventListener('click', () => confirmer('Effacer le relevé du ' + dateFr(jour) + ' ?', 'Effacer', () => {
          const M = toutes(); delete M[jour]; stock.ecrire('meteo', M); toutRafraichir();
        }));
      }
      function lireSaisie() {
        const r = Object.assign({}, toutes()[jour] || {});
        zSaisie.querySelectorAll('[data-f]').forEach(x => {
          const f = x.dataset.f;
          if (x.type === 'checkbox') r[f] = x.checked;
          else if (CHAMPS_NUM.includes(f)) r[f] = nombre(x.value);
          else r[f] = x.value;
        });
        r.vent_present = (r.vent_vitesse || 0) > 0 || (r.vent_rafales || 0) > 0;
        return r;
      }
      function majApresSaisie() {
        const r = lireSaisie();
        enregistrer(jour, r);
        zSaisie.querySelector('#gel').hidden = !(r.temp_min != null && r.temp_min < 0);
        zSaisie.querySelector('#m-etat').textContent = toutes()[jour] ? 'Relevé enregistré.' : 'Rien de saisi pour ce jour.';
        dessinerStats(); dessinerGraph(); dessinerHisto();
      }
      zSaisie.addEventListener('input', e => { if (e.target.matches('[data-f]')) majApresSaisie(); });
      zSaisie.addEventListener('change', e => { if (e.target.matches('select, [type=checkbox]')) majApresSaisie(); });
      zSaisie.addEventListener('click', e => {
        const b = e.target.closest('.ciel-btn');
        if (!b) return;
        const r = lireSaisie();
        r[b.dataset.champ] = r[b.dataset.champ] === b.dataset.val ? '' : b.dataset.val;
        enregistrer(jour, r);
        zSaisie.querySelectorAll('.ciel-btn[data-champ="' + b.dataset.champ + '"]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.val === r[b.dataset.champ])));
        zSaisie.querySelector('#m-etat').textContent = toutes()[jour] ? 'Relevé enregistré.' : 'Rien de saisi pour ce jour.';
        dessinerStats(); dessinerGraph(); dessinerHisto();
      });

      /* ----- statistiques ----- */
      function relevesEntre(debut, fin) {
        const M = toutes();
        return Object.keys(M).filter(k => k >= debut && k <= fin).sort().map(k => Object.assign({ date: k }, M[k]));
      }
      function dessinerStats() {
        const fin = iso(t);
        const debut = periodeStats === 'annee' ? t.y + '-01-01' : iso(decaler(t, -(+periodeStats - 1)));
        const L = relevesEntre(debut, fin);
        const val = f => L.map(r => r[f]).filter(v => v != null);
        const moy = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
        const mins = val('temp_min'), maxs = val('temp_max');
        const pluie = val('pluie_mm');
        const vent = L.filter(r => r.vent_vitesse != null).map(r => r.vent_vitesse);
        const st = {
          nb: L.length,
          minAbs: mins.length ? Math.min(...mins) : null, maxAbs: maxs.length ? Math.max(...maxs) : null,
          moyMin: moy(mins), moyMax: moy(maxs), hum: moy(val('humidite')),
          cumul: pluie.reduce((s, v) => s + v, 0), joursPluie: pluie.filter(v => v > 0).length,
          vent: moy(vent), gel: mins.filter(v => v < 0).length,
          beau: L.filter(r => r.ciel_matin === 'Beau temps' || r.ciel_apm === 'Beau temps').length
        };
        const per = [['7', '7 jours'], ['30', '30 jours'], ['annee', 'Cette année']];
        let h = '<h2>📊 Statistiques</h2><div class="pastilles">' + per.map(([k, n]) => '<button class="pastille" data-per="' + k + '" aria-pressed="' + (k === periodeStats) + '">' + n + '</button>').join('') + '</div>';
        if (!L.length) { zStats.innerHTML = h + '<p class="vide">Aucun relevé sur cette période.</p>'; return; }
        const tuile = (ico, lib, v) => '<div class="tuile"><span class="t-lib">' + ico + ' ' + lib + '</span><span class="t-val">' + v + '</span></div>';
        h += '<p class="m-sous">' + st.nb + ' jour' + (st.nb > 1 ? 's' : '') + ' de relevés</p><div class="tuiles">' +
          tuile('🌡', 'Min absolue', nf(st.minAbs) + ' °C') + tuile('🌡', 'Max absolue', nf(st.maxAbs) + ' °C') +
          tuile('↕', 'Moy. min / max', nf(st.moyMin) + ' / ' + nf(st.moyMax) + ' °C') + tuile('💧', 'Humidité moy.', st.hum == null ? '–' : nf(st.hum, 0) + ' %') +
          tuile('🌧', 'Cumul pluie', nf(st.cumul) + ' mm') + tuile('☔', 'Jours de pluie', st.joursPluie) +
          tuile('💨', 'Vent moyen', st.vent == null ? '–' : (st.vent < 1 ? 'Calme' : nf(st.vent, 0) + ' km/h')) + tuile('❄️', 'Jours de gel', st.gel) +
          tuile('☀️', 'Jours de beau', st.beau) + '</div>';
        // recommandations
        const reco = [];
        if (st.gel > 0) reco.push('❄️ Gel relevé : voile d’hivernage sur les plantes sensibles, paillage au pied, pas d’arrosage le soir.');
        if (st.maxAbs != null && st.maxAbs >= 30) reco.push('🔥 Fortes chaleurs : arrosez tôt le matin ou le soir, paillez et ombrez les semis.');
        const jours = Math.min(st.nb, +periodeStats || st.nb);
        if (st.nb >= 5 && st.cumul < jours * 0.5 && (st.moyMax || 0) >= 18) reco.push('💧 Peu de pluie : surveillez l’humidité du sol et arrosez au pied.');
        if (st.cumul > jours * 4) reco.push('🌧 Sol très arrosé : évitez de marcher sur les planches et de travailler la terre mouillée.');
        if (st.hum != null && st.hum >= 80 && (st.moyMax || 0) >= 15) reco.push('🍄 Temps chaud et humide : risque de mildiou et d’oïdium, aérez et surveillez tomates, pommes de terre et courges.');
        if (st.vent != null && st.vent >= 30) reco.push('💨 Vent fort : vérifiez tuteurs, voiles et serre.');
        if (!reco.length) reco.push('🌿 Conditions sans alerte particulière : bon moment pour les travaux du jardin.');
        h += '<div class="reco"><b>🌿 Recommandations</b><ul>' + reco.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></div>';
        zStats.innerHTML = h;
      }
      zStats.addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (b) { periodeStats = b.dataset.per; stock.ecrire('meteo.periode', periodeStats); dessinerStats(); } });

      /* ----- graphiques (deux graphiques, une seule échelle chacun) ----- */
      function bornesGraph() {
        if (periodeGraph.type === 'perso' && periodeGraph.du && periodeGraph.au) return [periodeGraph.du, periodeGraph.au].sort();
        return [iso(decaler(t, -(+periodeGraph.type - 1))), iso(t)];
      }
      function dessinerGraph() {
        const [du, au] = bornesGraph();
        const jours = [];
        for (let j = deIso(du), n = 0; iso(j) <= au && n < 400; j = decaler(j, 1), n++) jours.push(iso(j));
        const M = toutes();
        const per = [['15', '15 jours'], ['30', '30 jours'], ['perso', 'Personnalisé']];
        let h = '<h2>📈 Évolution météo</h2><div class="outils"><div class="pastilles">' + per.map(([k, n]) => '<button class="pastille" data-pg="' + k + '" aria-pressed="' + (k === periodeGraph.type) + '">' + n + '</button>').join('') + '</div>' +
          (periodeGraph.type === 'perso' ? '<label>Du <input type="date" id="g-du" value="' + du + '"></label><label>Au <input type="date" id="g-au" value="' + au + '"></label>' : '') + '</div>';
        const aDonnees = jours.some(k => M[k] && (M[k].temp_min != null || M[k].temp_max != null || M[k].pluie_mm != null));
        if (!aDonnees) { zGraph.innerHTML = h + '<p class="vide">Aucune donnée pour cette période. Saisissez des relevés.</p>'; return; }
        h += '<p class="g-titre">Températures (°C) <span class="g-leg"><i style="background:#d0572a"></i>Max <i style="background:#2f6fbf"></i>Min</span></p><div class="graphe" id="g-temp"></div>' +
          '<p class="g-titre">Pluie (mm)</p><div class="graphe" id="g-pluie"></div>';
        zGraph.innerHTML = h;
        graphe(zGraph.querySelector('#g-temp'), jours, [
          { nom: 'Max', f: 'temp_max', coul: '#d0572a' }, { nom: 'Min', f: 'temp_min', coul: '#2f6fbf' }], M, 'ligne', '°C');
        graphe(zGraph.querySelector('#g-pluie'), jours, [{ nom: 'Pluie', f: 'pluie_mm', coul: '#2f6fbf' }], M, 'barres', 'mm');
      }
      zGraph.addEventListener('click', e => {
        const b = e.target.closest('[data-pg]');
        if (b) { periodeGraph.type = b.dataset.pg; if (b.dataset.pg === 'perso' && !periodeGraph.du) { periodeGraph.du = iso(decaler(t, -59)); periodeGraph.au = iso(t); } dessinerGraph(); }
      });
      zGraph.addEventListener('change', e => {
        if (e.target.id === 'g-du' && e.target.value) { periodeGraph.du = e.target.value; dessinerGraph(); }
        if (e.target.id === 'g-au' && e.target.value) { periodeGraph.au = e.target.value; dessinerGraph(); }
      });

      /* ----- historique ----- */
      function dessinerHisto() {
        const M = toutes();
        const ks = Object.keys(M).sort().reverse();
        let h = '<h2>📅 Historique</h2>';
        if (!ks.length) { zHisto.innerHTML = h + '<p class="vide">Aucun relevé pour l’instant.</p>'; return; }
        h += '<div class="table-defile"><table class="tableau"><thead><tr><th>Date</th><th>Ciel</th><th>Min</th><th>Max</th><th>Hum.</th><th>Pluie</th><th>Vent</th><th>Notes</th></tr></thead><tbody>' +
          ks.slice(0, 120).map(k => {
            const r = M[k];
            return '<tr data-jour="' + k + '"' + (k === jour ? ' class="choisie"' : '') + ' tabindex="0"><td>' + dateFr(k) + '</td><td>' + (r.ciel_matin ? ICONE_CIEL[r.ciel_matin] : '') + (r.ciel_apm ? ' ' + ICONE_CIEL[r.ciel_apm] : '') +
              '</td><td class="nb' + (r.temp_min != null && r.temp_min < 0 ? ' froid' : '') + '">' + nf(r.temp_min) + '</td><td class="nb">' + nf(r.temp_max) + '</td><td class="nb">' + (r.humidite == null ? '–' : r.humidite + ' %') +
              '</td><td class="nb">' + (r.pluie_mm ? nf(r.pluie_mm) + ' mm' : '0 mm') + '</td><td>' + (r.vent_vitesse ? nf(r.vent_vitesse, 0) + ' km/h' + (r.vent_direction ? ' ' + r.vent_direction : '') : 'Calme') +
              '</td><td class="notes">' + esc(r.notes || '') + (r.grele ? ' ⛈ grêle' : '') + (r.arrosage ? ' 🚿' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' + (ks.length > 120 ? '<p class="m-sous">Les 120 relevés les plus récents sont affichés.</p>' : '');
        zHisto.innerHTML = h;
      }
      function ouvrirJour(k) { jour = k; dessinerSaisie(); dessinerHisto(); zSaisie.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      zHisto.addEventListener('click', e => { const tr = e.target.closest('tr[data-jour]'); if (tr) ouvrirJour(tr.dataset.jour); });
      zHisto.addEventListener('keydown', e => { const tr = e.target.closest('tr[data-jour]'); if (tr && e.key === 'Enter') ouvrirJour(tr.dataset.jour); });

      inDate.addEventListener('change', () => { if (inDate.value) { jour = inDate.value; dessinerSaisie(); dessinerHisto(); } });
      c.querySelector('.meteo-date').addEventListener('click', e => {
        const b = e.target.closest('[data-decal]');
        if (!b) return;
        jour = +b.dataset.decal === 0 ? iso(t) : iso(decaler(deIso(jour), +b.dataset.decal));
        dessinerSaisie(); dessinerHisto();
      });
      function toutRafraichir() { dessinerSaisie(); dessinerStats(); dessinerGraph(); dessinerHisto(); }
      toutRafraichir();
    };

    /* ----- graphique SVG simple avec info-bulle ----- */
    function echelle(min, max) {
      if (min === max) { min -= 1; max += 1; }
      const brut = (max - min) / 4;
      const p = Math.pow(10, Math.floor(Math.log10(brut)));
      const pas = [1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= brut);
      const a = Math.floor(min / pas) * pas, b = Math.ceil(max / pas) * pas;
      const gr = []; for (let v = a; v <= b + pas / 2; v += pas) gr.push(+v.toFixed(6));
      return { a, b, gr };
    }
    function graphe(zone, jours, series, M, type, unite) {
      // dessiné à la largeur réelle de l'écran pour garder des textes lisibles sur téléphone
      const W = Math.max(300, Math.round(zone.clientWidth || 760)), H = W < 500 ? 190 : 220, mg = { g: 40, d: 10, h: 12, b: 28 };
      const lx = W - mg.g - mg.d, ly = H - mg.h - mg.b;
      const vals = [];
      for (const k of jours) for (const s of series) { const v = M[k] && M[k][s.f]; if (v != null) vals.push(v); }
      let min = Math.min(...vals), max = Math.max(...vals);
      if (type === 'barres') { min = 0; max = Math.max(max, 5); }
      const e = echelle(min, max);
      const n = jours.length;
      const bande = lx / n;
      const X = i => mg.g + bande * (i + 0.5);
      const Y = v => mg.h + ly - (v - e.a) / (e.b - e.a) * ly;
      let s = '';
      for (const g of e.gr) s += '<line class="g-grille" x1="' + mg.g + '" x2="' + (W - mg.d) + '" y1="' + Y(g) + '" y2="' + Y(g) + '"/><text class="g-axe" x="' + (mg.g - 6) + '" y="' + (Y(g) + 4) + '" text-anchor="end">' + g.toLocaleString('fr-FR') + '</text>';
      if (type === 'ligne' && e.a < 0 && e.b > 0) s += '<line class="g-zero" x1="' + mg.g + '" x2="' + (W - mg.d) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
      const saut = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(lx / 70))));
      jours.forEach((k, i) => { if (i % saut === 0 || i === n - 1) { const j = deIso(k); s += '<text class="g-axe" x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + j.d + ' ' + MOIS_COURT[j.m - 1].replace('.', '') + '</text>'; } });
      if (type === 'barres') {
        const lb = Math.max(2, Math.min(18, bande - 4));
        jours.forEach((k, i) => {
          const v = M[k] && M[k][series[0].f];
          if (!v) return;
          const y = Y(v), hb = Y(0) - y;
          const r = Math.min(4, lb / 2, hb);
          s += '<path fill="' + series[0].coul + '" d="M' + (X(i) - lb / 2) + ',' + Y(0) + 'V' + (y + r) + 'q0,' + (-r) + ' ' + r + ',' + (-r) + 'H' + (X(i) + lb / 2 - r) + 'q' + r + ',0 ' + r + ',' + r + 'V' + Y(0) + 'Z"/>';
        });
      } else {
        for (const se of series) {
          let d = '', ouvert = false;
          jours.forEach((k, i) => {
            const v = M[k] && M[k][se.f];
            if (v == null) { ouvert = false; return; }
            d += (ouvert ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); ouvert = true;
          });
          s += '<path d="' + d + '" fill="none" stroke="' + se.coul + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
          jours.forEach((k, i) => { const v = M[k] && M[k][se.f]; if (v != null) s += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + se.coul + '" stroke="#fff" stroke-width="2"/>'; });
        }
      }
      s += '<line class="g-curseur" id="cur" x1="0" x2="0" y1="' + mg.h + '" y2="' + (mg.h + ly) + '" visibility="hidden"/>';
      s += '<rect class="g-capte" x="' + mg.g + '" y="' + mg.h + '" width="' + lx + '" height="' + ly + '" fill="transparent"/>';
      zone.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graphique">' + s + '</svg><div class="g-bulle" hidden></div>';
      const svg = zone.querySelector('svg'), bulle = zone.querySelector('.g-bulle'), cur = svg.querySelector('#cur');
      function montrer(ev) {
        const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const i = Math.max(0, Math.min(n - 1, Math.floor((p.x - mg.g) / bande)));
        const k = jours[i], r = M[k] || {};
        cur.setAttribute('x1', X(i)); cur.setAttribute('x2', X(i)); cur.setAttribute('visibility', 'visible');
        bulle.innerHTML = '<b>' + esc(dateLongue(deIso(k))) + '</b>' + series.map(se => '<div><i style="background:' + se.coul + '"></i>' + se.nom + ' : ' + (r[se.f] == null ? '–' : nf(r[se.f]) + ' ' + unite) + '</div>').join('');
        bulle.hidden = false;
        const zr = zone.getBoundingClientRect();
        const px = (X(i) / W) * zr.width;
        bulle.style.left = Math.min(zr.width - 170, Math.max(0, px + 12)) + 'px';
      }
      svg.addEventListener('pointermove', montrer);
      svg.addEventListener('pointerdown', montrer);
      svg.addEventListener('pointerleave', () => { bulle.hidden = true; cur.setAttribute('visibility', 'hidden'); });
    }
  });
})();
