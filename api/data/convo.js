// ─────────────────────────────────────────────
// GET /api/data/convos
// Liste des conversations Airtable
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { listRecords, normalizeDate, firstLinkedId } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';

// ─── Mots-clés substantiels (Lot 5.1) ───
const SUBSTANTIAL_KEYWORDS = [
  // Engagement explicite
  'oui', 'je prends', 'ok',
  // Prix / budget
  'combien', 'prix', 'cher', 'budget', 'coute', 'coût',
  // Logistique
  'livraison', 'livrer', 'apporter', 'transport',
  'adresse', 'magasin', 'visite', 'passer', 'venir',
  // Disponibilité
  'disponible', 'dispo', 'quand', "aujourd'hui", 'demain',
  // Finalisation
  'confirme', 'paiement', 'payer', 'affirm', 'cod',
  // Contact
  'téléphone', 'numéro', 'mon nom', 'tel'
];

const PHONE_REGEX = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/;

/**
 * Analyse le context_window pour compter :
 * - nbClient : nombre total de messages client
 * - nbSubstantial : nombre de messages "substantiels"
 *
 * Un message est substantiel si AU MOINS UN :
 * - Plus de 4 mots
 * - Contient un téléphone (regex)
 * - Contient un mot-clé fort (case-insensitive)
 */
function analyzeContextWindow(contextWindow) {
  if (!contextWindow || typeof contextWindow !== 'string') {
    return { nbClient: 0, nbSubstantial: 0 };
  }

  // Split sur "CLIENT:" pour isoler chaque message client
  const parts = contextWindow.split(/CLIENT:/i);
  // parts[0] = avant le 1er CLIENT, parts[1..n] = messages client
  const clientMessages = parts.slice(1).map(part => {
    // Tronque au prochain "BOT:" ou "|||"
    const idxBot = part.indexOf('BOT:');
    const idxSep = part.indexOf('|||');
    const cuts = [idxBot, idxSep].filter(i => i !== -1);
    const cutAt = cuts.length ? Math.min(...cuts) : -1;
    return cutAt === -1 ? part.trim() : part.slice(0, cutAt).trim();
  });

  const nbClient = clientMessages.length;

  let nbSubstantial = 0;
  for (const msg of clientMessages) {
    if (!msg) continue;
    const lowerMsg = msg.toLowerCase();
    const wordCount = msg.split(/\s+/).filter(w => w.length > 0).length;

    const isSubstantial =
      wordCount > 4 ||
      PHONE_REGEX.test(msg) ||
      SUBSTANTIAL_KEYWORDS.some(kw => lowerMsg.includes(kw));

    if (isSubstantial) nbSubstantial++;
  }

  return { nbClient, nbSubstantial };
}

function mapConvo(record) {
  const fields = record.fields || {};
  const { nbClient, nbSubstantial } = analyzeContextWindow(fields.context_window);

  return {
    id: record.id,
    psid: fields.psid || '',
    platform: fields.platform || 'messenger',
    fbFirstName: fields.fb_first_name || '',
    fbLastName: fields.fb_last_name || '',
    customerName: fields.customer_name || '',
    customerPhone: fields.customer_phone || '',
    customerCity: fields.customer_city || '',
    customerProvince: fields.customer_province || '',
    customerZip: fields.customer_zip || '',
    nbMessages: fields.nb_messages || 0,
    lastAction: fields.last_action || '',
    allActions: fields.all_actions || '',
    contextPreview: (fields.context_window || '').slice(0, 500),
    lastMessageTime: normalizeDate(fields.last_message_time),
    lastModifiedTime: normalizeDate(fields['Last Modified Time']),
    conversationStartedAt: normalizeDate(fields.conversation_started_at),
    status: fields.status || 'active',
    conversionStatus: fields.conversion_status || '',
    salesStage: fields.sales_stage || '',
    oppStatus: fields.opp_status || '',
    cartValue: fields.cart_value || 0,
    cartCreatedAt: normalizeDate(fields.cart_created_at),
    checkoutSentAt: normalizeDate(fields.checkout_sent_at),
    checkoutCompletedAt: normalizeDate(fields.checkout_completed_at),
    draftOrderId: fields.draft_order_id || '',
    invoiceUrl: fields.invoice_url || '',
    confirmedCategory: fields.confirmed_category || '',
    confirmedBudget: fields.confirmed_budget || '',
    confirmedSize: fields.confirmed_size || '',
    confirmedFirmness: fields.confirmed_firmness || '',
    confirmedProductName: fields.confirmed_product_name || '',
    confirmedProductId: fields.confirmed_product_id || '',
    confirmedPaymentMethod: fields.confirmed_payment_method || '',
    traiteStatus: fields.traite_status || 'open',
    traiteBy: fields.traite_by || '',
    traiteAt: normalizeDate(fields.traite_at),
    traiteAction: fields.traite_action || '',
    nextFollowupAt: normalizeDate(fields.next_followup_at),
    traiteNote: fields.traite_note || '',
    // ⭐ Lot 5.1 — Calculés côté API
    nbMessagesClient: nbClient,
    nbSubstantialMessages: nbSubstantial
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/data/convos', res, async () => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const offset = req.query.offset || undefined;

    const { records, nextOffset } = await listRecords(TABLE, {
      pageSize: limit,
      offset,
      sort: [{ field: 'Last Modified Time', direction: 'desc' }]
    });

    const data = records.map(mapConvo);

    return ok(res, data, { nextOffset });
  });
}
