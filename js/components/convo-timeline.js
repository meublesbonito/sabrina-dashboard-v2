// ─────────────────────────────────────────────
// CONVO TIMELINE — Parses raw context_window into CLIENT/BOT bubbles
// Format Airtable : "[]CLIENT: ... ||| BOT: ... ||| CLIENT: ..."
// Always uses textContent (no innerHTML) for XSS safety.
// Truncates rendering to the last N turns with a "show all" button.
// ─────────────────────────────────────────────

const DEFAULT_VISIBLE_TURNS = 30;
const MAX_PARSE_CHARS = 50_000;
const TURN_REGEX = /(CLIENT|BOT)\s*:/gi;

/**
 * Parse a context_window string into an ordered array of turns.
 * @param {string} raw
 * @returns {Array<{role: 'client'|'bot', text: string}>}
 */
export function parseContextWindow(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const text = raw.length > MAX_PARSE_CHARS ? raw.slice(0, MAX_PARSE_CHARS) : raw;

  // Find all role markers in order
  const markers = [];
  let m;
  TURN_REGEX.lastIndex = 0;
  while ((m = TURN_REGEX.exec(text)) !== null) {
    markers.push({ role: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  if (markers.length === 0) return [];

  const turns = [];
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const next = markers[i + 1];
    const segment = text.slice(cur.end, next ? next.start : text.length);

    // Strip trailing/leading separators "|||" and whitespace
    const cleaned = segment
      .replace(/\|\|\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) continue;
    turns.push({ role: cur.role === 'client' ? 'client' : 'bot', text: cleaned });
  }
  return turns;
}

/**
 * Render the conversation timeline as a DOM node.
 * @param {string} contextWindow
 * @param {Object} [opts]
 * @param {number} [opts.visibleTurns]
 * @returns {HTMLElement}
 */
export function renderConvoTimeline(contextWindow, { visibleTurns = DEFAULT_VISIBLE_TURNS } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'convo-timeline';

  const turns = parseContextWindow(contextWindow);

  if (turns.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'convo-empty';
    empty.textContent = 'Conversation indisponible.';
    wrap.appendChild(empty);
    return wrap;
  }

  const meta = document.createElement('div');
  meta.className = 'convo-meta';
  meta.textContent = `${turns.length} message${turns.length > 1 ? 's' : ''} dans la conversation`;
  wrap.appendChild(meta);

  let showAll = false;
  const list = document.createElement('div');
  list.className = 'convo-turns';
  wrap.appendChild(list);

  function render() {
    list.replaceChildren();
    const startIdx = (showAll || turns.length <= visibleTurns)
      ? 0
      : turns.length - visibleTurns;

    if (startIdx > 0) {
      const note = document.createElement('div');
      note.className = 'convo-truncation';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'convo-show-all-btn';
      btn.textContent = `Voir les ${startIdx} message${startIdx > 1 ? 's' : ''} précédent${startIdx > 1 ? 's' : ''}`;
      btn.addEventListener('click', () => { showAll = true; render(); });
      note.appendChild(btn);
      list.appendChild(note);
    }

    for (let i = startIdx; i < turns.length; i++) {
      list.appendChild(renderTurn(turns[i]));
    }
  }

  render();
  return wrap;
}

function renderTurn(turn) {
  const row = document.createElement('div');
  row.className = `convo-turn convo-turn--${turn.role}`;

  const label = document.createElement('div');
  label.className = 'convo-role';
  label.textContent = turn.role === 'client' ? '👤 CLIENT' : '🤖 BOT';
  row.appendChild(label);

  const bubble = document.createElement('div');
  bubble.className = 'convo-bubble';
  bubble.textContent = turn.text; // textContent — XSS-safe
  row.appendChild(bubble);

  return row;
}
