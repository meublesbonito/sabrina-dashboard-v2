// ─────────────────────────────────────────────
// GET /api/data/convos
// Liste des conversations pour Today/Clients
// READ ONLY — context_preview seulement (500 chars)
//
// 3 statuts distincts à ne pas confondre :
//   status            = état contrôle Sabrina (active/handed_off/human_only/closed)
//   traite_status     = workflow dashboard (open/done/called_no_answer/converted/lost)
//   conversion_status = funnel vente (POLLUÉ — pas source unique en Lot 4)
//
// Query params :
//   ?limit=50              (max 200)
//   ?traite_status=open    (filtre workflow dashboard)
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, safe } from '../_helpers/api-response.js';
import { listRecords, normalizeDate } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';
const MAX_LIMIT = 200;
const PREVIEW_CHARS = 500;

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  
  return safe('api/data/convos', res, async () => {
    const reqLimit = parseInt(req.query?.limit ?? '50', 10);
    const limit = Math.max(1, Math.min(reqLimit || 50, MAX_LIMIT));
    
    // Filtre sur traite_status (workflow dashboard), PAS status (contrôle Sabrina)
    const traiteStatusFilter = (req.query?.traite_status || '').toString().trim();
    
    let filterByFormula = '';
    if (traiteStatusFilter) {
      const safeVal = traiteStatusFilter.replace(/'/g, '');
      filterByFormula = `{traite_status} = '${safeVal}'`;
    }
    
    const records = await listRecords(TABLE, {
      maxRecords: limit,
      filterByFormula: filterByFormula || undefined,
      sort: [
        { field: 'last_message_time', direction: 'desc' },
        { field: 'Last Modified Time', direction: 'desc' }
      ]
    });
    
    const data = records.map(toConvoSummary);
    return ok(res, data, { count: data.length });
  });
}

/**
 * Mappe un record Airtable vers la version "summary" (liste).
 * context_window tronqué à 500 chars (preview).
 * Le record complet est disponible via /api/data/convo?id=...
 */
function toConvoSummary(record) {
  const f = record.fields || {};
  const lastMsg = normalizeDate(f.last_message_time);
  const modified = normalizeDate(f['Last Modified Time']);
  const cartCreated = normalizeDate(f.cart_created_at);
  const checkoutSent = normalizeDate(f.checkout_sent_at);
  const checkoutCompleted = normalizeDate(f.checkout_completed_at);
  const conversationStarted = normalizeDate(f.conversation_started_at);
  const traiteAt = normalizeDate(f.traite_at);
  const nextFollowupAt = normalizeDate(f.next_followup_at);
  
  return {
    id: record.id,
    psid: f.psid || null,
    platform: f.platform || null,
    
    // Identité
    fb_first_name: f.fb_first_name || null,
    fb_last_name: f.fb_last_name || null,
    customer_name: f.customer_name || null,
    customer_phone: f.customer_phone || null,
    customer_city: f.customer_city || null,
    customer_province: f.customer_province || null,
    customer_zip: f.customer_zip || null,
    
    // Conversation
    nb_messages: f.nb_messages || 0,
    last_action: f.last_action || null,
    last_message_time: lastMsg.iso,
    last_message_time_raw: lastMsg.raw,
    last_modified_time: modified.iso,
    last_modified_time_raw: modified.raw,
    conversation_started_at: conversationStarted.iso,
    
    // Preview du context_window (pas le full)
    context_preview: typeof f.context_window === 'string'
      ? f.context_window.slice(0, PREVIEW_CHARS)
      : null,
    
    // 3 statuts distincts (cf. en-tête)
    status: f.status || null,                       // contrôle Sabrina
    sales_stage: f.sales_stage || null,
    conversion_status: f.conversion_status || null, // funnel vente (pollué)
    opp_status: f.opp_status || null,
    
    // Panier / commande
    cart_value: typeof f.cart_value === 'number' ? f.cart_value : (parseFloat(f.cart_value) || null),
    cart_created_at: cartCreated.iso,
    checkout_sent_at: checkoutSent.iso,
    checkout_completed_at: checkoutCompleted.iso,
    draft_order_id: f.draft_order_id || null,
    invoice_url: f.invoice_url || null,
    
    // Préférences confirmées
    confirmed_category: f.confirmed_category || null,
    confirmed_product_name: f.confirmed_product_name || null,
    confirmed_product_id: f.confirmed_product_id || null,
    confirmed_budget: f.confirmed_budget || null,
    confirmed_size: f.confirmed_size || null,
    confirmed_payment_method: f.confirmed_payment_method || null,
    
    // Workflow dashboard (Lot 1 schema)
    traite_status: f.traite_status || null,         // workflow dashboard
    traite_by: f.traite_by || null,
    traite_at: traiteAt.iso,
    traite_action: f.traite_action || null,
    next_followup_at: nextFollowupAt.iso,
    traite_note: f.traite_note || null
  };
}
