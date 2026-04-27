// ─────────────────────────────────────────────
// POST /api/actions/signal-traite
// Lot 7.2 — Toggle the `traité` field on a single SIGNAUX record.
//
// `traité` (with accent) is an Airtable checkbox field. Setting it to true
// marks the signal as treated; false clears it.
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { updateRecord } from '../_helpers/airtable-write.js';

const TABLE = 'SIGNAUX';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/actions/signal-traite', res, async () => {
    const body = req.body || {};
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const traite = body.traite;

    if (!id) return fail(res, 400, 'id required');
    if (!id.startsWith('rec')) return fail(res, 400, 'Invalid id format');
    if (typeof traite !== 'boolean') {
      return fail(res, 400, 'traite must be a boolean');
    }

    try {
      await updateRecord(TABLE, id, {
        // Field name in Airtable carries the French accent.
        'traité': traite
      });
    } catch (err) {
      if (err && typeof err.message === 'string' && /Airtable write 4\d\d/.test(err.message)) {
        return fail(res, 404, 'Signal record not found');
      }
      throw err;
    }

    return ok(res, { id, traite });
  });
}
