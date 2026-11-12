/* Réglages de la synchronisation entre appareils (projet Supabase de Papy la Binette).
   Ces deux valeurs sont publiques par nature : elles identifient le projet,
   et les règles de la base empêchent chacun de lire le carnet des autres. */
window.PAPY_SYNC = {
  url: '',  // adresse du projet, par exemple https://abcdefgh.supabase.co
  cle: ''   // clé « anon public » ou « publishable »
};
