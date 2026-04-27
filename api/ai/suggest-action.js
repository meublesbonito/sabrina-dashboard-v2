// ─────────────────────────────────────────────
// POST /api/ai/suggest-action
// Lot 6.2 — Generates ONE concrete operational action suggestion in French
// for a single conversation, using OpenAI (model from process.env.DEFAULT_MODEL).
//
// Privacy:
//  - Strict whitelist of fields sent to OpenAI
//  - Conversation parsed and PII-redacted (phone, email, long digits) before send
//  - customer_phone, psid, draft_order_id, invoice_url, confirmed_product_id,
//    customer_last_name, customer_zip, traite_by, traite_note are NEVER sent
//
// Rate limit: in-memory Map, 30s per (user, psid). Multi-instance Vercel may
// allow up to N×1 calls per window; acceptable for v1.
// ─────────────────────────────────────────────

import { requireAuth } from '../_helpers/auth-check.js';
import { ok, fail, safe } from '../_helpers/api-response.js';
import { getRecord } from '../_helpers/airtable.js';

const TABLE = 'CONVERSATIONS';
const RATE_LIMIT_MS = 30_000;
const MAX_CONVERSATION_CHARS = 6000;
const MAX_CONTEXT_WINDOW_PARSE = 50_000;
const MAX_TOKENS = 200;
const TEMPERATURE = 0.3;
const FALLBACK_MODEL = 'gpt-4o-mini';

// ─────────────────────────────────────────────
// PII redaction
// ─────────────────────────────────────────────

const PHONE_REGEX = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const LONG_DIGITS_REGEX = /\b\d{12,}\b/g; // card numbers, IDs, anything 12+ digits

function redactPII(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(EMAIL_REGEX, '[email]')
    .replace(PHONE_REGEX, '[téléphone]')
    .replace(LONG_DIGITS_REGEX, '[numéro masqué]');
}

// ─────────────────────────────────────────────
// Conversation parsing (kept independent of frontend convo-timeline.js)
// ─────────────────────────────────────────────

const TURN_REGEX = /(CLIENT|BOT)\s*:/gi;

function parseConversation(raw, maxChars = MAX_CONVERSATION_CHARS) {
  if (!raw || typeof raw !== 'string') return '';
  const text = raw.length > MAX_CONTEXT_WINDOW_PARSE ? raw.slice(0, MAX_CONTEXT_WINDOW_PARSE) : raw;

  const markers = [];
  let m;
  TURN_REGEX.lastIndex = 0;
  while ((m = TURN_REGEX.exec(text)) !== null) {
    markers.push({ role: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
  }
  if (markers.length === 0) return '';

  const turns = [];
  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const next = markers[i + 1];
    const segment = text.slice(cur.end, next ? next.start : text.length);
    const cleaned = segment.replace(/\|\|\|/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    turns.push({ role: cur.role, text: cleaned });
  }

  // Take the most recent turns that fit in maxChars (chronological order kept)
  let result = '';
  for (let i = turns.length - 1; i >= 0; i--) {
    const line = `${turns[i].role}: ${turns[i].text}\n`;
    if (result.length + line.length > maxChars) break;
    result = line + result;
  }

  return redactPII(result.trim());
}

// ─────────────────────────────────────────────
// Whitelist of fields sent to OpenAI
// ─────────────────────────────────────────────

function buildSanitizedFields(fields) {
  // Only the FIRST name (no last name)
  let firstName = '';
  if (fields.fb_first_name) {
    firstName = String(fields.fb_first_name).trim();
  } else if (fields.customer_name) {
    firstName = String(fields.customer_name).trim().split(/\s+/)[0] || '';
  }

  return {
    customer_first_name: firstName || null,
    customer_city: fields.customer_city || null,
    sales_stage: fields.sales_stage || null,
    conversion_status: fields.conversion_status || null,
    confirmed_category: fields.confirmed_category || null,
    confirmed_budget: fields.confirmed_budget || null,
    confirmed_size: fields.confirmed_size || null,
    confirmed_firmness: fields.confirmed_firmness || null,
    cart_value: fields.cart_value || 0,
    traite_status: fields.traite_status || 'open'
  };
}

function buildPrompt(sanitizedFields, parsedConversation) {
  return `Tu es un assistant opérationnel pour Meubles Bonito, un magasin de liquidation de meubles à Montréal. Sabrina est leur bot Messenger.

Ton job : donner UNE action concrète à faire MAINTENANT par Oussama (le gérant) pour ce client. En français québécois. Maximum 3 phrases. Pas de salutation, pas de formule de politesse — uniquement l'action recommandée. Sois direct et actionnable.

Note : conversion_status peut être imprécis, ne t'y fie pas aveuglément.

Contexte client (champs Airtable) :
${JSON.stringify(sanitizedFields, null, 2)}

Conversation (extrait, plus récent en bas) :
${parsedConversation || '(conversation indisponible)'}

Action recommandée :`;
}

// ─────────────────────────────────────────────
// Rate limit (in-memory)
//
// NOTE: `vercel dev` reloads the module on every HTTP request, so this Map
// is effectively reset between calls in local development. In production,
// Vercel keeps warm instances that retain module state for the lifetime of
// the instance, so the limit is enforced (per warm instance).
// The logic is unit-testable via the helpers exported on __test__ below.
// ─────────────────────────────────────────────

const lastCall = new Map(); // key: `${user}_${psid_or_id}` → timestamp ms

function checkRateLimit(key, nowMs) {
  const lastTs = lastCall.get(key) || 0;
  const elapsed = nowMs - lastTs;
  if (elapsed < RATE_LIMIT_MS) {
    return {
      allowed: false,
      retry_after: Math.ceil((RATE_LIMIT_MS - elapsed) / 1000)
    };
  }
  return { allowed: true };
}

function recordCall(key, nowMs) {
  lastCall.set(key, nowMs);
}

// ─────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'POST only');

  const session = requireAuth(req, res);
  if (!session) return;

  return safe('api/ai/suggest-action', res, async () => {
    const body = req.body || {};
    const id = typeof body.id === 'string' ? body.id.trim() : '';

    if (!id) return fail(res, 400, 'id required');
    if (!id.startsWith('rec')) return fail(res, 400, 'Invalid id format');

    // Fetch record (Airtable 4xx → 404)
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

    const fields = record.fields || {};
    const psid = fields.psid || '';
    const rateKey = `${session.user || 'anon'}_${psid || id}`;

    // Rate limit check (per user × psid)
    const now = Date.now();
    const rl = checkRateLimit(rateKey, now);
    if (!rl.allowed) {
      return res.status(429).json({
        ok: false,
        error: `Réessaye dans ${rl.retry_after}s`,
        retry_after: rl.retry_after
      });
    }

    // Mark BEFORE the OpenAI call so concurrent requests don't double-trigger
    recordCall(rateKey, now);

    // Build sanitized prompt
    const sanitized = buildSanitizedFields(fields);
    const conversation = parseConversation(fields.context_window || '');
    const prompt = buildPrompt(sanitized, conversation);

    // Resolve model + key
    const apiKey = process.env.OPENAI_KEY;
    const model = ((process.env.DEFAULT_MODEL || '').trim()) || FALLBACK_MODEL;
    if (!apiKey) {
      console.error('[suggest-action] OPENAI_KEY missing in environment');
      return fail(res, 500, 'AI not configured');
    }

    // Call OpenAI Chat Completions
    let aiRes;
    try {
      aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          // Newer OpenAI models (o-series, gpt-5.x) require max_completion_tokens
          // instead of the legacy max_tokens. Chat Completions still accepts this.
          max_completion_tokens: MAX_TOKENS,
          temperature: TEMPERATURE
        })
      });
    } catch (err) {
      console.error('[suggest-action] fetch failed:', err && err.message);
      return fail(res, 502, 'AI service unreachable');
    }

    if (!aiRes.ok) {
      const txt = (await aiRes.text().catch(() => '')).slice(0, 200);
      console.error(`[suggest-action] OpenAI ${aiRes.status}: ${txt}`);
      return fail(res, 502, `AI service error (${aiRes.status})`);
    }

    let json;
    try {
      json = await aiRes.json();
    } catch {
      return fail(res, 502, 'AI invalid response');
    }

    const suggestion = (json?.choices?.[0]?.message?.content || '').trim();
    if (!suggestion) return fail(res, 502, 'AI empty response');

    return ok(res, { suggestion, model_used: model });
  });
}

// ─────────────────────────────────────────────
// Test-only exports — used by automated tests, never imported by handler
// path callers. Vercel serverless still treats default export as the handler.
// ─────────────────────────────────────────────

export const __test__ = {
  redactPII,
  parseConversation,
  buildSanitizedFields,
  buildPrompt,
  checkRateLimit,
  recordCall,
  _resetRateLimit: () => lastCall.clear(),
  _RATE_LIMIT_MS: RATE_LIMIT_MS
};
