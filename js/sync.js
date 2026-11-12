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
      const icone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
      c.innerHTML = '<h1>Synchronisation</h1><section class="carte"><h2>☁️ Retrouver son carnet sur tous ses appareils</h2>' +
        '<p>Connectez-vous avec votre adresse e-mail. Votre plan, votre agenda, vos relevés, vos suivis et vos parterres seront les mêmes sur l’ordinateur, la tablette et le téléphone.</p>' +
        (messageErreur ? '<p class="alerte-bloc">' + esc(messageErreur) + '</p>' : '') +
        '<form id="f-email" class="form-compte"><label class="pp-champ">Adresse e-mail <input type="email" id="c-email" autocomplete="email" required value="' + esc(email) + '"></label>' +
        '<button class="bouton" type="submit">Recevoir le lien de connexion</button></form>' +
        '<div id="c-envoye" class="lien-envoye" hidden><p><b>📧 C’est parti !</b> Un e-mail intitulé <b>« Your sign-in link »</b> vient d’être envoyé à <b id="c-dest"></b>.</p>' +
        '<ol><li>Ouvrez cet e-mail <b>sur cet appareil-ci</b> (regardez aussi dans les indésirables).</li><li>Touchez le lien <b>« Sign in »</b>.</li><li>Le site s’ouvre et votre carnet se synchronise tout seul.</li></ol>' +
        '<p class="m-sous">Le lien n’est valable qu’une heure et une seule fois. Pas reçu ? Patientez quelques minutes avant d’en redemander un : l’envoi est limité à quelques e-mails par heure.</p>' +
        '<button class="bouton second" type="button" id="c-autre">Renvoyer ou changer d’adresse</button></div>' +
        '<p class="message" id="c-msg" role="status"></p></section>' +
        '<section class="carte' + (icone ? ' carte-icone' : '') + '" id="c-coller"><h2>📱 ' + (icone ? 'Vous êtes dans l’icône de l’écran d’accueil' : 'Site ouvert depuis l’icône de l’écran d’accueil ?') + '</h2>' +
        '<p>Sur iPhone et iPad, l’icône garde ses propres données et le lien de l’e-mail s’ouvrirait dans Safari. Faites plutôt ceci :</p>' +
        '<ol><li>Demandez le lien ci-dessus.</li><li>Dans l’e-mail, <b>restez appuyé</b> sur « Sign in » puis choisissez <b>Copier le lien</b>.</li><li>Revenez ici, collez-le dans la case et touchez <b>Me connecter</b>.</li></ol>' +
        '<form id="f-lien" class="form-compte"><label class="pp-champ">Lien « Sign in » copié <input type="text" id="c-lien" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://…supabase.co/auth/v1/verify?token=…"></label>' +
        '<button class="bouton" type="submit">Me connecter</button></form><p class="message" id="c-msg2" role="status"></p></section>' +
        '<section class="carte"><h2>Et mes données actuelles ?</h2><p>Elles sont conservées. À la première connexion, ce qui est déjà dans cet appareil est réuni avec ce qui est déjà en ligne, sans rien perdre.</p>' +
        '</section>';
      const fE = c.querySelector('#f-email'), zEnv = c.querySelector('#c-envoye'), msg = c.querySelector('#c-msg');
      fE.addEventListener('submit', async e => {
        e.preventDefault();
        const adresse = c.querySelector('#c-email').value.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(adresse)) { msg.textContent = 'Vérifiez l’adresse e-mail.'; return; }
        msg.textContent = 'Envoi du lien…';
        try {
          await appel('/auth/v1/otp?redirect_to=' + encodeURIComponent(adresseRetour()), { method: 'POST', body: JSON.stringify({ email: adresse, create_user: true }) });
          ecrireLS(CLE_EMAIL, adresse); messageErreur = '';
          fE.hidden = true; zEnv.hidden = false; c.querySelector('#c-dest').textContent = adresse; msg.textContent = '';
        } catch (err) {
          msg.textContent = err.statut === 429 ? 'Trop de demandes en peu de temps. Patientez quelques minutes avant de réessayer (l’envoi est limité à quelques e-mails par heure).' : 'Le lien n’a pas pu être envoyé : ' + err.message;
        }
      });
      c.querySelector('#c-autre').addEventListener('click', () => { zEnv.hidden = true; fE.hidden = false; msg.textContent = ''; });
      c.querySelector('#f-lien').addEventListener('submit', async e => {
        e.preventDefault();
        const m2 = c.querySelector('#c-msg2');
        m2.textContent = 'Connexion…';
        try { await connecterParLien(c.querySelector('#c-lien').value.trim()); rendre(); }
        catch (err) { m2.textContent = err.message; }
      });
    };

    // lien de l'e-mail collé à la main : on le valide directement auprès de Supabase, sans passer par Safari
    async function connecterParLien(texte) {
      let u;
      try { u = new URL(texte); } catch (e) { throw new Error('Ce texte n’est pas un lien. Restez appuyé sur « Sign in » dans l’e-mail et choisissez « Copier le lien ».'); }
      const h = new URLSearchParams(u.hash.replace(/^#/, ''));
      let s;
      if (h.get('access_token')) {
        const usr = await appel('/auth/v1/user', { method: 'GET' }, h.get('access_token'));
        s = { access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_in: +h.get('expires_in') || 3600, user: usr };
      } else {
        const jeton = u.searchParams.get('token') || u.searchParams.get('token_hash');
        if (!jeton) throw new Error('Ce lien ne contient pas de connexion. Copiez bien le lien « Sign in » de l’e-mail « Your sign-in link ».');
        const type = u.searchParams.get('type') || 'magiclink';
        try { s = await appel('/auth/v1/verify', { method: 'POST', body: JSON.stringify({ type, token_hash: jeton }) }); }
        catch (err) { throw new Error(err.statut && err.statut < 500 ? 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau et collez-le sans l’ouvrir.' : 'La connexion n’a pas abouti : ' + err.message); }
      }
      garderSession(s); messageErreur = ''; etat = 'ok'; majBouton();
      await synchroniser();
    }

    /* ---------- retour depuis le lien « Sign in » de l'e-mail ----------
       Supabase renvoie vers le site avec la connexion dans l'adresse (#access_token=…). */
    function adresseRetour() { return location.origin + location.pathname.replace(/[^/]*$/, '') + 'accueil.html'; }
    function retourDuLien() {
      const h = location.hash.replace(/^#/, '');
      if (!/(^|&)(access_token|error_description|error)=/.test(h)) return false;
      const p = new URLSearchParams(h);
      try { history.replaceState(null, '', location.pathname + location.search + '#compte'); } catch (e) { location.hash = 'compte'; }
      if (p.get('error') || p.get('error_description')) {
        messageErreur = /expired|invalid/i.test(p.get('error_description') || p.get('error_code') || '') ? 'Ce lien de connexion a expiré ou a déjà servi. Demandez-en un nouveau ci-dessous.' : 'La connexion n’a pas abouti : ' + (p.get('error_description') || p.get('error'));
        return true;
      }
      const jt = p.get('access_token');
      etat = 'envoi';
      appel('/auth/v1/user', { method: 'GET' }, jt).then(u => {
        garderSession({ access_token: jt, refresh_token: p.get('refresh_token'), expires_in: +p.get('expires_in') || 3600, expires_at: +p.get('expires_at') || 0, user: u });
        messageErreur = ''; etat = 'ok'; majBouton();
        return synchroniser();
      }).then(() => rendre()).catch(err => { etat = 'hors'; messageErreur = 'La connexion n’a pas abouti : ' + err.message; majBouton(); rendre(); });
      return true;
    }

    /* ---------- quand synchroniser ---------- */
    if (!disponible) { majBouton(); return; }
    retourDuLien();
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
