// ─────────────────────────────────────────────
// CLIENT INFO PANEL — Drawer body content
// Composes client metadata + workflow + signals + conversation
// Read-only: no write actions here. (Today owns workflow updates.)
//
// Lot 6.2 additions:
//  - AI suggestion slot at the top of the drawer body
//  - "💡 Suggérer une action" button in the footer (with divider before)
//  - Loading / success / error / rate-limit UI states managed here
// ─────────────────────────────────────────────

import { renderConvoTimeline } from './convo-timeline.js';
import { formatPhone, formatMoney } from '../lib/action-shape.js';
import { api } from '../lib/api.js';
import { showModal } from './modal.js';
import { toast } from './toast.js';

// Module-level reference: the AI button needs to render the suggestion into
// the slot rendered at the top of the drawer body. Drawer is a singleton, so
// only one slot can exist at a time. We re-assign on each renderClientInfoPanel.
let currentSuggestionSlot = null;

/**
 * Build the drawer body for a single client conversation.
 * @param {Object} convo - full convo (from /api/data/convo)
 * @param {Array<Object>} signals - signals filtered by psid (may be empty)
 * @returns {HTMLElement}
 */
export function renderClientInfoPanel(convo, signals = []) {
  const wrap = document.createElement('div');
  wrap.className = 'client-info-panel';

  // Lot 6.2 — AI suggestion slot at the top (visible without scroll)
  const slot = document.createElement('div');
  slot.className = 'ai-suggestion-slot';
  slot.hidden = true;
  wrap.appendChild(slot);
  currentSuggestionSlot = slot;

  wrap.appendChild(renderHeader(convo));
  wrap.appendChild(renderBusinessSection(convo));
  wrap.appendChild(renderCartSection(convo));
  wrap.appendChild(renderWorkflowSection(convo));
  wrap.appendChild(renderSignalsSection(signals));
  wrap.appendChild(renderConversationSection(convo));

  return wrap;
}

/**
 * Build the drawer footer with quick-action buttons (no write endpoints).
 * @param {Object} convo
 * @returns {HTMLElement|null}
 */
export function renderClientInfoFooter(convo) {
  const manualButtons = [];

  if (convo.customer_phone) {
    const callBtn = document.createElement('a');
    callBtn.className = 'btn-action btn-call';
    callBtn.href = `tel:${digitsOnly(convo.customer_phone)}`;
    callBtn.textContent = `📞 Appeler ${formatPhone(convo.customer_phone)}`;
    manualButtons.push(callBtn);
  }

  if (convo.psid) {
    const inboxBtn = document.createElement('a');
    inboxBtn.className = 'btn-action btn-bs';
    inboxBtn.href = `https://business.facebook.com/latest/inbox/321731554364149/messages/?recipient=${encodeURIComponent(convo.psid)}`;
    inboxBtn.target = '_blank';
    inboxBtn.rel = 'noopener';
    inboxBtn.textContent = '💼 Ouvrir Inbox Messenger';
    manualButtons.push(inboxBtn);
  }

  const followupBtn = document.createElement('button');
  followupBtn.type = 'button';
  followupBtn.className = 'btn-action btn-copy';
  followupBtn.textContent = '📋 Copier message followup';
  followupBtn.addEventListener('click', () => {
    const name = clientNameOf(convo);
    const msg = `Bonjour ${name}, c'est Bonito Meubles. Je vous recontacte au sujet de votre demande.`;
    navigator.clipboard?.writeText(msg).then(
      () => { followupBtn.textContent = '✓ Copié'; setTimeout(() => { followupBtn.textContent = '📋 Copier message followup'; }, 1500); },
      () => { followupBtn.textContent = '✗ Erreur copie'; }
    );
  });
  manualButtons.push(followupBtn);

  const footer = document.createElement('div');
  footer.className = 'client-info-footer';
  manualButtons.forEach(b => footer.appendChild(b));

  if (convo.id) {
    // Lot 8.1 — Stop / Reactivate Sabrina (visually separated by divider)
    if (manualButtons.length > 0) {
      const divider1 = document.createElement('span');
      divider1.className = 'footer-divider';
      footer.appendChild(divider1);
    }
    footer.appendChild(makeDispatchButton(convo));

    // Lot 6.2 — AI button (visually separated by another divider)
    const divider2 = document.createElement('span');
    divider2.className = 'footer-divider';
    footer.appendChild(divider2);

    const aiBtn = document.createElement('button');
    aiBtn.type = 'button';
    aiBtn.className = 'btn-action btn-ai';
    aiBtn.textContent = '💡 Suggérer une action';
    aiBtn.addEventListener('click', () => handleAIClick(convo, aiBtn));
    footer.appendChild(aiBtn);
  }

  return footer;
}

// ─────────────────────────────────────────────
// Lot 8.1 — Stop / Reactivate Sabrina dispatcher
//
// Reads `convo.status` to decide which label to show:
//   - 'active' (or empty/null/undefined) → "⛔ Stop Sabrina" (target: human_only)
//   - 'human_only'                       → "✅ Réactiver Sabrina" (target: active)
//   - anything else (handed_off, closed,
//     "carted + ..." automation values)  → button DISABLED with tooltip
//
// On click: shows a confirmation modal, then POSTs to /api/actions/dispatch-control.
// Backend re-validates the current status to refuse overwriting custom values.
// ─────────────────────────────────────────────

const STOP_LABEL = '⛔ Stop Sabrina';
const REACTIVATE_LABEL = '✅ Réactiver Sabrina';

function makeDispatchButton(convo) {
  const btn = document.createElement('button');
  btn.type = 'button';

  const status = convo.status;
  const isCustom = !['active', 'human_only', '', null, undefined].includes(status);

  if (isCustom) {
    btn.className = 'btn-action btn-dispatch btn-dispatch--custom';
    btn.textContent = STOP_LABEL;
    btn.disabled = true;
    btn.title = `Status géré par automation Sabrina (${status}) — ne pas écraser`;
    return btn;
  }

  if (status === 'human_only') {
    btn.className = 'btn-action btn-dispatch btn-dispatch--reactivate';
    btn.textContent = REACTIVATE_LABEL;
    btn.addEventListener('click', () => handleDispatchClick(convo, btn, 'active'));
  } else {
    btn.className = 'btn-action btn-dispatch btn-dispatch--stop';
    btn.textContent = STOP_LABEL;
    btn.addEventListener('click', () => handleDispatchClick(convo, btn, 'human_only'));
  }
  return btn;
}

function handleDispatchClick(convo, btn, targetStatus) {
  const clientName = clientNameOf(convo);
  const isStop = targetStatus === 'human_only';

  const title = isStop ? 'Stop Sabrina ?' : 'Réactiver Sabrina ?';
  const message = isStop
    ? `Stop Sabrina sur ${clientName} ? Sabrina arrêtera de répondre à ce client. Tu devras reprendre manuellement.`
    : `Réactiver Sabrina sur ${clientName} ? Sabrina pourra recommencer à répondre automatiquement.`;

  const body = document.createElement('p');
  body.className = 'modal-text';
  body.textContent = message;

  showModal({
    title,
    body,
    buttons: [
      { label: 'Annuler', variant: 'secondary', onClick: () => {} },
      {
        label: isStop ? 'Stop Sabrina' : 'Réactiver Sabrina',
        variant: isStop ? 'danger' : 'primary',
        onClick: async () => {
          // Optimistic loading state on the original button
          btn.disabled = true;
          btn.textContent = '⏳ ...';

          let res;
          try {
            res = await api.setDispatch(convo.id, targetStatus);
          } catch {
            toast.error('Erreur réseau — réessaye.');
            restoreButton(btn, isStop ? STOP_LABEL : REACTIVATE_LABEL);
            return;
          }

          if (!res || res.ok === false) {
            // 409 Conflict carries `current_status` for the custom-status case
            if (res && res.current_status) {
              toast.error(`Status custom détecté (${res.current_status}) — non écrasé.`);
              // Force a UI refresh by swapping the button to its custom-disabled state
              convo.status = res.current_status;
              const refreshed = makeDispatchButton(convo);
              btn.replaceWith(refreshed);
            } else {
              toast.error(`Échec : ${res?.error || 'serveur'}`);
              restoreButton(btn, isStop ? STOP_LABEL : REACTIVATE_LABEL);
            }
            return;
          }

          // Success — sync local convo state and swap the button to the inverse
          convo.status = targetStatus;
          const newBtn = makeDispatchButton(convo);
          btn.replaceWith(newBtn);
          toast.success(isStop ? 'Sabrina arrêtée sur ce client' : 'Sabrina réactivée sur ce client');
        }
      }
    ]
  });
}

function restoreButton(btn, label) {
  if (!btn.isConnected) return;
  btn.disabled = false;
  btn.textContent = label;
}

// ─────────────────────────────────────────────
// AI suggestion handler + state renderers
// ─────────────────────────────────────────────

const BTN_IDLE_LABEL = '💡 Suggérer une action';

async function handleAIClick(convo, btn) {
  const slot = currentSuggestionSlot;
  if (!slot) return;

  btn.disabled = true;
  btn.textContent = '⏳ Génération…';
  showSuggestionLoader(slot);

  let res;
  try {
    res = await api.suggestAction(convo.id);
  } catch (err) {
    if (slot.isConnected) {
      showSuggestionError(slot, 'Erreur réseau.', () => handleAIClick(convo, btn));
    }
    if (btn.isConnected) {
      btn.disabled = false;
      btn.textContent = BTN_IDLE_LABEL;
    }
    return;
  }

  // Drawer might have closed/reopened on a different convo while we were waiting
  if (!slot.isConnected) {
    if (btn.isConnected) {
      btn.disabled = false;
      btn.textContent = BTN_IDLE_LABEL;
    }
    return;
  }

  // Reset the button state (even on error/429) so user can retry
  if (btn.isConnected) {
    btn.disabled = false;
    btn.textContent = BTN_IDLE_LABEL;
  }

  if (res && typeof res.retry_after === 'number') {
    showSuggestionRateLimit(slot, res.retry_after, () => handleAIClick(convo, btn));
    return;
  }
  if (!res || res.ok !== true) {
    showSuggestionError(slot, (res && res.error) || 'Erreur IA.', () => handleAIClick(convo, btn));
    return;
  }

  const suggestion = (res.data && res.data.suggestion) || '';
  if (!suggestion) {
    showSuggestionError(slot, 'Réponse vide.', () => handleAIClick(convo, btn));
    return;
  }

  showSuggestionSuccess(slot, suggestion, res.data?.model_used);
}

function showSuggestionLoader(slot) {
  slot.hidden = false;
  slot.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'ai-suggestion-panel ai-suggestion-panel--loading';
  const meta = document.createElement('div');
  meta.className = 'ai-suggestion-meta';
  meta.textContent = '💡 Suggestion IA';
  panel.appendChild(meta);
  const text = document.createElement('div');
  text.className = 'ai-suggestion-text';
  text.textContent = '⏳ Génération en cours…';
  panel.appendChild(text);
  slot.appendChild(panel);
}

function showSuggestionSuccess(slot, suggestion, modelUsed) {
  slot.hidden = false;
  slot.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'ai-suggestion-panel ai-suggestion-panel--success';

  const meta = document.createElement('div');
  meta.className = 'ai-suggestion-meta';
  meta.textContent = modelUsed ? `💡 Suggestion IA · ${modelUsed}` : '💡 Suggestion IA';
  panel.appendChild(meta);

  const text = document.createElement('div');
  text.className = 'ai-suggestion-text';
  text.textContent = suggestion;
  panel.appendChild(text);

  const actions = document.createElement('div');
  actions.className = 'ai-suggestion-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn-action btn-copy';
  copyBtn.textContent = '📋 Copier';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(suggestion).then(
      () => { copyBtn.textContent = '✓ Copié'; setTimeout(() => { copyBtn.textContent = '📋 Copier'; }, 1500); },
      () => { copyBtn.textContent = '✗ Erreur copie'; }
    );
  });
  actions.appendChild(copyBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'btn-action btn-view';
  dismissBtn.textContent = '✕ Masquer';
  dismissBtn.addEventListener('click', () => { slot.hidden = true; slot.replaceChildren(); });
  actions.appendChild(dismissBtn);

  panel.appendChild(actions);
  slot.appendChild(panel);
}

function showSuggestionError(slot, message, retryFn) {
  slot.hidden = false;
  slot.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'ai-suggestion-panel ai-suggestion-panel--error';

  const meta = document.createElement('div');
  meta.className = 'ai-suggestion-meta';
  meta.textContent = '⚠ Suggestion IA — erreur';
  panel.appendChild(meta);

  const text = document.createElement('div');
  text.className = 'ai-suggestion-text';
  text.textContent = message;
  panel.appendChild(text);

  if (typeof retryFn === 'function') {
    const actions = document.createElement('div');
    actions.className = 'ai-suggestion-actions';
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn-action btn-view';
    retryBtn.textContent = '↻ Réessayer';
    retryBtn.addEventListener('click', () => retryFn());
    actions.appendChild(retryBtn);
    panel.appendChild(actions);
  }
  slot.appendChild(panel);
}

function showSuggestionRateLimit(slot, retryAfterSec, retryFn) {
  slot.hidden = false;
  slot.replaceChildren();
  const panel = document.createElement('div');
  panel.className = 'ai-suggestion-panel ai-suggestion-panel--rate-limit';

  const meta = document.createElement('div');
  meta.className = 'ai-suggestion-meta';
  meta.textContent = '⏱ Suggestion IA — limite atteinte';
  panel.appendChild(meta);

  const text = document.createElement('div');
  text.className = 'ai-suggestion-text';
  panel.appendChild(text);

  let remaining = Math.max(0, Math.ceil(retryAfterSec));
  const updateText = () => {
    if (!slot.isConnected) { clearInterval(intervalId); return; }
    if (remaining > 0) {
      text.textContent = `Réessaye dans ${remaining}s…`;
    } else {
      clearInterval(intervalId);
      text.textContent = 'Tu peux réessayer maintenant.';
      if (typeof retryFn === 'function') {
        const actions = document.createElement('div');
        actions.className = 'ai-suggestion-actions';
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn-action btn-ai';
        retryBtn.textContent = '↻ Réessayer';
        retryBtn.addEventListener('click', () => retryFn());
        actions.appendChild(retryBtn);
        panel.appendChild(actions);
      }
    }
    remaining--;
  };
  updateText();
  const intervalId = setInterval(updateText, 1000);

  slot.appendChild(panel);
}

// ─────────────────────────────────────────────
// Sections (unchanged from Lot 6.1)
// ─────────────────────────────────────────────

function renderHeader(c) {
  const sec = document.createElement('section');
  sec.className = 'panel-section panel-header';

  const name = document.createElement('div');
  name.className = 'panel-name';
  name.textContent = clientNameOf(c);
  sec.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'panel-meta';
  const bits = [];
  if (c.customer_phone) bits.push(formatPhone(c.customer_phone));
  if (c.customer_city) bits.push(c.customer_city);
  if (c.customer_province) bits.push(c.customer_province);
  meta.textContent = bits.length ? bits.join(' · ') : '—';
  sec.appendChild(meta);

  const ids = document.createElement('div');
  ids.className = 'panel-ids';
  ids.textContent = `PSID ${c.psid || '—'} · ${c.platform || 'messenger'}`;
  sec.appendChild(ids);

  return sec;
}

function renderBusinessSection(c) {
  const sec = sectionWithTitle('Profil produit');
  const grid = document.createElement('div');
  grid.className = 'panel-grid';
  grid.appendChild(kv('Catégorie', c.confirmed_category));
  grid.appendChild(kv('Budget', c.confirmed_budget ? `${c.confirmed_budget}` : '—'));
  grid.appendChild(kv('Taille', c.confirmed_size));
  grid.appendChild(kv('Fermeté', c.confirmed_firmness));
  grid.appendChild(kv('Produit confirmé', c.confirmed_product_name));
  grid.appendChild(kv('ID produit', c.confirmed_product_id));
  sec.appendChild(grid);
  return sec;
}

function renderCartSection(c) {
  const sec = sectionWithTitle('Panier & Paiement');
  const grid = document.createElement('div');
  grid.className = 'panel-grid';
  grid.appendChild(kv('Cart value', c.cart_value ? formatMoney(c.cart_value) : '—'));
  grid.appendChild(kv('Cart créé', formatDate(c.cart_created_at)));
  grid.appendChild(kv('Checkout envoyé', formatDate(c.checkout_sent_at)));
  grid.appendChild(kv('Checkout complété', formatDate(c.checkout_completed_at)));
  grid.appendChild(kv('Méthode paiement', c.confirmed_payment_method));
  grid.appendChild(kv('Draft order', c.draft_order_id));
  if (c.invoice_url) {
    const a = document.createElement('a');
    a.href = c.invoice_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Voir facture';
    a.className = 'panel-link';
    grid.appendChild(kv('Facture', a));
  } else {
    grid.appendChild(kv('Facture', '—'));
  }
  sec.appendChild(grid);
  return sec;
}

function renderWorkflowSection(c) {
  const sec = sectionWithTitle('Workflow Sabrina');
  const grid = document.createElement('div');
  grid.className = 'panel-grid';
  grid.appendChild(kv('Statut traité', c.traite_status || 'open'));
  grid.appendChild(kv('Traité par', c.traite_by));
  grid.appendChild(kv('Traité le', formatDate(c.traite_at)));
  grid.appendChild(kv('Action', c.traite_action));
  grid.appendChild(kv('Prochain suivi', formatDate(c.next_followup_at)));
  grid.appendChild(kv('Status Sabrina', c.status));
  if (c.traite_note) {
    grid.appendChild(kv('Note', c.traite_note, /*wide*/ true));
  }
  sec.appendChild(grid);
  return sec;
}

function renderSignalsSection(signals) {
  const sec = sectionWithTitle('Signaux DETECTOR');
  if (!Array.isArray(signals) || signals.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'panel-empty';
    empty.textContent = 'Aucun signal détecté.';
    sec.appendChild(empty);
    return sec;
  }
  const list = document.createElement('div');
  list.className = 'panel-signals';
  signals.forEach(s => {
    const row = document.createElement('div');
    row.className = `panel-signal panel-signal--${(s.gravite || 'low').toLowerCase()}`;

    const head = document.createElement('div');
    head.className = 'panel-signal-head';
    const type = document.createElement('span');
    type.className = 'panel-signal-type';
    type.textContent = s.type || '—';
    head.appendChild(type);

    if (s.gravite) {
      const grav = document.createElement('span');
      grav.className = 'panel-signal-grav';
      grav.textContent = String(s.gravite).toLowerCase();
      head.appendChild(grav);
    }

    const date = document.createElement('span');
    date.className = 'panel-signal-date';
    date.textContent = formatDateString(s.dateDetection);
    head.appendChild(date);

    row.appendChild(head);

    if (s.description) {
      const desc = document.createElement('div');
      desc.className = 'panel-signal-desc';
      desc.textContent = s.description;
      row.appendChild(desc);
    }
    if (s.suggestion) {
      const sug = document.createElement('div');
      sug.className = 'panel-signal-sug';
      sug.textContent = `→ ${s.suggestion}`;
      row.appendChild(sug);
    }
    list.appendChild(row);
  });
  sec.appendChild(list);
  return sec;
}

function renderConversationSection(c) {
  const sec = sectionWithTitle(
    `Conversation${typeof c.nb_messages_client === 'number' ? ` (${c.nb_messages_client} msg client, ${c.nb_substantial_messages || 0} substantiels)` : ''}`
  );
  sec.appendChild(renderConvoTimeline(c.context_window || ''));
  return sec;
}

// ─────────────────────────────────────────────
// Helpers (local, unchanged from Lot 6.1)
// ─────────────────────────────────────────────

function sectionWithTitle(title) {
  const sec = document.createElement('section');
  sec.className = 'panel-section';
  const h = document.createElement('h3');
  h.className = 'panel-section-title';
  h.textContent = title;
  sec.appendChild(h);
  return sec;
}

function kv(label, value, wide = false) {
  const cell = document.createElement('div');
  cell.className = wide ? 'panel-kv panel-kv--wide' : 'panel-kv';

  const k = document.createElement('div');
  k.className = 'panel-k';
  k.textContent = label;
  cell.appendChild(k);

  const v = document.createElement('div');
  v.className = 'panel-v';
  if (value instanceof Node) {
    v.appendChild(value);
  } else if (value === null || value === undefined || value === '') {
    v.textContent = '—';
    v.classList.add('panel-v--empty');
  } else {
    v.textContent = String(value);
  }
  cell.appendChild(v);
  return cell;
}

function clientNameOf(c) {
  return c.customer_name
    || [c.fb_first_name, c.fb_last_name].filter(Boolean).join(' ')
    || `Client #${String(c.psid || '').slice(-4) || '????'}`;
}

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

/** Date may be { raw, iso }, string, or null. */
function formatDate(d) {
  if (!d) return '—';
  const iso = typeof d === 'string' ? d : d.iso;
  return formatDateString(iso);
}

function formatDateString(iso) {
  if (!iso) return '—';
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-CA', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  } catch {
    return '—';
  }
}
