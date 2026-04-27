// ─────────────────────────────────────────────
// ERROR ROW — Lot 7.2
// Render a single tblErrors row with metadata, "Voir convo" button (if
// linked), and a toggle "✓ Marquer traité" / "↻ Marquer non-traité".
// Read-only display + 2 callbacks (no business logic here).
// ─────────────────────────────────────────────

const MAX_MESSAGE_CHARS = 280;

/**
 * @param {Object} err - record from /api/data/errors
 *   Shape: { id, psid, moduleId, errorType, errorMessage, timestamp,
 *            timestampRaw, resolved (boolean), conversationRecordId }
 * @param {Object} callbacks
 *   - onToggleResolved(err): called when the toggle button is clicked
 *   - onViewConvo(err): called when the "Voir convo" button is clicked
 * @returns {HTMLElement}
 */
export function renderErrorRow(err, callbacks = {}) {
  const row = document.createElement('div');
  row.className = `health-row health-row--error ${err.resolved ? 'health-row--resolved' : ''}`;
  row.dataset.id = err.id;

  // ─── Line 1: type · module · ago ───
  const line1 = document.createElement('div');
  line1.className = 'health-row-head';

  const type = document.createElement('span');
  type.className = 'health-row-type';
  type.textContent = err.errorType || 'unknown';
  line1.appendChild(type);

  if (err.moduleId) {
    const mod = document.createElement('span');
    mod.className = 'health-row-module';
    mod.textContent = err.moduleId;
    line1.appendChild(mod);
  }

  const ago = formatRelativeTime(err.timestamp);
  if (ago) {
    const t = document.createElement('span');
    t.className = 'health-row-ago';
    t.textContent = ago;
    line1.appendChild(t);
  }

  row.appendChild(line1);

  // ─── Line 2: error message ───
  if (err.errorMessage) {
    const msg = document.createElement('div');
    msg.className = 'health-row-message';
    const text = String(err.errorMessage);
    msg.textContent = text.length > MAX_MESSAGE_CHARS
      ? text.slice(0, MAX_MESSAGE_CHARS) + '…'
      : text;
    row.appendChild(msg);
  }

  // ─── Line 3: PSID + actions ───
  const actions = document.createElement('div');
  actions.className = 'health-row-actions';

  if (err.psid) {
    const psid = document.createElement('span');
    psid.className = 'health-row-psid';
    psid.textContent = `PSID ${err.psid}`;
    actions.appendChild(psid);
  }

  if (err.conversationRecordId && typeof callbacks.onViewConvo === 'function') {
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'btn-action btn-view';
    viewBtn.textContent = '👁 Voir convo';
    viewBtn.addEventListener('click', () => callbacks.onViewConvo(err));
    actions.appendChild(viewBtn);
  }

  if (typeof callbacks.onToggleResolved === 'function') {
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = err.resolved
      ? 'btn-action btn-toggle-untreat'
      : 'btn-action btn-toggle-treat';
    toggleBtn.textContent = err.resolved
      ? '↻ Marquer non-traité'
      : '✓ Marquer traité';
    toggleBtn.dataset.role = 'toggle';
    toggleBtn.addEventListener('click', () => callbacks.onToggleResolved(err, toggleBtn));
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
