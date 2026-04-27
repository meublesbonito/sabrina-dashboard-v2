// ─────────────────────────────────────────────
// CLIENT CARD — Row in the Clients list
// Read-only display; clicking the card invokes the onClick callback.
//
// Lot 6.1 polish:
//  - Show a short snippet from context_preview (max 90 chars)
//  - Show budget / category / cart_value when present
//  - Show nb_messages_client when known
//  - Show "Faible engagement" badge when nb_msg<3 AND no phone/cart/budget
// ─────────────────────────────────────────────

import { formatPhone, formatMoney } from '../lib/action-shape.js';

const TRAITE_STATUS_LABEL = {
  open: 'Ouvert',
  done: 'Traité',
  converted: 'Converti',
  called_no_answer: 'Pas de réponse',
  lost: 'Perdu'
};

const SNIPPET_MAX_LEN = 90;

/**
 * @param {Object} convo - record from /api/data/convos
 * @param {Function} [onClick] - called with (convo) on card click
 * @returns {HTMLElement}
 */
export function renderClientCard(convo, onClick) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'client-card';
  card.dataset.id = convo.id || '';
  card.dataset.psid = convo.psid || '';

  // ─── Line 1: name · phone ───
  const line1 = document.createElement('div');
  line1.className = 'client-card-line1';

  const name = document.createElement('span');
  name.className = 'client-card-name';
  name.textContent = clientNameOf(convo);
  line1.appendChild(name);

  if (convo.customer_phone) {
    const phone = document.createElement('span');
    phone.className = 'client-card-phone';
    phone.textContent = formatPhone(convo.customer_phone);
    line1.appendChild(phone);
  }

  card.appendChild(line1);

  // ─── Line 2 (NEW): preview snippet ───
  const snippet = extractSnippet(convo.context_preview, SNIPPET_MAX_LEN);
  if (snippet) {
    const preview = document.createElement('div');
    preview.className = 'client-card-preview';
    preview.textContent = `« ${snippet} »`;
    card.appendChild(preview);
  }

  // ─── Line 3: meta (city · budget · category · cart · msgs) + badges ───
  const meta = document.createElement('div');
  meta.className = 'client-card-meta';

  // City
  if (convo.customer_city) {
    meta.appendChild(makeChip('client-card-city', convo.customer_city));
  }

  // Budget (confirmed_budget can be string or number — display raw, with $ if numeric)
  if (convo.confirmed_budget !== '' && convo.confirmed_budget != null) {
    const b = String(convo.confirmed_budget);
    const numericBudget = b.match(/^\d+$/) ? `${b}$` : b;
    meta.appendChild(makeChip('client-card-budget', `🎯 ${numericBudget}`));
  }

  // Category
  if (convo.confirmed_category) {
    meta.appendChild(makeChip('client-card-category', `📦 ${convo.confirmed_category}`));
  }

  // Cart value
  if (convo.cart_value && convo.cart_value > 0) {
    meta.appendChild(makeChip('client-card-cart', `🛒 ${formatMoney(convo.cart_value)}`));
  }

  // Messages count
  if (typeof convo.nb_messages_client === 'number' && convo.nb_messages_client > 0) {
    const label = `${convo.nb_messages_client} msg`;
    meta.appendChild(makeChip('client-card-msg', `💬 ${label}`));
  }

  // Weak engagement badge — purely client-side derivation
  if (isWeakEngagement(convo)) {
    meta.appendChild(makeChip('client-card-weak', '⚠ Faible engagement'));
  }

  // Status (always last, visually right-aligned via CSS)
  const statusKey = convo.traite_status || 'open';
  const statusLabel = TRAITE_STATUS_LABEL[statusKey] || statusKey;
  const statusEl = document.createElement('span');
  statusEl.className = `client-card-status client-card-status--${statusKey}`;
  statusEl.textContent = statusLabel;
  meta.appendChild(statusEl);

  // Only append meta line if it has something visible
  if (meta.children.length > 0) {
    card.appendChild(meta);
  }

  if (typeof onClick === 'function') {
    card.addEventListener('click', () => onClick(convo));
  }

  return card;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function clientNameOf(c) {
  return c.customer_name
    || [c.fb_first_name, c.fb_last_name].filter(Boolean).join(' ')
    || `Client #${String(c.psid || '').slice(-4) || '????'}`;
}

function makeChip(extraClass, text) {
  const chip = document.createElement('span');
  chip.className = `client-card-chip ${extraClass}`;
  chip.textContent = text;
  return chip;
}

/**
 * Extract a short snippet from context_preview.
 * Prefers the first CLIENT message; falls back to a cleaned slice.
 */
function extractSnippet(preview, maxLen = SNIPPET_MAX_LEN) {
  if (!preview || typeof preview !== 'string') return '';

  // First, try to grab the first CLIENT: ... segment
  const m = preview.match(/CLIENT\s*:\s*([^|]+)/i);
  let text = '';
  if (m && m[1]) {
    text = m[1].trim();
  } else {
    // Fallback: strip role markers and triple-pipes
    text = preview
      .replace(/(CLIENT|BOT)\s*:/gi, '')
      .replace(/\|\|\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (!text) return '';
  if (text.length > maxLen) text = text.slice(0, maxLen - 1) + '…';
  return text;
}

/**
 * Weak engagement = sparse conversation AND no business signal.
 * Mirrors the spirit of Lot 5.1 isAdTemplateNoise but kept local to UI.
 */
function isWeakEngagement(c) {
  const nbMsg = typeof c.nb_messages_client === 'number' ? c.nb_messages_client : 0;
  if (nbMsg >= 3) return false;

  const hasPhone = !!c.customer_phone;
  const hasCart = !!(c.cart_value && c.cart_value > 0);
  const hasBudget = c.confirmed_budget !== '' && c.confirmed_budget != null;
  const hasPaymentMethod = !!c.confirmed_payment_method;
  const hasProductName = !!c.confirmed_product_name;

  return !hasPhone && !hasCart && !hasBudget && !hasPaymentMethod && !hasProductName;
}
