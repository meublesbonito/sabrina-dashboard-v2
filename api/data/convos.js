// ─────────────────────────────────────────────
// GET /api/data/convos
// Liste des conversations Airtable
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { listRecords, normalizeDate } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';

// ─────────────────────────────────────────────
// Lot 5.1 — Détection messages substantiels
// ─────────────────────────────────────────────

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
 *   - nbClient : nombre de messages client
 *   - nbSubstantial : nombre de messages substantiels
 *
 * Version BLINDÉE : ne plante jamais, retourne { 0, 0 } si erreur.
 */
function analyzeContextWindow(contextWindow) {
  try {
    if (!contextWindow || typeof contextWindow !== 'string') {
      return { nbClient: 0, nbSubstantial: 0 };
    }

    // Protection : tronquer à 50 000 chars max (évite timeout sur convos énormes)
    const text = contextWindow.length > 50000
      ? contextWindow.slice(0, 50000)
      : contextWindow;

    const parts = text.split(/CLIENT:/i);
    if (parts.length <= 1) {
      return { nbClient: 0, nbSubstantial: 0 };
    }

    const clientMessages = parts.slice(1).map(part => {
      try {
        if (typeof part !== 'string') return '';
        const idxBot = part.indexOf('BOT:');
        const idxSep = part.indexOf('|||');
        const cuts = [idxBot, idxSep].filter(i => i !== -1);
        const cutAt = cuts.length ? Math.min(...cuts) : -1;
        return cutAt === -1 ? part.trim() : part.slice(0, cutAt).trim();
      } catch {
        return '';
      }
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
      } catch {
        // Skip ce message en cas d'erreur, continue les autres
      }
    }

    return { nbClient, nbSubstantial };
  } catch (err) {
    console.error('[analyzeContextWindow] error:', err && err.message);
    return { nbClient: 0, nbSubstantial: 0 };
  }
}

// ─────────────────────────────────────────────
// Mapping Airtable → API response
// Version BLINDÉE : si une convo plante, on la skip
// ─────────────────────────────────────────────

function mapConvo(record) {
  try {
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
      // ⭐ Lot 5.1 — Calculés côté API
      nb_messages_client: nbClient,
      nb_substantial_messages: nbSubstantial
    };
  } catch (err) {
    console.error('[mapConvo] error on record', record && record.id, ':', err && err.message);
    return null; // Sera filtré ensuite
  }
}

// ─────────────────────────────────────────────
// Lot 6 — Search formula (multi-field, case-insensitive substring)
// ─────────────────────────────────────────────

function buildSearchFormula(q) {
  // Escape single quotes for Airtable formula
  const safe = q.replace(/'/g, "\\'");
  return `OR(
    SEARCH('${safe}', LOWER({customer_name} & '')) > 0,
    SEARCH('${safe}', LOWER({fb_first_name} & '')) > 0,
    SEARCH('${safe}', LOWER({fb_last_name} & '')) > 0,
    SEARCH('${safe}', LOWER({customer_phone} & '')) > 0,
    SEARCH('${safe}', LOWER({psid} & '')) > 0,
    SEARCH('${safe}', LOWER({customer_city} & '')) > 0
  )`;
}

// ─────────────────────────────────────────────
// Lot 8.3 — Sort + Filter mappings (server-side via Airtable)
// ─────────────────────────────────────────────

const DEFAULT_SORT = [{ field: 'Last Modified Time', direction: 'desc' }];

const SORT_MAP = {
  recent:        [{ field: 'last_message_time', direction: 'desc' }],
  oldest:        [{ field: 'last_message_time', direction: 'asc'  }],
  cart_desc:     [{ field: 'cart_value',        direction: 'desc' }],
  messages_desc: [{ field: 'nb_messages',       direction: 'desc' }],
  name_asc:      [{ field: 'customer_name',     direction: 'asc'  }]
};

function buildFilterFormula(filter) {
  switch (filter) {
    case 'active':             return `{status} = 'active'`;
    case 'human_only':         return `{status} = 'human_only'`;
    case 'with_cart':          return `{cart_value} > 0`;
    case 'checkout_sent':      return `NOT({checkout_sent_at} = BLANK())`;
    case 'checkout_completed': return `NOT({checkout_completed_at} = BLANK())`;
    case 'with_phone':         return `LEN({customer_phone} & '') > 0`;
    default:                   return null; // 'all' or unknown → no filter
  }
}

function combineFormulas(...formulas) {
  const present = formulas.filter(Boolean);
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];
  return `AND(${present.join(', ')})`;
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'GET only');

  const session = requireAuth(req, res);
  if (!session) return;

return safe('api/data/convos', res, async () => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);

    // Lot 6 — optional multi-field search
    const search = String(req.query.search || '').trim().toLowerCase();
    const searchFormula = search ? buildSearchFormula(search) : null;

    // Lot 8.3 — optional server-side filter
    const filterParam = String(req.query.filter || '').trim().toLowerCase();
    const filterFormula = buildFilterFormula(filterParam);

    const filterByFormula = combineFormulas(searchFormula, filterFormula);

    // Lot 8.3 — optional sort (defaults to Last Modified Time desc for back-compat)
    const sortParam = String(req.query.sort || '').trim().toLowerCase();
    const sort = SORT_MAP[sortParam] || DEFAULT_SORT;

    // Lot 8.3 — optional pagination via Airtable offset token
    const offset = String(req.query.offset || '').trim() || undefined;

    // Lot 8.3 — Airtable's `maxRecords` is a hard cap with no continuation
    // token; for pagination we use `pageSize` (capped at Airtable's max of
    // 100) and loop until we have `limit` records or run out of pages. This
    // preserves Today's `?limit=200` (single call from the client's POV
    // returns up to 200) while enabling Load More for Clients (`limit=100`
    // per page + offset for the next).
    const result = await fetchUpToLimit({
      filterByFormula,
      sort
    }, limit, offset);

    // Map + filter null (records that crashed inside mapConvo)
    const data = result.records
      .map(mapConvo)
      .filter(c => c !== null);

    return ok(res, data, { nextOffset: result.offset });
  });
}

async function fetchUpToLimit(baseOpts, limit, startOffset) {
  const AIRTABLE_PAGE_MAX = 100;
  const collected = [];
  let currentOffset = startOffset;
  let lastOffsetReturned = null;

  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const pageSize = Math.min(remaining, AIRTABLE_PAGE_MAX);

    const r = await listRecords(TABLE, {
      ...baseOpts,
      pageSize,
      offset: currentOffset,
      returnPagination: true
    });

    collected.push(...r.records);
    lastOffsetReturned = r.offset;

    // No more pages, OR Airtable returned an empty page (defensive).
    if (!r.offset || r.records.length === 0) break;
    currentOffset = r.offset;
  }

  return {
    records: collected.slice(0, limit),
    offset: lastOffsetReturned
  };
}
