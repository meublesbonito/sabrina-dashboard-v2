// ─────────────────────────────────────────────
// GET /api/data/signals
// Liste des signaux DETECTOR
// Mapping camelCase + traité (avec accent) → traite (sans)
// Linked records normalisés (array → string)
// Table vide = ok:true + data:[]
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, safe } from '../_helpers/api-response.js';
import { listRecords, normalizeDate, firstLinkedId } from '../_helpers/airtable.js';

const TABLE = 'SIGNAUX';
const MAX_LIMIT = 200;

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  
  return safe('api/data/signals', res, async () => {
    const reqLimit = parseInt(req.query?.limit ?? '100', 10);
    const limit = Math.max(1, Math.min(reqLimit || 100, MAX_LIMIT));

    // Par défaut : retourne uniquement les non-traités
    const traite = (req.query?.traite ?? 'false').toString().toLowerCase();
    const filters = [];
    if (traite === 'false') {
      filters.push(`NOT({traité} = TRUE())`);
    } else if (traite === 'true') {
      filters.push(`{traité} = TRUE()`);
    }

    // Lot 6 — optional psid filter for drawer (single conversation)
    const psid = String(req.query?.psid ?? '').trim();
    if (psid) {
      const safePsid = psid.replace(/'/g, "\\'");
      filters.push(`{psid} = '${safePsid}'`);
    }

    const filterByFormula = filters.length > 1
      ? `AND(${filters.join(', ')})`
      : (filters[0] || undefined);

    const records = await listRecords(TABLE, {
      maxRecords: limit,
      filterByFormula,
      sort: [
        { field: 'date_detection', direction: 'desc' }
      ]
    });
    
    const data = records.map(toSignal);
    return ok(res, data, { count: data.length });
  });
}

/**
 * Mappe un record SIGNAUX vers camelCase propre.
 * Le champ "traité" (avec accent) devient "traite" (sans).
 * conversation_record_id (linked record array) devient string.
 */
function toSignal(record) {
  const f = record.fields || {};
  const dateDetection = normalizeDate(f.date_detection);
  const lastSeenAt = normalizeDate(f.last_seen_at);
  
  return {
    id: record.id,
    signalId: f.signal_id || null,
    psid: f.psid || null,
    conversationRecordId: firstLinkedId(f.conversation_record_id),
    type: f.type || null,
    gravite: f.gravite || null,
    description: f.description || null,
    extraitConvo: f.extrait_convo || null,
    suggestion: f.suggestion || null,
    dateDetection: dateDetection.iso,
    dateDetectionRaw: dateDetection.raw,
    lastSeenAt: lastSeenAt.iso,
    lastSeenAtRaw: lastSeenAt.raw,
    traite: f['traité'] === true || f['traité'] === 'true'
  };
}
