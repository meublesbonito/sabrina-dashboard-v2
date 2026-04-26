// ─────────────────────────────────────────────
// ACTION SHAPE — Standard data structure
// Verrouille la structure pour Lot 4/5/6/7
// ─────────────────────────────────────────────

// Types d'actions (ordre = priorité business)
export const ACTION_TYPES = {
  CALL_NOW: 'call_now',                       // 1. Achat immédiat (téléphone + intention)
  FRUSTRATED: 'frustrated',                    // 2. Client frustré/hostile
  COD_CONFIRM: 'cod_confirm',                  // 3. COD à confirmer
  BOT_BLOCKED: 'bot_blocked',                  // 4. Sabrina bloquée (boucle/incompréhension)
  ABANDONED_CART: 'abandoned_cart',            // 5. Panier abandonné
  FOLLOWUP_DUE: 'followup_due',                // 6. Rappel échu après called_no_answer
  MESSENGER_FOLLOWUP: 'messenger_followup'     // 7. Relance Messenger (opportunité sans téléphone)
};

// Niveaux de priorité (mappés aux couleurs SLA)
export const PRIORITIES = {
  CRITICAL: 'critical',  // Rouge
  HIGH: 'high',          // Orange
  MEDIUM: 'medium',      // Jaune
  LOW: 'low'             // Gris
};

// Statuts (alignés avec Airtable traite_status)
export const STATUSES = {
  OPEN: 'open',
  DONE: 'done',
  CALLED_NO_ANSWER: 'called_no_answer',
  CONVERTED: 'converted',
  LOST: 'lost'
};

// Labels FR pour affichage
export const ACTION_TYPE_LABELS = {
  call_now: 'À appeler',
  frustrated: 'Client frustré',
  cod_confirm: 'COD à confirmer',
  bot_blocked: 'Sabrina bloquée',
  abandoned_cart: 'Panier abandonné',
  followup_due: 'Rappel à faire',
  messenger_followup: 'Relance Messenger'
};

/**
 * Valide qu'une action a les champs minimums requis.
 * Souple : warning console, pas crash.
 */
export function validateAction(action) {
  if (!action || typeof action !== 'object') {
    console.warn('[Action] Not an object:', action);
    return false;
  }
  
  const required = ['id', 'clientName', 'priority', 'actionType', 'status'];
  const missing = required.filter(k => action[k] === undefined || action[k] === null);
  
  if (missing.length) {
    console.warn('[Action] Missing required fields:', missing, action);
    return false;
  }
  
  if (!Object.values(PRIORITIES).includes(action.priority)) {
    console.warn('[Action] Invalid priority:', action.priority);
  }
  
  if (!Object.values(ACTION_TYPES).includes(action.actionType)) {
    console.warn('[Action] Invalid actionType:', action.actionType);
  }
  
  return true;
}

/**
 * Crée une action fake pour tests / mode demo.
 */
export function createFakeAction(overrides = {}) {
  const now = Date.now();
  const waitMinutes = overrides.waitMinutes ?? 47;
  return {
    id: 'rec' + Math.random().toString(36).slice(2, 10).toUpperCase(),
    psid: '12345678901234',
    clientName: 'Marie Tremblay',
    phone: '4385551234',
    value: 1200,
    priority: PRIORITIES.CRITICAL,
    actionType: ACTION_TYPES.CALL_NOW,
    reason: 'Téléphone détecté + intention achat',
    lastMessage: 'Oui je le prends, donne-moi le lien',
    lastMessageAt: new Date(now - waitMinutes * 60000).toISOString(),
    waitMinutes,
    businessSuiteUrl: 'https://business.facebook.com/latest/inbox/all/',
    status: STATUSES.OPEN,
    ...overrides
  };
}

/**
 * Helper formattage téléphone : "4385551234" → "438-555-1234"
 */
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Helper formattage monétaire : 1200 → "1 200 $"
 */
export function formatMoney(value) {
  if (!value || isNaN(value)) return '— $';
  return new Intl.NumberFormat('fr-CA', {
    style: 'decimal',
    maximumFractionDigits: 0
  }).format(value) + ' $';
}

/**
 * Helper formattage temps : 47 → "47 min" / 125 → "2h05"
 */
export function formatWaitTime(minutes) {
  if (!minutes || minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${h}h`;
}
