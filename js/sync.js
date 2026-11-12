/* Papy la Binette — synchronisation entre appareils (ordinateur, tablette, téléphone)
   Les données restent dans chaque appareil et sont recopiées dans un carnet en ligne (Supabase).
   Chaque réglage ou liste (agenda, relevés, plan…) garde l'heure de sa dernière modification :
   à la rencontre de deux versions, la plus récente l'emporte. */
(function () {
  'use strict';
  window.PapyExtensions = window.PapyExtensions || [];
  window.PapyExtensions.push(function (app) {
    const { PAGES, stock, esc, rendre } = app;
    const CONF = window.PAPY_SYNC || {};
    const URL_P = (CONF.url || '').replace(/\/+$/, '');
    // l'aperçu dans Claude ne peut pas joindre le serveur : la synchronisation n'y est pas proposée
    const disponible = !!(URL_P && CONF.cle) && !/claude|anthropic|claudeusercontent/.test(location.hostname);
    // ces réglages ne concernent que l'appareil où l'on se trouve
    const LOCAUX = new Set(['meteo.jour', 'meteo.periode', 'plan.annee', 'archives.onglet', 'parterre.actif']);
    const CLE_SESSION = 'papy.session', CLE_DERNIERE = 'papy.sync.derniere', CLE_EMAIL = 'papy.sync.email', CLE_BASE = 'papy.sync.base';

    /* ---------- fusion à trois voies ----------
       « base » = dernière version échangée. Ce qui a changé d'un seul côté est repris tel quel ;
       si les deux appareils ont modifié la même liste, on fusionne élément par élément
       (jour par jour pour l'agenda et la météo, ligne par ligne pour les suivis, dépenses, parterres…). */
    const json = v => JSON.stringify(v);
    const egal = (a, b) => json(a) === json(b);
    const estObjet = v => v && typeof v === 'object' && !Array.isArray(v);
    const listeAvecId = v => Array.isArray(v) && v.length > 0 && v.every(x => estObjet(x) && x.id != null);
    function fusion3(b, l, r, prefLocal) {
      if (egal(l, r)) return l;
      if (l === undefined) return egal(r, b) ? undefined : r;
      if (r === undefined) return egal(l, b) ? undefined : l;
      if (egal(l, b)) return r;
      if (egal(r, b)) return l;
      if (estObjet(l) && estObjet(r)) {
        const bb = estObjet(b) ? b : {}, res = {};
        for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
          const v = fusion3(bb[k], l[k], r[k], prefLocal);
          if (v !== undefined) res[k] = v;
        }
        return res;
      }
      if ((listeAvecId(l) || Array.isArray(l) && !l.length) && (listeAvecId(r) || Array.isArray(r) && !r.length) && (l.length || r.length)) {
        const parId = a => new Map((Array.isArray(a) ? a : []).filter(x => estObjet(x) && x.id != null).map(x => [x.id, x]));
        const B = parId(b), Lm = parId(l), Rm = parId(r), res = [];
        const ordre = [...Lm.keys(), ...[...Rm.keys()].filter(k => !Lm.has(k))];
        for (const id of ordre) { const v = fusion3(B.get(id), Lm.get(id), Rm.get(id), prefLocal); if (v !== undefined) res.push(v); }
        return res;
      }
      return prefLocal ? l : r;
    }

    const lireLS = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } };
    const ecrireLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* rien */ } };

    let session = lireLS(CLE_SESSION, null);
    let etat = session ? 'ok' : 'hors';   // hors | envoi | ok | erreur
    let messageErreur = '';
    let enCours = null, relance = false, minuterie = null;

    /* ---------- appels au serveur ---------- */
    async function appel(chemin, options, jeton) {
      const r = await fetch(URL_P + chemin, Object.assign({}, options, {
        headers: Object.assign({ apikey: CONF.cle, Authorization: 'Bearer ' + (jeton || CONF.cle), 'Content-Type': 'application/json' }, (options || {}).headers)
      }));
      const texte = await r.text();
      let corps = null; try { corps = texte ? JSON.parse(texte) : null; } catch (e) { corps = texte; }
      if (!r.ok) {
        const err = new Error((corps && (corps.msg || corps.message || corps.error_description || corps.error)) || ('Erreur ' + r.status));
        err.statut = r.status; throw err;
      }
      return corps;
    }
    function garderSession(s) {
      session = { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user.id, email: s.user.email } };
      ecrireLS(CLE_SESSION, session);
    }
    async function jeton() {
      if (!session) return null;
      if (session.expires_at * 1000 - 60000 > Date.now()) return session.access_token;
      try {
        garderSession(await appel('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }));
        return session.access_token;
      } catch (e) {
        if (e.statut && e.statut < 500) { deconnecter(); messageErreur = 'Votre connexion a expiré. Reconnectez-vous avec votre adresse e-mail.'; }
        throw e;
      }
    }
    function deconnecter() { session = null; ecrireLS(CLE_SESSION, null); ecrireLS(CLE_DERNIERE, null); ecrireLS(CLE_BASE, null); etat = 'hors'; majBouton(); }

    /* ---------- la synchronisation elle-même ---------- */
    function contenuLocal() {
      const tout = stock.tout(), h = stock.horloge(), res = {};
      for (const [k, v] of Object.entries(tout)) if (!LOCAUX.has(k)) res[k] = { v, t: h[k] || 0 };
      return res;
    }
    async function synchroniser() {
      if (!disponible || !session) return false;
      if (enCours) { relance = true; return enCours; }
      enCours = (async () => {
        etat = 'envoi'; majBouton();
        let recu = false;
        try {
          const tok = await jeton();
          const lignes = await appel('/rest/v1/carnets?select=donnees,maj&user_id=eq.' + session.user.id, { method: 'GET' }, tok);
          const distant = (lignes && lignes[0] && lignes[0].donnees && lignes[0].donnees.cles) || {};
          const local = contenuLocal();
          const base = lireLS(CLE_BASE, {});
          const resultat = {}, nouvelleBase = {};
          let aEnvoyer = !lignes || !lignes.length;
          for (const k of new Set([...Object.keys(distant), ...Object.keys(local)])) {
            if (LOCAUX.has(k)) continue;
            const l = local[k], d = distant[k];
            let res;
            if (!d) { res = l; aEnvoyer = true; }
            else if (!l) { res = d; stock.appliquer(k, d.v, d.t); recu = true; }
            else if (egal(l.v, d.v)) res = { v: l.v, t: Math.max(l.t, d.t) };
            else {
              const v = fusion3(base[k], l.v, d.v, l.t >= d.t);
              const t = egal(v, d.v) ? d.t : Math.max(Date.now(), l.t, d.t + 1);
              res = { v, t };
              if (!egal(v, l.v)) { stock.appliquer(k, v, t); recu = true; }
              if (!egal(v, d.v)) aEnvoyer = true;
            }
            resultat[k] = res; nouvelleBase[k] = res.v;
          }
          const fusion = resultat;
          if (aEnvoyer) {
            await appel('/rest/v1/carnets?on_conflict=user_id', {
              method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
              body: JSON.stringify({ user_id: session.user.id, donnees: { cles: fusion }, maj: new Date().toISOString() })
            }, tok);
          }
          ecrireLS(CLE_BASE, nouvelleBase);
          ecrireLS(CLE_DERNIERE, Date.now());
          etat = 'ok'; messageErreur = '';
        } catch (e) {
          etat = session ? 'erreur' : 'hors';
          if (!messageErreur) messageErreur = navigator.onLine === false ? 'Pas de connexion Internet : vos modifications sont gardées dans l’appareil et partiront dès le retour du réseau.' : 'La synchronisation n’a pas abouti (' + e.message + '). Nouvel essai automatique dans un instant.';
        }
        majBouton();
        if (recu) rafraichirAffichage();
        return recu;
      })();
      try { return await enCours; } finally {
        enCours = null;
        if (relance) { relance = false; planifier(400); }
      }
    }
    function planifier(ms) { clearTimeout(minuterie); minuterie = setTimeout(synchroniser, ms); }

    // afficher les nouveautés reçues sans gêner une saisie en cours
    function rafraichirAffichage() {
      const actif = document.activeElement;
      const saisie = actif && actif.matches && actif.matches('input, textarea, select') && actif.closest('#page');
      if (saisie || document.querySelector('.plan-dialogue')) { montrerBandeau(); return; }
      rendre();
    }
    function montrerBandeau() {
      if (document.getElementById('bandeau-sync')) return;
      const b = document.createElement('div');
      b.id = 'bandeau-sync'; b.className = 'bandeau-sync'; b.setAttribute('role', 'status');
      b.innerHTML = '☁️ Des modifications faites sur un autre appareil sont arrivées. <button class="bouton" type="button">Afficher</button>';
      b.querySelector('button').addEventListener('click', () => { b.remove(); rendre(); });
      document.body.appendChild(b);
      window.addEventListener('hashchange', () => b.remove(), { once: true });
    }

    /* ---------- bouton dans la barre du haut ---------- */
    function majBouton() {
      const b = document.getElementById('sync-btn'), t = document.getElementById('sync-txt');
      if (!b) return;
      b.hidden = !disponible;
      b.classList.toggle('sync-erreur', etat === 'erreur');
      b.classList.toggle('sync-hors', etat === 'hors');
      t.textContent = etat === 'hors' ? 'Se connecter' : etat === 'envoi' ? 'Synchronisation…' : etat === 'erreur' ? 'Hors ligne' : 'Synchronisé';
      b.title = etat === 'ok' ? 'Vos données sont synchronisées entre vos appareils' : t.textContent;
      if (location.hash === '#compte' && document.getElementById('compte-etat')) majEtatCompte();
    }

    /* ---------- page « Synchronisation » ---------- */
    function heure(t) { if (!t) return 'jamais'; const d = new Date(t); return d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
    function majEtatCompte() {
      const z = document.getElementById('compte-etat'); if (!z) return;
      z.innerHTML = etat === 'envoi' ? '⏳ Synchronisation en cours…'
        : etat === 'erreur' ? '⚠️ ' + esc(messageErreur)
        : '✅ Synchronisé. Dernier échange : ' + heure(lireLS(CLE_DERNIERE, 0)) + '.';
    }
    PAGES.compte = c => {
      if (!disponible) {
        c.innerHTML = '<h1>Synchronisation</h1><div class="carte"><p>La synchronisation n’est pas encore réglée sur ce site.</p></div>';
        return;
      }
      if (session) {
        c.innerHTML = '<h1>Synchronisation</h1><section class="carte"><h2>☁️ Vos appareils sont reliés</h2>' +
          '<p>Connecté avec <b>' + esc(session.user.email) + '</b>.</p>' +
          '<p>Tout ce que vous saisissez ici est envoyé automatiquement, et les modifications faites sur vos autres appareils arrivent quand vous revenez sur le site.</p>' +
          '<p class="message" id="compte-etat" role="status"></p>' +
          '<div class="pp-actions"><button class="bouton" id="c-sync">🔄 Synchroniser maintenant</button><button class="bouton second" id="c-deco">Se déconnecter</button></div></section>' +
          '<section class="carte"><h2>Sur un autre appareil</h2><p>Ouvrez le site, touchez <b>☁️ Se connecter</b> en haut, et saisissez la même adresse e-mail. Vous recevrez un code, et votre carnet apparaîtra.</p></section>';
        majEtatCompte();
        c.querySelector('#c-sync').addEventListener('click', () => synchroniser());
        c.querySelector('#c-deco').addEventListener('click', () => app.confirmer('Se déconnecter sur cet appareil ?\nVos données restent dans l’appareil, mais ne seront plus synchronisées.', 'Se déconnecter', () => { deconnecter(); rendre(); }));
        return;
      }
      const email = lireLS(CLE_EMAIL, '');
      c.innerHTML = '<h1>Synchronisation</h1><section class="carte"><h2>☁️ Retrouver son carnet sur tous ses appareils</h2>' +
        '<p>Connectez-vous avec votre adresse e-mail. Votre plan, votre agenda, vos relevés, vos suivis et vos parterres seront les mêmes sur l’ordinateur, la tablette et le téléphone.</p>' +
        (messageErreur ? '<p class="alerte-bloc">' + esc(messageErreur) + '</p>' : '') +
        '<form id="f-email" class="form-compte"><label class="pp-champ">Adresse e-mail <input type="email" id="c-email" autocomplete="email" required value="' + esc(email) + '"></label>' +
        '<button class="bouton" type="submit">Recevoir mon code</button></form>' +
        '<form id="f-code" class="form-compte" hidden><p>Un code vient d’être envoyé à <b id="c-dest"></b>. Regardez vos e-mails (et les indésirables).</p>' +
        '<label class="pp-champ">Code reçu <input type="text" id="c-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" required></label>' +
        '<div class="pp-actions"><button class="bouton" type="submit">Valider</button><button class="bouton second" type="button" id="c-autre">Changer d’adresse</button></div></form>' +
        '<p class="message" id="c-msg" role="status"></p></section>' +
        '<section class="carte"><h2>Et mes données actuelles ?</h2><p>Elles sont conservées. À la première connexion, ce qui est déjà dans cet appareil est réuni avec ce qui est déjà en ligne : pour chaque partie (agenda, plan, relevés…), la version la plus récente est gardée.</p></section>';
      const fE = c.querySelector('#f-email'), fC = c.querySelector('#f-code'), msg = c.querySelector('#c-msg');
      let adresse = '';
      fE.addEventListener('submit', async e => {
        e.preventDefault();
        adresse = c.querySelector('#c-email').value.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(adresse)) { msg.textContent = 'Vérifiez l’adresse e-mail.'; return; }
        msg.textContent = 'Envoi du code…';
        try {
          await appel('/auth/v1/otp', { method: 'POST', body: JSON.stringify({ email: adresse, create_user: true }) });
          ecrireLS(CLE_EMAIL, adresse);
          fE.hidden = true; fC.hidden = false; c.querySelector('#c-dest').textContent = adresse; msg.textContent = '';
          c.querySelector('#c-code').focus();
        } catch (err) {
          msg.textContent = err.statut === 429 ? 'Trop de demandes de code en peu de temps. Patientez quelques minutes avant de réessayer.' : 'Le code n’a pas pu être envoyé : ' + err.message;
        }
      });
      c.querySelector('#c-autre').addEventListener('click', () => { fC.hidden = true; fE.hidden = false; msg.textContent = ''; });
      fC.addEventListener('submit', async e => {
        e.preventDefault();
        const code = c.querySelector('#c-code').value.replace(/\s/g, '');
        msg.textContent = 'Vérification…';
        try {
          garderSession(await appel('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type: 'email', email: adresse, token: code }) }));
          messageErreur = ''; etat = 'ok';
          msg.textContent = 'Connecté. Réunion de vos données…';
          await synchroniser();
          rendre();
        } catch (err) {
          msg.textContent = err.statut && err.statut < 500 ? 'Ce code n’est pas bon ou a expiré. Vérifiez-le, ou demandez-en un nouveau.' : 'La vérification n’a pas abouti : ' + err.message;
        }
      });
    };

    /* ---------- quand synchroniser ---------- */
    if (!disponible) { majBouton(); return; }
    stock.surModif(cle => { if (!LOCAUX.has(cle) && session) planifier(800); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') planifier(200); else if (session) synchroniser(); });
    window.addEventListener('online', () => planifier(200));
    window.addEventListener('focus', () => planifier(300));
    setInterval(() => { if (document.visibilityState === 'visible') synchroniser(); }, 30000);
    // en changeant de page, on vérifie s'il y a du nouveau (au plus toutes les 10 secondes)
    window.addEventListener('hashchange', () => { if (session && Date.now() - lireLS(CLE_DERNIERE, 0) > 10000) planifier(150); });
    setTimeout(majBouton, 0);
    if (session) planifier(100);
  });
})();
