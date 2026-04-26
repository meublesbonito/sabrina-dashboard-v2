// ─────────────────────────────────────────────
// PRIORITIES — Mapping actionType → priority
// + escalation par temps d'attente
// ─────────────────────────────────────────────

import { ACTION_TYPES, PRIORITIES } from './action-shape.js';

/**
 * Priorité de base selon actionType.
 */
export function basePriority(actionType) {
  switch (actionType) {
    case ACTION_TYPES.CALL_NOW:           return PRIORITIES.CRITICAL;
    case ACTION_TYPES.FRUSTRATED:         return PRIORITIES.CRITICAL;
    case ACTION_TYPES.FOLLOWUP_DUE:       return PRIORITIES.HIGH;
    case ACTION_TYPES.COD_CONFIRM:        return PRIORITIES.HIGH;
    case ACTION_TYPES.BOT_BLOCKED:        return PRIORITIES.MEDIUM;
    case ACTION_TYPES.MESSENGER_FOLLOWUP: return PRIORITIES.MEDIUM;
    case ACTION_TYPES.ABANDONED_CART:     return PRIORITIES.LOW;
    default:                               return PRIORITIES.LOW;
  }
}

/**
 * Escalade la priorité si l'attente est très longue.
 * Règle : >= 120 minutes upgrade d'un niveau.
 * Exception : ABANDONED_CART ne s'escalade pas (un vieux panier n'est pas plus urgent).
 */
export function applyTimeEscalation(priority, waitMinutes, actionType) {
  if (actionType === ACTION_TYPES.ABANDONED_CART) return priority;
  if (!waitMinutes || waitMinutes < 120) return priority;
  
  if (priority === PRIORITIES.LOW)    return PRIORITIES.MEDIUM;
  if (priority === PRIORITIES.MEDIUM) return PRIORITIES.HIGH;
  return priority; // HIGH et CRITICAL ne montent pas plus haut
}

/**
 * Upgrade priorité MESSENGER_FOLLOWUP si le signal est de gravité haute.
 */
export function applySignalGraviteEscalation(priority, signal) {
  if (!signal) return priority;
  const g = String(signal.gravite || '').toLowerCase();
  if (['haute', 'high', 'critique', 'critical'].includes(g)) {
    if (priority === PRIORITIES.MEDIUM) return PRIORITIES.HIGH;
    if (priority === PRIORITIES.LOW)    return PRIORITIES.MEDIUM;
  }
  return priority;
}

/**
 * Numérique pour tri (CRITICAL = 0 = en haut)
 */
export function priorityRank(priority) {
  return { critical: 0, high: 1, medium: 2, low: 3 }[priority] ?? 3;
}
