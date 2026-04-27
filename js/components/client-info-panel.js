// ─────────────────────────────────────────────
// CLIENT INFO PANEL — Drawer body content
// Composes client metadata + workflow + signals + conversation
// Read-only: no write actions here. (Today owns workflow updates.)
// ─────────────────────────────────────────────

import { renderConvoTimeline } from './convo-timeline.js';
import { formatPhone, formatMoney } from '../lib/action-shape.js';

/**
 * Build the drawer body for a single client conversation.
 * @param {Object} convo - full convo (from /api/data/convo)
 * @param {Array<Object>} signals - signals filtered by psid (may be empty)
 * @returns {HTMLElement}
 */
export function renderClientInfoPanel(convo, signals = []) {
  const wrap = document.createElement('div');
  wrap.className = 'client-info-panel';

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
  const buttons = [];

  if (convo.customer_phone) {
    const callBtn = document.createElement('a');
    callBtn.className = 'btn-action btn-call';
    callBtn.href = `tel:${digitsOnly(convo.customer_phone)}`;
    callBtn.textContent = `📞 Appeler ${formatPhone(convo.customer_phone)}`;
    buttons.push(callBtn);
  }

  if (convo.psid) {
    const inboxBtn = document.createElement('a');
    inboxBtn.className = 'btn-action btn-bs';
    inboxBtn.href = `https://business.facebook.com/latest/inbox/321731554364149/messages/?recipient=${encodeURIComponent(convo.psid)}`;
    inboxBtn.target = '_blank';
    inboxBtn.rel = 'noopener';
    inboxBtn.textContent = '💼 Ouvrir Inbox Messenger';
    buttons.push(inboxBtn);
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
  buttons.push(followupBtn);

  if (buttons.length === 0) return null;

  const footer = document.createElement('div');
  footer.className = 'client-info-footer';
  buttons.forEach(b => footer.appendChild(b));
  return footer;
}

// ─────────────────────────────────────────────
// Sections
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
// Helpers (local)
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
