// ─────────────────────────────────────────────
// POST /api/actions/error-resolve
// Lot 7.2 — Toggle the `resolved` field on a single tblErrors record.
//
// `resolved` is an Airtable single-select with the only meaningful value
// 'checked'. Setting it to 'checked' marks the error as resolved; setting
// it to '' clears the value (with typecast: true on the PATCH).
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { updateRecord } from '../_helpers/airtable-write.js';

const TABLE = 'tblErrors';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/actions/error-resolve', res, async () => {
    const body = req.body || {};
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const resolved = body.resolved;

    if (!id) return fail(res, 400, 'id required');
    if (!id.startsWith('rec')) return fail(res, 400, 'Invalid id format');
    if (typeof resolved !== 'boolean') {
      return fail(res, 400, 'resolved must be a boolean');
    }

    try {
      // `resolved` is an Airtable checkbox; send a real boolean.
      await updateRecord(TABLE, id, {
        resolved: resolved
      });
    } catch (err) {
      // Airtable returns 4xx for unknown ids / malformed PATCH → map to 404.
      if (err && typeof err.message === 'string' && /Airtable write 4\d\d/.test(err.message)) {
        return fail(res, 404, 'Error record not found');
      }
      throw err;
    }

    return ok(res, { id, resolved });
  });
}
