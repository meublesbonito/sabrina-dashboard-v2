// ─────────────────────────────────────────────
// GET /api/data/errors
// Liste des erreurs Sabrina (table tblErrors)
// resolved = single select avec valeur 'checked'
// Linked records normalisés (array → string)
// Table vide = ok:true + data:[]
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, safe } from '../_helpers/api-response.js';
import { listRecords, normalizeDate, firstLinkedId } from '../_helpers/airtable.js';

const TABLE = 'tblErrors';
const MAX_LIMIT = 200;

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  
  return safe('api/data/errors', res, async () => {
    const reqLimit = parseInt(req.query?.limit ?? '50', 10);
    const limit = Math.max(1, Math.min(reqLimit || 50, MAX_LIMIT));
    
    // resolved est un single select : valeur 'checked' = traité
    const resolvedFilter = (req.query?.resolved ?? 'false').toString().toLowerCase();
    let filterByFormula = '';
    if (resolvedFilter === 'false') {
      filterByFormula = `NOT({resolved} = 'checked')`;
    } else if (resolvedFilter === 'true') {
      filterByFormula = `{resolved} = 'checked'`;
    }
    
    const records = await listRecords(TABLE, {
      maxRecords: limit,
      filterByFormula: filterByFormula || undefined,
      sort: [
        { field: 'timestamp', direction: 'desc' }
      ]
    });
    
    const data = records.map(toError);
    return ok(res, data, { count: data.length });
  });
}

/**
 * Mappe un record tblErrors vers camelCase propre.
 * conversation_record_id (linked record array) devient string.
 */
function toError(record) {
  const f = record.fields || {};
  const ts = normalizeDate(f.timestamp);
  
  return {
    id: record.id,
    psid: f.psid || null,
    moduleId: f.module_id || null,
    errorType: f.error_type || null,
    errorMessage: f.error_message || null,
    timestamp: ts.iso,
    timestampRaw: ts.raw,
    resolved: f.resolved || null,
    conversationRecordId: firstLinkedId(f.conversation_record_id)
  };
}
