// ─────────────────────────────────────────────
// GET /api/data/ping
// Health-check : auth OK + Airtable OK
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, safe } from '../_helpers/api-response.js';
import { pingAirtable } from '../_helpers/airtable.js';

export default async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  
  return safe('api/data/ping', res, async () => {
    const airtableOk = await pingAirtable();
    
    return ok(res, {
      user: session.user,
      airtable: airtableOk ? 'ok' : 'down',
      timestamp: new Date().toISOString()
    });
  });
}
