// ─────────────────────────────────────────────
// GET /api/data/convo?id=recXXXX
// Détail complet d'une conversation (avec context_window full)
// MVP : id seulement (pas de psid lookup)
//
// 3 statuts distincts (cf. /api/data/convos pour explication) :
//   status, traite_status, conversion_status
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { getRecord, normalizeDate } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  
  return safe('api/data/convo', res, async () => {
    const id = (req.query?.id || '').toString().trim();
    
    if (!id) {
      return fail(res, 400, 'Paramètre id requis (recXXXX)');
    }
    
    if (!id.startsWith('rec')) {
      return fail(res, 400, 'id doit commencer par "rec"');
    }
    
    const record = await getRecord(TABLE, id);
    
    if (!record) {
      return fail(res, 404, 'Conversation introuvable');
    }
    
    return ok(res, toConvoFull(record));
  });
}

/**
 * Mappe un record en version FULL (context_window complet, all_actions, etc.)
 */
function toConvoFull(record) {
  const f = record.fields || {};
  const lastMsg = normalizeDate(f.last_message_time);
  const modified = normalizeDate(f['Last Modified Time']);
  const cartCreated = normalizeDate(f.cart_created_at);
  const checkoutSent = normalizeDate(f.checkout_sent_at);
  const checkoutCompleted = normalizeDate(f.checkout_completed_at);
  const conversationStarted = normalizeDate(f.conversation_started_at);
  const traiteAt = normalizeDate(f.traite_at);
  const nextFollowupAt = normalizeDate(f.next_followup_at);
  const dateAnalyse = normalizeDate(f.date_derniere_analyse);
  const cancelledAt = normalizeDate(f.cancelled_at);
  const fulfilledAt = normalizeDate(f.fulfilled_at);
  
  return {
    id: record.id,
    psid: f.psid || null,
    platform: f.platform || null,
    
    // Identité complète
    fb_first_name: f.fb_first_name || null,
    fb_last_name: f.fb_last_name || null,
    customer_name: f.customer_name || null,
    customer_phone: f.customer_phone || null,
    customer_address: f.customer_address || null,
    customer_city: f.customer_city || null,
    customer_province: f.customer_province || null,
    customer_zip: f.customer_zip || null,
    shopify_customer_id: f.shopify_customer_id || null,
    
    // Conversation FULL
    nb_messages: f.nb_messages || 0,
    last_action: f.last_action || null,
    all_actions: f.all_actions || null,
    context_window: f.context_window || null,  // ← FULL ici
    last_message_time: lastMsg.iso,
    last_message_time_raw: lastMsg.raw,
    last_modified_time: modified.iso,
    last_modified_time_raw: modified.raw,
    conversation_started_at: conversationStarted.iso,
    pending_message: f.pending_message || null,
    
    // 3 statuts (cf. en-tête)
    status: f.status || null,                       // contrôle Sabrina
    sales_stage: f.sales_stage || null,
    conversion_status: f.conversion_status || null, // funnel vente (pollué)
    opp_status: f.opp_status || null,
    last_proposed: f.last_proposed || null,
    refusal_count: f.refusal_count || 0,
    add_cart_attempts: f.add_cart_attempts || 0,
    plus_tard_mode: f.plus_tard_mode || null,
    current_category_focus: f.current_category_focus || null,
    date_derniere_analyse: dateAnalyse.iso,
    
    // Panier / commande complet
    cart_value: typeof f.cart_value === 'number' ? f.cart_value : (parseFloat(f.cart_value) || null),
    cart_created_at: cartCreated.iso,
    checkout_sent_at: checkoutSent.iso,
    checkout_completed_at: checkoutCompleted.iso,
    cancelled_at: cancelledAt.iso,
    fulfilled_at: fulfilledAt.iso,
    draft_order_id: f.draft_order_id || null,
    invoice_url: f.invoice_url || null,
    
    // Préférences confirmées complètes
    confirmed_category: f.confirmed_category || null,
    confirmed_product_name: f.confirmed_product_name || null,
    confirmed_product_id: f.confirmed_product_id || null,
    confirmed_budget: f.confirmed_budget || null,
    confirmed_size: f.confirmed_size || null,
    confirmed_firmness: f.confirmed_firmness || null,
    confirmed_city: f.confirmed_city || null,
    confirmed_payment_method: f.confirmed_payment_method || null,
    
    // Workflow dashboard
    traite_status: f.traite_status || null,         // workflow dashboard
    traite_by: f.traite_by || null,
    traite_at: traiteAt.iso,
    traite_action: f.traite_action || null,
    next_followup_at: nextFollowupAt.iso,
    traite_note: f.traite_note || null
  };
}
