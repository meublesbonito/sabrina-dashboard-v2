// ─────────────────────────────────────────────
// POST /api/actions/update
// Update du statut workflow d'une conversation
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { updateRecord } from '../_helpers/airtable-write.js';

const TABLE = 'CONVERSATIONS';
const RELANCES_TABLE = 'RELANCES';

const ACTION_TO_STATUS = {
  'converted': 'converted',
  'no_answer': 'called_no_answer',
  'lost':      'lost',
  'done':      'done'
};

const VALID_ACTIONS = Object.keys(ACTION_TO_STATUS);

// ─────────────────────────────────────────────
// RELANCES — target="relance" co-localisation
// Update RELANCES.statut only. Co-located here to stay under
// the Vercel Hobby 12-functions limit. Strict allowlist —
// no other RELANCES field is writable via this endpoint.
// ─────────────────────────────────────────────

const RELANCE_ACTION_TO_STATUT = {
  'mark_called':    'appelé',
  'mark_converted': 'converti',
  'mark_lost':      'perdu',
  'mark_ignored':   'ignoré'
};

const VALID_RELANCE_ACTIONS = Object.keys(RELANCE_ACTION_TO_STATUT);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return fail(res, 405, 'POST only');
  }
  
  const session = requireAuth(req, res);
  if (!session) return;
  
  // ─── RELANCES branch (co-located, strict allowlist, statut-only write) ───
  const target = req.body && req.body.target;
  if (target === 'relance') {
    return safe('api/actions/update[relance]', res, async () => {
      const { id, action } = req.body || {};
      if (!id || typeof id !== 'string' || !id.startsWith('rec')) {
        return fail(res, 400, 'id invalide (doit commencer par "rec")');
      }
      if (!action || !VALID_RELANCE_ACTIONS.includes(action)) {
        return fail(res, 400, `action doit être : ${VALID_RELANCE_ACTIONS.join(', ')}`);
      }
      const newStatut = RELANCE_ACTION_TO_STATUT[action];
      // Strict: only the statut field is updated. Nothing else.
      await updateRecord(RELANCES_TABLE, id, { statut: newStatut });
      return ok(res, { id, statut: newStatut });
    });
  }

  return safe('api/actions/update', res, async () => {
    const { id, action, note, followupAt } = req.body || {};

    // ─── Validations communes ───
    if (!id || typeof id !== 'string' || !id.startsWith('rec')) {
      return fail(res, 400, 'id invalide (doit commencer par "rec")');
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return fail(res, 400, `action doit être : ${VALID_ACTIONS.join(', ')}`);
    }
    
    // ─── Validations spécifiques ───
    let parsedFollowupAt = null;
    if (action === 'no_answer') {
      if (!followupAt) {
        return fail(res, 400, 'followupAt requis pour no_answer');
      }
      const ts = new Date(followupAt).getTime();
      if (isNaN(ts)) {
        return fail(res, 400, 'followupAt date invalide');
      }
      if (ts <= Date.now()) {
        return fail(res, 400, 'followupAt doit être dans le futur');
      }
      parsedFollowupAt = new Date(ts).toISOString();
    }
    
    if (action === 'lost') {
      if (!note || typeof note !== 'string' || !note.trim()) {
        return fail(res, 400, 'note (raison) obligatoire pour lost');
      }
    }
    
    // ─── Construction des champs Airtable ───
    const now = new Date();
    const traiteStatus = ACTION_TO_STATUS[action];
    const user = session.user;
    
    const fields = {
      traite_status: traiteStatus,
      traite_by:     user,
      traite_at:     now.toISOString(),
      traite_action: buildActionDescription(action, user, note, parsedFollowupAt)
    };
    
    // next_followup_at : seulement pour no_answer, sinon vider explicitement
    if (action === 'no_answer') {
      fields.next_followup_at = parsedFollowupAt;
    } else {
      fields.next_followup_at = null;
    }
    
    if (note && typeof note === 'string' && note.trim()) {
      fields.traite_note = note.trim().slice(0, 1000);
    }
    
    // ─── Update Airtable ───
    await updateRecord(TABLE, id, fields);
    
    return ok(res, {
      id,
      action,
      traite_status: traiteStatus,
      traite_by: user,
      traite_at: fields.traite_at,
      next_followup_at: parsedFollowupAt
    });
  });
}

function buildActionDescription(action, user, note, followupAt) {
  switch (action) {
    case 'converted':
      return `Marqué converti par ${user}`;
    case 'no_answer':
      return `Appelé sans réponse par ${user} — rappel le ${followupAt || 'à définir'}`;
    case 'lost':
      return `Marqué perdu par ${user} — raison: ${note || 'non spécifiée'}`;
    case 'done':
      return `Marqué traité par ${user}`;
    default:
      return `Action ${action} par ${user}`;
  }
}
