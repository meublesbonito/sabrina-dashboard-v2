// ─────────────────────────────────────────────
// SIGNAL ROW — Lot 7.2
// Render a single SIGNAUX row with type, gravité, description, suggestion,
// "Voir convo" button (if psid set), and a toggle "✓ Marquer traité".
// Read-only display + 2 callbacks (no business logic here).
// ─────────────────────────────────────────────

/**
 * @param {Object} sig - record from /api/data/signals
 *   Shape: { id, signalId, psid, conversationRecordId, type, gravite,
 *            description, extraitConvo, suggestion, dateDetection,
 *            dateDetectionRaw, lastSeenAt, lastSeenAtRaw, traite (boolean) }
 * @param {Object} callbacks
 *   - onToggleTraite(sig, btn)
 *   - onViewConvo(sig)
 * @returns {HTMLElement}
 */
export function renderSignalRow(sig, callbacks = {}) {
  const row = document.createElement('div');
  const grav = String(sig.gravite || 'low').toLowerCase();
  row.className = `health-row health-row--signal health-row--grav-${grav} ${sig.traite ? 'health-row--resolved' : ''}`;
  row.dataset.id = sig.id;

  // ─── Line 1: gravité · type · ago ───
  const line1 = document.createElement('div');
  line1.className = 'health-row-head';

  const gravBadge = document.createElement('span');
  gravBadge.className = `health-row-grav health-row-grav--${grav}`;
  gravBadge.textContent = String(sig.gravite || 'LOW').toUpperCase();
  line1.appendChild(gravBadge);

  const type = document.createElement('span');
  type.className = 'health-row-type';
  type.textContent = sig.type || 'unknown';
  line1.appendChild(type);

  const ago = formatRelativeTime(sig.dateDetection);
  if (ago) {
    const t = document.createElement('span');
    t.className = 'health-row-ago';
    t.textContent = ago;
    line1.appendChild(t);
  }

  row.appendChild(line1);

  // ─── Line 2: description ───
  if (sig.description) {
    const desc = document.createElement('div');
    desc.className = 'health-row-message';
    desc.textContent = sig.description;
    row.appendChild(desc);
  }

  // ─── Line 3: suggestion ───
  if (sig.suggestion) {
    const sug = document.createElement('div');
    sug.className = 'health-row-suggestion';
    sug.textContent = `→ ${sig.suggestion}`;
    row.appendChild(sug);
  }

  // ─── Line 4: PSID + actions ───
  const actions = document.createElement('div');
  actions.className = 'health-row-actions';

  if (sig.psid) {
    const psid = document.createElement('span');
    psid.className = 'health-row-psid';
    psid.textContent = `PSID ${sig.psid}`;
    actions.appendChild(psid);
  }

  if ((sig.conversationRecordId || sig.psid) && typeof callbacks.onViewConvo === 'function') {
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'btn-action btn-view';
    viewBtn.textContent = '👁 Voir convo';
    viewBtn.addEventListener('click', () => callbacks.onViewConvo(sig));
    actions.appendChild(viewBtn);
  }

  if (typeof callbacks.onToggleTraite === 'function') {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = sig.traite
      ? 'btn-action btn-toggle-untreat'
      : 'btn-action btn-toggle-treat';
    toggleBtn.textContent = sig.traite
      ? '↻ Marquer non-traité'
      : '✓ Marquer traité';
    toggleBtn.dataset.role = 'toggle';
    toggleBtn.addEventListener('click', () => callbacks.onToggleTraite(sig, toggleBtn));
    actions.appendChild(toggleBtn);
  }

  row.appendChild(actions);
  return row;
}

function formatRelativeTime(iso) {
  if (!iso) return null;
  let ts;
  try { ts = new Date(iso).getTime(); } catch { return null; }
  if (isNaN(ts)) return null;
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return "à l'instant";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}
