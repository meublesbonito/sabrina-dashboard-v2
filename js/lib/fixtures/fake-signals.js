// ─────────────────────────────────────────────
// FAKE SIGNALS — Datasets de test pour Lot 4
// ─────────────────────────────────────────────

export const FAKE_SIGNALS = [
  // Signal opportunity sur Cas 1 (avec téléphone) → CALL_NOW
  {
    id: 'recSIG1',
    signalId: 'recSIG1',
    psid: 'psid_case1',
    type: 'opportunity',
    gravite: 'haute',
    description: 'Client donne son numéro et exprime intention achat sofa direct',
    suggestion: 'Appeler dans les 30 min',
    traite: false
  },
  
  // Signal broken sur Cas 4 → BOT_BLOCKED
  {
    id: 'recSIG2',
    signalId: 'recSIG2',
    psid: 'psid_case4',
    type: 'broken',
    gravite: 'moyenne',
    description: 'Sabrina répète la même question 3 fois sans comprendre la demande client',
    suggestion: 'Reprendre la main et terminer la commande manuellement',
    traite: false
  },
  
  // Signal opportunity sur Cas 7 (sans téléphone après filter) → MESSENGER_FOLLOWUP
  {
    id: 'recSIG3',
    signalId: 'recSIG3',
    psid: 'psid_case7',
    type: 'opportunity',
    gravite: 'moyenne',
    description: 'Intention achat exprimée mais pas de téléphone client utilisable',
    suggestion: 'Relancer en Messenger pour obtenir le numéro',
    traite: false
  }
];
