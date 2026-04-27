// ─────────────────────────────────────────────
// BUILD ACTION QUEUE — Le cœur du dashboard
//
// Pure function : convos + signals + errors → actions[] triées
// AUCUN fetch, AUCUN Airtable, AUCUNE API
//
// Ordre de détection (du plus urgent au moins urgent) :
//   1. FOLLOWUP_DUE       → rappel programmé arrivé
//   2. CALL_NOW           → opportunity + téléphone
//   3. FRUSTRATED         → signal frustration OU keywords texte
//   4. BOT_BLOCKED        → signal broken
//   5. COD_CONFIRM        → paiement COD pas complété
//   6. ABANDONED_CART     → panier ouvert
//   7. MESSENGER_FOLLOWUP → opportunity sans téléphone
//
// Lot 5.1 : filtre ad-template / faux signaux Facebook
// ─────────────────────────────────────────────

import { ACTION_TYPES, STATUSES } from './action-shape.js';
import { extractClientPhone } from './phone-filter.js';
import {
  basePriority,
  applyTimeEscalation,
  applySignalGraviteEscalation,
  priorityRank
} from './priorities.js';
import { estimateRiskValue } from './risk-value.js';
import { dedupeByPsid } from './dedupe.js';

const FB_PAGE_ID = '321731554364149'; // public, not a secret

const FRUSTRATION_KEYWORDS = [
  'pas satisfait', 'frustré', 'frustre',
  'ça marche pas', 'ca marche pas', 'marche pas',
  'tu comprends pas', 'tu comprends rien',
  'arrête', 'arrete',
  'service mauvais', 'mauvais service',
  'service nul', 'nul ton service',
  'pourri', 'horrible',
  'remboursement', 'rembourser'
];

/**
 * Pipeline principal.
 * @param {Object} input - { convos, signals, errors }
 * @returns {Array<Action>} - triées par priorité desc, puis attente desc
 */
export function buildActionQueue({ convos = [], signals = [], errors = [] } = {}) {
  const candidates = [];
  const signalsByPsid = indexByPsid(signals);
  const convosByPsid = indexConvosByPsid(convos);
  
  for (const convo of convos) {
    if (!convo || !convo.psid) continue;
    
    // Skip si déjà fini (sauf called_no_answer qui peut générer FOLLOWUP_DUE)
    const ts = convo.traite_status;
    if (ts === STATUSES.DONE || ts === STATUSES.CONVERTED || ts === STATUSES.LOST) {
      continue;
    }
    
    const convoSignals = signalsByPsid.get(convo.psid) || [];
    const action = detectAction(convo, convoSignals);
    if (action) candidates.push(action);
  }
  
  // Déduplication par PSID
  const deduped = dedupeByPsid(candidates);
  
  // ─── Lot 5.1 — Filtre ad-template / faux signaux d'achat ───
  const filtered = deduped.filter(action => {
    const convo = convosByPsid.get(action.psid);
    return !isAdTemplateNoise(action, convo);
  });
  
  // Tri : priorité asc (CRITICAL = 0), puis waitMinutes desc
  filtered.sort((a, b) => {
    const r = priorityRank(a.priority) - priorityRank(b.priority);
    if (r !== 0) return r;
    return (b.waitMinutes || 0) - (a.waitMinutes || 0);
  });
  
  return filtered;
}

/**
 * Détermine quel actionType s'applique à une convo + ses signaux.
 * Retourne null si aucune action pertinente détectée.
 */
function detectAction(convo, convoSignals) {
  const waitMinutes = computeWaitMinutes(convo);
  
  // Téléphone client (filtré contre le numéro magasin partout, y compris customer_phone)
  const phone = extractClientPhone(convo.context_preview)
              || extractClientPhone(convo.last_message)
              || extractClientPhone(convo.customer_phone);
  
  // ─── 1. FOLLOWUP_DUE ───
  if (convo.traite_status === STATUSES.CALLED_NO_ANSWER
      && convo.next_followup_at) {
    const followupTime = new Date(convo.next_followup_at).getTime();
    if (!isNaN(followupTime) && followupTime <= Date.now()) {
      return makeAction(convo, {
        actionType: ACTION_TYPES.FOLLOWUP_DUE,
        reason: 'Rappel programmé arrivé à échéance',
        phone,
        waitMinutes,
        signal: null
      });
    }
  }
  
  // ─── 2. CALL_NOW ───
  const oppSignal = convoSignals.find(s => s.type === 'opportunity');
  if (oppSignal && phone) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.CALL_NOW,
      reason: oppSignal.description || 'Téléphone détecté + intention achat',
      phone,
      waitMinutes,
      signal: oppSignal
    });
  }
  
  // ─── 3. FRUSTRATED (signal OU keywords) ───
  const frustrationSignal = convoSignals.find(s => 
    ['frustration', 'frustrated', 'hostile'].includes(String(s.type).toLowerCase())
  );
  const hasFrustrationKeywords = detectFrustrationKeywords(convo.context_preview)
                              || detectFrustrationKeywords(convo.last_message);
  if (frustrationSignal || hasFrustrationKeywords) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.FRUSTRATED,
      reason: frustrationSignal?.description || 'Mots clés négatifs détectés dans la conversation',
      phone,
      waitMinutes,
      signal: frustrationSignal
    });
  }
  
  // ─── 4. BOT_BLOCKED ───
  const brokenSignal = convoSignals.find(s => s.type === 'broken');
  if (brokenSignal) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.BOT_BLOCKED,
      reason: brokenSignal.description || 'Sabrina bloquée — conversation en boucle',
      phone,
      waitMinutes,
      signal: brokenSignal
    });
  }
  
  // ─── 5. COD_CONFIRM ───
  const paymentMethod = String(convo.confirmed_payment_method || '').toLowerCase();
  if (paymentMethod.includes('cod')
      && !convo.checkout_completed_at) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.COD_CONFIRM,
      reason: 'COD à confirmer avant livraison',
      phone,
      waitMinutes,
      signal: null
    });
  }
  
  // ─── 6. ABANDONED_CART ───
  const isAbandoned = (convo.cart_created_at && !convo.checkout_completed_at)
    && (convo.conversion_status === 'carted' || convo.sales_stage === 'ABANDONED');
  if (isAbandoned) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.ABANDONED_CART,
      reason: 'Panier ouvert, checkout non complété',
      phone,
      waitMinutes,
      signal: null
    });
  }
  
  // ─── 7. MESSENGER_FOLLOWUP — opportunity sans téléphone ───
  if (oppSignal && !phone) {
    return makeAction(convo, {
      actionType: ACTION_TYPES.MESSENGER_FOLLOWUP,
      reason: oppSignal.description || 'Opportunité détectée — relance Messenger',
      phone: null,
      waitMinutes,
      signal: oppSignal
    });
  }
  
  return null;
}

/**
 * Calcule waitMinutes depuis last_message_time.
 */
function computeWaitMinutes(convo) {
  const lmt = convo.last_message_time, lmod = convo.last_modified_time;
  const ts = (typeof lmt === 'string' ? lmt : lmt?.iso)
          || (typeof lmod === 'string' ? lmod : lmod?.iso);
  if (!ts) return 0;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  } catch {
    return 0;
  }
}

/**
 * Détecte des mots-clés de frustration dans un texte.
 */
function detectFrustrationKeywords(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  return FRUSTRATION_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Extrait le dernier message CLIENT du context_preview.
 * Format Airtable : "[]CLIENT: ... ||| BOT: ... ||| CLIENT: ..."
 */
function extractLastClientMessage(context) {
  if (!context || typeof context !== 'string') return null;
  const matches = [...context.matchAll(/CLIENT:\s*([^|]+?)(?=\s*\|\|\||$)/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][1].trim();
  return last.length > 200 ? last.slice(0, 200) + '…' : last;
}

/**
 * Index O(1) : PSID → array de signaux.
 */
function indexByPsid(signals) {
  const map = new Map();
  for (const s of signals) {
    if (!s || !s.psid) continue;
    if (!map.has(s.psid)) map.set(s.psid, []);
    map.get(s.psid).push(s);
  }
  return map;
}

/**
 * Index O(1) : PSID → convo (Lot 5.1).
 */
function indexConvosByPsid(convos) {
  const map = new Map();
  for (const c of convos) {
    if (!c || !c.psid) continue;
    map.set(c.psid, c);
  }
  return map;
}

/**
 * Construit l'objet Action conforme au shape Lot 2.
 */
function makeAction(convo, { actionType, reason, phone, waitMinutes, signal }) {
  let priority = basePriority(actionType);
  priority = applyTimeEscalation(priority, waitMinutes, actionType);
  priority = applySignalGraviteEscalation(priority, signal);
  
  const value = estimateRiskValue(convo);
  
  // Nom client : customer_name → fb_first + fb_last → "Client #xxxx"
  const clientName = convo.customer_name
    || [convo.fb_first_name, convo.fb_last_name].filter(Boolean).join(' ')
    || `Client #${String(convo.psid).slice(-4)}`;
  
  const businessSuiteUrl = `https://business.facebook.com/latest/inbox/${FB_PAGE_ID}/messages/?recipient=${convo.psid}`;
  
  const lastMessage = extractLastClientMessage(convo.context_preview);
  
  return {
    id: convo.id,
    psid: convo.psid,
    clientName,
    phone: phone || null,
    value,
    priority,
    actionType,
    reason,
    lastMessage,
    lastMessageAt: convo.last_message_time || null,
    waitMinutes,
    businessSuiteUrl,
    status: convo.traite_status || STATUSES.OPEN
  };
}

// ─────────────────────────────────────────────
// Lot 5.1 — Détection ad-template Facebook
// ─────────────────────────────────────────────

/**
 * Détermine si une action est du bruit (ad-template Facebook sans engagement).
 *
 * 9 GARDE-FOUS ABSOLUS — jamais exclure si :
 *   - téléphone détecté
 *   - cart_value > 0
 *   - draft_order_id
 *   - checkout_sent_at
 *   - checkout_completed_at
 *   - confirmed_product_name
 *   - confirmed_payment_method
 *   - confirmed_budget
 *   - invoice_url
 *
 * EXCLURE seulement si :
 *   - aucun garde-fou
 *   - ET (nb_messages_client < 3 OU nb_substantial_messages < 2)
 */
function isAdTemplateNoise(action, convo) {
  if (!convo) return false; // sécurité : garde si pas trouvé
  
  // ─── 9 garde-fous business ───
  if (action.phone) return false;
  if (convo.cart_value && convo.cart_value > 0) return false;
  if (convo.draft_order_id) return false;
  if (convo.checkout_sent_at?.iso) return false;
  if (convo.checkout_completed_at?.iso) return false;
  if (convo.confirmed_product_name) return false;
  if (convo.confirmed_payment_method) return false;
  if (convo.confirmed_budget) return false;
  if (convo.invoice_url) return false;
  
  // ─── Filtre engagement faible ───
  const nbClient = convo.nb_messages_client || 0;
  if (nbClient < 3) return true;
  
  const nbSubstantial = convo.nb_substantial_messages || 0;
  if (nbSubstantial < 2) return true;
  
  return false;
}
