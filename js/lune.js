/* Calculs lunaires biodynamiques — portage du module calendrier_lunaire.py
   (Maria Thun : constellations réelles, nœuds, périgée, apogée).
   Utilise la bibliothèque astronomy-engine à la place d'ephem. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.Lune = factory(root.Astronomy);
})(this, function (A) {
  'use strict';

  const CONSTELLATIONS = [
    [0, 29, 'Poissons'], [29, 57, 'Bélier'], [57, 90, 'Taureau'], [90, 118, 'Gémeaux'],
    [118, 138, 'Cancer'], [138, 174, 'Lion'], [174, 218, 'Vierge'], [218, 242, 'Balance'],
    [242, 270, 'Scorpion'], [270, 302, 'Sagittaire'], [302, 328, 'Capricorne'],
    [328, 351, 'Verseau'], [351, 360, 'Poissons']
  ];
  const TYPE_PAR_CONSTELLATION = {
    'Bélier': 'Fruits', 'Taureau': 'Racines', 'Gémeaux': 'Fleurs', 'Cancer': 'Feuilles',
    'Lion': 'Fruits', 'Vierge': 'Racines', 'Balance': 'Fleurs', 'Scorpion': 'Feuilles',
    'Sagittaire': 'Fruits', 'Capricorne': 'Racines', 'Verseau': 'Fleurs', 'Poissons': 'Feuilles'
  };
  const AU_KM = 149597870.7;
  const ROT = A.Rotation_EQJ_ECL();

  // date "jour" = {y, m, d} ; heures en UTC comme dans l'application d'origine
  function utc(j, h, mi, s) { return new Date(Date.UTC(j.y, j.m - 1, j.d, h || 0, mi || 0, s || 0)); }
  function ajouterJours(j, n) {
    const t = new Date(Date.UTC(j.y, j.m - 1, j.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }
  function eclJ2000(body, date) {
    const v = body === 'Moon' ? A.GeoMoon(date) : A.GeoVector(A.Body.Sun, date, true);
    const s = A.SphereFromVector(A.RotateVector(ROT, v));
    return { lon: ((s.lon % 360) + 360) % 360, lat: s.lat, dist: s.dist };
  }
  function constellationDepuisLongitude(lon) {
    for (const [a, b, c] of CONSTELLATIONS) if (a <= lon && lon < b) return c;
    return 'Poissons';
  }
  function constellationLune(j) { return constellationDepuisLongitude(eclJ2000('Moon', utc(j, 11)).lon); }
  function constellationSoleil(j) {
    const c = constellationDepuisLongitude(eclJ2000('Sun', utc(j, 11)).lon);
    return [c, TYPE_PAR_CONSTELLATION[c] || 'Inconnu'];
  }
  function typeJour(c) { return TYPE_PAR_CONSTELLATION[c] || 'Inconnu'; }
  function illumination(date) { return A.Illumination(A.Body.Moon, date).phase_fraction * 100; }

  function phaseLunaire(j) {
    const p = illumination(utc(j, 11));
    const croissante = illumination(utc(ajouterJours(j, 1), 11)) >= p;
    if (p < 2) return '🌑 Nouvelle lune';
    if (p < 45 && croissante) return '🌒 Lune croissante';
    if (p >= 45 && p < 55 && croissante) return '🌓 Premier quartier';
    if (p >= 55 && croissante && p < 98) return '🌔 Lune gibbeuse croissante';
    if (p >= 98) return '🌕 Pleine lune';
    if (p >= 55 && !croissante) return '🌖 Lune gibbeuse décroissante';
    if (p >= 45 && p < 55) return '🌗 Dernier quartier';
    return '🌘 Lune décroissante';
  }

  const FMT_HEURE = (typeof Intl !== 'undefined')
    ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  function heureLocale(date) { return FMT_HEURE.format(date); }

  const NOMS_QUARTIERS = [['🌑', 'Nouvelle lune'], ['🌓', 'Premier quartier'], ['🌕', 'Pleine lune'], ['🌗', 'Dernier quartier']];
  function heuresPhasesDuJour(j) {
    const debut = utc(j, 0), fin = utc(j, 23, 59, 59);
    const res = [];
    let q = A.SearchMoonQuarter(new Date(debut.getTime() - 86400000 * 8));
    for (let k = 0; k < 6; k++) {
      const t = q.time.date;
      if (t > fin) break;
      if (t >= debut) res.push([NOMS_QUARTIERS[q.quarter][0], NOMS_QUARTIERS[q.quarter][1], heureLocale(t)]);
      q = A.NextMoonQuarter(q);
    }
    return res;
  }

  function leverCoucher(j, ville) {
    try {
      const obs = new A.Observer(ville.lat, ville.lon, ville.elev || 0);
      const t0 = utc(j, 0);
      const lev = A.SearchRiseSet(A.Body.Moon, obs, +1, t0, 2);
      const cou = A.SearchRiseSet(A.Body.Moon, obs, -1, t0, 2);
      return [lev ? heureLocale(lev.date) : '--:--', cou ? heureLocale(cou.date) : '--:--'];
    } catch (e) { return ['--:--', '--:--']; }
  }

  function distanceKm(j) { return eclJ2000('Moon', utc(j, 11)).dist * AU_KM; }

  function evenementsSpeciaux(j) {
    const ev = [];
    const lats = [];
    for (let h = 0; h < 24; h += 2) lats.push(eclJ2000('Moon', utc(j, h)).lat);
    for (let i = 0; i < lats.length - 1; i++) {
      if (lats[i] < 0 && lats[i + 1] >= 0) { ev.push('☊ Nœud ascendant — jour défavorable'); break; }
      if (lats[i] > 0 && lats[i + 1] <= 0) { ev.push('☋ Nœud descendant — jour défavorable'); break; }
    }
    const d = [-2, -1, 0, 1, 2].map(n => distanceKm(ajouterJours(j, n)));
    const km = Math.round(d[2]).toLocaleString('en-US').replace(/,/g, ' ');
    if (d[2] < d[0] && d[2] < d[1] && d[2] < d[3] && d[2] < d[4]) ev.push('🔴 Périgée (' + km + ' km) — jour défavorable');
    else if (d[2] > d[0] && d[2] > d[1] && d[2] > d[3] && d[2] > d[4]) ev.push('🔵 Apogée (' + km + ' km) — jour défavorable');
    return ev;
  }

  function infosJour(j, ville, complet) {
    const constellation = constellationLune(j);
    const r = {
      date: j, phase: phaseLunaire(j), type: typeJour(constellation), constellation,
      evenements: evenementsSpeciaux(j)
    };
    if (complet !== false) {
      r.heuresPhases = heuresPhasesDuJour(j);
      [r.lever, r.coucher] = leverCoucher(j, ville);
      [r.constSoleil, r.typeSoleil] = constellationSoleil(j);
    }
    return r;
  }

  function nbJoursMois(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function calendrierMensuel(y, m, ville) {
    const res = [];
    for (let d = 1; d <= nbJoursMois(y, m); d++) res.push(infosJour({ y, m, d }, ville));
    return res;
  }
  function estFavorable(r) {
    return r.evenements.length === 0 && !r.phase.includes('Nouvelle lune') && !r.phase.includes('Pleine lune');
  }
  function meilleursJours(y, m, ville) {
    const res = { Racines: [], Feuilles: [], Fleurs: [], Fruits: [] };
    for (const r of calendrierMensuel(y, m, ville)) if (estFavorable(r) && res[r.type]) res[r.type].push(r);
    return res;
  }
  function prochainsJoursIdeaux(type, depuis, nbJours, nbResultats) {
    const res = [];
    let j = depuis;
    for (let k = 0; k < (nbJours || 60); k++) {
      const r = infosJour(j, null, false);
      if (r.type === type && estFavorable(r)) {
        res.push(r);
        if (res.length >= (nbResultats || 8)) break;
      }
      j = ajouterJours(j, 1);
    }
    return res;
  }

  return {
    CONSTELLATIONS, TYPE_PAR_CONSTELLATION, ajouterJours, eclJ2000, illumination,
    constellationLune, constellationSoleil, typeJour, phaseLunaire, heuresPhasesDuJour,
    leverCoucher, evenementsSpeciaux, infosJour, calendrierMensuel, meilleursJours,
    prochainsJoursIdeaux, estFavorable, nbJoursMois
  };
});
