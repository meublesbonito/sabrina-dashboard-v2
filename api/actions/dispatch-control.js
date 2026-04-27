// ─────────────────────────────────────────────
// POST /api/actions/dispatch-control
// Lot 8.1 — Toggle the Sabrina dispatcher status on a single conversation.
//
// Field: `status` (top-level on CONVERSATIONS).
// Allowed input values: 'active' | 'human_only' (allowlist enforced).
//   - 'active'      → Sabrina responds automatically (default state).
//   - 'human_only'  → Sabrina stops responding; the team handles the convo manually.
//
// Defense-in-depth: before writing, we read the current status. If the field
// already holds a custom value managed by an automation (e.g. a string like
// "carted + cart_created_at = ...", or 'handed_off', 'closed'), we refuse
// the update with 409 Conflict so we never overwrite dispatcher metadata.
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { getRecord } from '../_helpers/airtable.js';
import { updateRecord } from '../_helpers/airtable-write.js';

const TABLE = 'CONVERSATIONS';
const ALLOWED_TARGET_STATUSES = ['active', 'human_only'];
// Statuses we are allowed to overwrite. Anything else (e.g. 'handed_off',
// 'closed', custom strings) is rejected to avoid clobbering automation data.
const OVERWRITABLE_STATUSES = new Set(['active', 'human_only', '', null, undefined]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/actions/dispatch-control', res, async () => {
    const body = req.body || {};
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : '';

    if (!id) return fail(res, 400, 'id required');
    if (!id.startsWith('rec')) return fail(res, 400, 'Invalid id format');
    if (!ALLOWED_TARGET_STATUSES.includes(status)) {
      return fail(res, 400, `status must be one of: ${ALLOWED_TARGET_STATUSES.join(', ')}`);
    }

    // Read current status to ensure we don't overwrite a custom dispatcher value.
    let record = null;
    try {
      record = await getRecord(TABLE, id);
    } catch (err) {
      if (err && typeof err.message === 'string' && /Airtable 4\d\d/.test(err.message)) {
        return fail(res, 404, 'Conversation not found');
      }
      throw err;
    }
    if (!record) return fail(res, 404, 'Conversation not found');

    const currentStatus = record.fields?.status;
    if (!OVERWRITABLE_STATUSES.has(currentStatus)) {
      res.status(409).json({
        ok: false,
        error: 'Status custom détecté — refusé pour ne pas écraser une automation.',
        current_status: String(currentStatus)
      });
      return;
    }

    try {
      await updateRecord(TABLE, id, { status });
    } catch (err) {
      if (err && typeof err.message === 'string' && /Airtable write 4\d\d/.test(err.message)) {
        return fail(res, 404, 'Conversation not found');
      }
      throw err;
    }

    return ok(res, { id, status });
  });
}
