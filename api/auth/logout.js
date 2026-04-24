// ─────────────────────────────────────────────
// API: POST /api/auth/logout
// ─────────────────────────────────────────────

import { clearSessionCookie } from '../_helpers/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  clearSessionCookie(res);
  return res.status(200).json({ success: true });
}
