// ─────────────────────────────────────────────
// DEDUPE — 1 PSID = 1 action (la plus urgente)
// ─────────────────────────────────────────────

import { priorityRank } from './priorities.js';

/**
 * Déduplique un array d'actions par psid.
 * Garde celle avec :
 *   1. La priorité la plus haute (rank le plus bas)
 *   2. À priorité égale, le waitMinutes le plus grand
 *
 * @param {Array<Action>} actions
 * @returns {Array<Action>}
 */
export function dedupeByPsid(actions) {
  const byPsid = new Map();
  
  for (const action of actions) {
    if (!action || !action.psid) continue;
    
    const existing = byPsid.get(action.psid);
    if (!existing) {
      byPsid.set(action.psid, action);
      continue;
    }
    
    const newRank = priorityRank(action.priority);
    const existingRank = priorityRank(existing.priority);
    
    if (newRank < existingRank) {
      // Plus urgent → on remplace
      byPsid.set(action.psid, action);
    } else if (newRank === existingRank) {
      // Égalité → garder le plus vieux (attend le plus longtemps)
      const newWait = action.waitMinutes || 0;
      const existingWait = existing.waitMinutes || 0;
      if (newWait > existingWait) {
        byPsid.set(action.psid, action);
      }
    }
  }
  
  return Array.from(byPsid.values());
}
