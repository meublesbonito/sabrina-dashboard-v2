// ─────────────────────────────────────────────
// QUEUE MANAGER — État + auto-refresh + optimistic UI
// ─────────────────────────────────────────────

import { api } from './api.js';
import { buildActionQueue } from './build-action-queue.js';

const REFRESH_INTERVAL_MS = 120_000; // 2 minutes

const state = {
  queue: [],
  lastFetchedAt: null,
  isFetching: false,
  pendingActions: new Set(),
  listeners: new Set(),
  _error: null
};

let refreshTimer = null;
let isTabActive = !document.hidden;

// ─── Public API ───

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

export function getQueue() {
  return state.queue;
}

export function getLastFetchedAt() {
  return state.lastFetchedAt;
}

export function isPending(actionId) {
  return state.pendingActions.has(actionId);
}

export function pendingCount() {
  return state.pendingActions.size;
}

/**
 * Charge convos + signals depuis API et reconstruit la queue.
 */
export async function refreshNow() {
  if (state.isFetching) return;
  if (state.pendingActions.size > 0) {
    console.log('[Queue] Skip refresh (pending actions)');
    return;
  }
  
  state.isFetching = true;
  notifyListeners();
  
  try {
    const [convosRes, signalsRes] = await Promise.all([
      api.getConvos({ limit: 200 }),
      api.getSignals({ limit: 200 })
    ]);
    
    if (!convosRes.ok) throw new Error(convosRes.error || 'Erreur convos');
    if (!signalsRes.ok) throw new Error(signalsRes.error || 'Erreur signals');
    
    const queue = buildActionQueue({
      convos: convosRes.data || [],
      signals: signalsRes.data || [],
      errors: []
    });
    
    state.queue = queue;
    state.lastFetchedAt = new Date();
    state._error = null;
  } catch (err) {
    console.error('[Queue] Refresh error:', err);
    state._error = err.message || 'Erreur de chargement';
  } finally {
    state.isFetching = false;
    notifyListeners();
  }
}

/**
 * Action optimiste : retire la ligne, POST en arrière-plan, rollback si échec.
 */
export async function performAction(action, payload) {
  if (state.pendingActions.has(action.id)) {
    return { ok: false, error: 'Action déjà en cours' };
  }
  
  state.pendingActions.add(action.id);
  
  // Optimistic : retirer de la queue affichée
  const indexBefore = state.queue.findIndex(a => a.id === action.id);
  if (indexBefore !== -1) {
    state.queue = state.queue.filter(a => a.id !== action.id);
    notifyListeners();
  }
  
  try {
    const res = await api.updateAction(action.id, payload);
    
    if (!res.ok) {
      // Rollback : remettre la ligne
      if (indexBefore !== -1) {
        const newQueue = [...state.queue];
        newQueue.splice(Math.min(indexBefore, newQueue.length), 0, action);
        state.queue = newQueue;
        notifyListeners();
      }
      return { ok: false, error: res.error || 'Erreur serveur' };
    }
    
    return { ok: true };
  } catch (err) {
    // Rollback
    if (indexBefore !== -1) {
      const newQueue = [...state.queue];
      newQueue.splice(Math.min(indexBefore, newQueue.length), 0, action);
      state.queue = newQueue;
      notifyListeners();
    }
    return { ok: false, error: err.message || 'Erreur réseau' };
  } finally {
    state.pendingActions.delete(action.id);
    notifyListeners();
  }
}

/**
 * Démarre l'auto-refresh.
 */
export function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    if (isTabActive && state.pendingActions.size === 0) {
      refreshNow();
    }
  }, REFRESH_INTERVAL_MS);
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

export function stopAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
  document.removeEventListener('visibilitychange', handleVisibilityChange);
}

// ─── Internals ───

function handleVisibilityChange() {
  isTabActive = !document.hidden;
  if (isTabActive) refreshNow();
}

function notifyListeners() {
  for (const fn of state.listeners) {
    try {
      fn({
        queue: state.queue,
        isLoading: state.isFetching,
        error: state._error || null,
        lastFetchedAt: state.lastFetchedAt
      });
    } catch (e) {
      console.error('[Queue listener]', e);
    }
  }
}
