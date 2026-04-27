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
    
    // Lot 7.2 — `resolved` is actually an Airtable CHECKBOX (returns 1/0,
    // exposed as boolean true|undefined). The legacy single-select 'checked'
    // formula never matched a checkbox, so the previous filter was a no-op
    // and returned every record regardless of state.
    const resolvedFilter = (req.query?.resolved ?? 'false').toString().toLowerCase();
    let filterByFormula = '';
    if (resolvedFilter === 'false') {
      filterByFormula = `NOT({resolved})`;
    } else if (resolvedFilter === 'true') {
      filterByFormula = `{resolved} = TRUE()`;
    }
    // Any other value (e.g. 'all') leaves filterByFormula empty → no filter.
    
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
    // Lot 7.2 — `resolved` is an Airtable CHECKBOX (returns boolean true,
    // or undefined when not checked). Lot 7.1 incorrectly assumed it was a
    // single-select with value 'checked', which silently coerced everything
    // to false. We accept both shapes for forward/backward compatibility.
    resolved: f.resolved === true || f.resolved === 'checked',
    conversationRecordId: firstLinkedId(f.conversation_record_id)
  };
}
