// ─────────────────────────────────────────────
// RISK VALUE — Estimation $ à risque par convo
// Priorité : cart_value > confirmed_budget > fallback catégorie
// ─────────────────────────────────────────────

const FALLBACK_BY_CATEGORY = {
  'matelas':           400,
  'sofa':              900,
  'sectionnel':        900,
  'sofa-lit':          900,
  'lit':               500,
  'chambre':           1500,
  'bedroom set':       1500,
  'set chambre':       1500,
  'salle a manger':    900,
  'salle à manger':    900,
  'salon':             900,
  'salon set':         1200
};

/**
 * Estime la valeur en $ d'une opportunité.
 * @param {Object} convo - record CONVERSATIONS (depuis /api/data/convos)
 * @returns {number} - valeur en $ (entier)
 */
export function estimateRiskValue(convo) {
  // 1. cart_value si > 0
  if (typeof convo.cart_value === 'number' && convo.cart_value > 0) {
    return Math.round(convo.cart_value);
  }
  
  // 2. confirmed_budget si > 0
  const budget = typeof convo.confirmed_budget === 'number'
    ? convo.confirmed_budget
    : parseFloat(convo.confirmed_budget);
  if (!isNaN(budget) && budget > 0) {
    return Math.round(budget);
  }
  
  // 3. Fallback catégorie
  const category = (convo.confirmed_category || '').toLowerCase().trim();
  if (FALLBACK_BY_CATEGORY[category]) {
    return FALLBACK_BY_CATEGORY[category];
  }
  
  return 0;
}
