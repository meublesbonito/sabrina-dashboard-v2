// ─────────────────────────────────────────────
// GET /api/data/convo?id=recXXXX
// Single conversation record + FULL context_window
// (context_window is intentionally NOT exposed by /api/data/convos)
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { getRecord, normalizeDate } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';

// ─────────────────────────────────────────────
// Lot 5.1 — Detection of substantial messages (inlined here for self-containment)
// ─────────────────────────────────────────────

const SUBSTANTIAL_KEYWORDS = [
  'oui', 'je prends', 'ok',
  'combien', 'prix', 'cher', 'budget', 'coute', 'coût',
  'livraison', 'livrer', 'apporter', 'transport',
  'adresse', 'magasin', 'visite', 'passer', 'venir',
  'disponible', 'dispo', 'quand', "aujourd'hui", 'demain',
  'confirme', 'paiement', 'payer', 'affirm', 'cod',
  'téléphone', 'numéro', 'mon nom', 'tel'
];

const PHONE_REGEX = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;

function analyzeContextWindow(contextWindow) {
  try {
    if (!contextWindow || typeof contextWindow !== 'string') {
      return { nbClient: 0, nbSubstantial: 0 };
    }
    const text = contextWindow.length > 50000 ? contextWindow.slice(0, 50000) : contextWindow;
    const parts = text.split(/CLIENT:/i);
    if (parts.length <= 1) return { nbClient: 0, nbSubstantial: 0 };

    const clientMessages = parts.slice(1).map(part => {
      try {
        if (typeof part !== 'string') return '';
        const idxBot = part.indexOf('BOT:');
        const idxSep = part.indexOf('|||');
        const cuts = [idxBot, idxSep].filter(i => i !== -1);
        const cutAt = cuts.length ? Math.min(...cuts) : -1;
        return cutAt === -1 ? part.trim() : part.slice(0, cutAt).trim();
      } catch { return ''; }
    });

    const nbClient = clientMessages.length;
    let nbSubstantial = 0;
    for (const msg of clientMessages) {
      if (!msg || typeof msg !== 'string') continue;
      try {
        const lowerMsg = msg.toLowerCase();
        const wordCount = msg.split(/\s+/).filter(w => w.length > 0).length;
        const isSubstantial =
          wordCount > 4 ||
          PHONE_REGEX.test(msg) ||
          SUBSTANTIAL_KEYWORDS.some(kw => lowerMsg.includes(kw));
        if (isSubstantial) nbSubstantial++;
      } catch {}
    }
    return { nbClient, nbSubstantial };
  } catch (err) {
    console.error('[analyzeContextWindow/convo]', err && err.message);
    return { nbClient: 0, nbSubstantial: 0 };
  }
}

// ─────────────────────────────────────────────
// Mapping: full single record (snake_case, identical to convos.js + context_window)
// ─────────────────────────────────────────────

function mapConvoFull(record) {
  const fields = record.fields || {};
  const { nbClient, nbSubstantial } = analyzeContextWindow(fields.context_window);

  return {
    id: record.id,
    psid: fields.psid || '',
    platform: fields.platform || 'messenger',
    fb_first_name: fields.fb_first_name || '',
    fb_last_name: fields.fb_last_name || '',
    customer_name: fields.customer_name || '',
    customer_phone: fields.customer_phone || '',
    customer_city: fields.customer_city || '',
    customer_province: fields.customer_province || '',
    customer_zip: fields.customer_zip || '',
    nb_messages: fields.nb_messages || 0,
    last_action: fields.last_action || '',
    all_actions: fields.all_actions || '',
    // ⭐ Lot 6 — full conversation text exposed only by this endpoint
    context_window: typeof fields.context_window === 'string' ? fields.context_window : '',
    context_preview: typeof fields.context_window === 'string'
      ? fields.context_window.slice(0, 500)
      : '',
    last_message_time: normalizeDate(fields.last_message_time),
    last_modified_time: normalizeDate(fields['Last Modified Time']),
    conversation_started_at: normalizeDate(fields.conversation_started_at),
    status: fields.status || 'active',
    conversion_status: fields.conversion_status || '',
    sales_stage: fields.sales_stage || '',
    opp_status: fields.opp_status || '',
    cart_value: fields.cart_value || 0,
    cart_created_at: normalizeDate(fields.cart_created_at),
    checkout_sent_at: normalizeDate(fields.checkout_sent_at),
    checkout_completed_at: normalizeDate(fields.checkout_completed_at),
    draft_order_id: fields.draft_order_id || '',
    invoice_url: fields.invoice_url || '',
    confirmed_category: fields.confirmed_category || '',
    confirmed_budget: fields.confirmed_budget || '',
    confirmed_size: fields.confirmed_size || '',
    confirmed_firmness: fields.confirmed_firmness || '',
    confirmed_product_name: fields.confirmed_product_name || '',
    confirmed_product_id: fields.confirmed_product_id || '',
    confirmed_payment_method: fields.confirmed_payment_method || '',
    traite_status: fields.traite_status || 'open',
    traite_by: fields.traite_by || '',
    traite_at: normalizeDate(fields.traite_at),
    traite_action: fields.traite_action || '',
    next_followup_at: normalizeDate(fields.next_followup_at),
    traite_note: fields.traite_note || '',
    nb_messages_client: nbClient,
    nb_substantial_messages: nbSubstantial
  };
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/data/convo', res, async () => {
    const id = String(req.query.id || '').trim();
    if (!id) return fail(res, 400, 'id query param required');
    if (!id.startsWith('rec')) return fail(res, 400, 'Invalid id format');

    let record = null;
    try {
      record = await getRecord(TABLE, id);
    } catch (err) {
      // Airtable returns 422/404 for malformed or non-existent IDs.
      // Treat any 4xx from Airtable as a clean 404 to the client; let 5xx propagate.
      if (err && typeof err.message === 'string' && /Airtable 4\d\d/.test(err.message)) {
        return fail(res, 404, 'Conversation not found');
      }
      throw err;
    }
    if (!record) return fail(res, 404, 'Conversation not found');

    return ok(res, mapConvoFull(record));
  });
}
