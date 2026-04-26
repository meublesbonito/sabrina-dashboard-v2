// ─────────────────────────────────────────────
// PHONE FILTER — Détection téléphone client
// Exclut le numéro du magasin Bonito (4383373296)
// ─────────────────────────────────────────────

const STORE_PHONE_DIGITS = '4383373296';

/**
 * Extrait un numéro de téléphone (10 chiffres) d'un texte.
 * Exclut le numéro du magasin Bonito.
 *
 * Patterns reconnus :
 *   438-555-1234
 *   438.555.1234
 *   438 555 1234
 *   4385551234
 *   (438) 555-1234
 *   +1 438-555-1234
 *
 * @param {string} text - texte à scanner (peut être null/undefined)
 * @returns {string|null} - "4385551234" (10 digits) ou null
 */
export function extractClientPhone(text) {
  if (!text) return null;
  const str = String(text);
  
  // Capture tous les patterns de 10 chiffres avec séparateurs optionnels
  const regex = /(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g;
  
  let match;
  while ((match = regex.exec(str)) !== null) {
    const digits = `${match[1]}${match[2]}${match[3]}`;
    if (digits.length === 10 && digits !== STORE_PHONE_DIGITS) {
      return digits;
    }
  }
  
  return null;
}

/**
 * Vérifie si un numéro est celui du magasin.
 * @param {string|null} phone
 * @returns {boolean}
 */
export function isStorePhone(phone) {
  if (!phone) return false;
  return String(phone).replace(/\D/g, '') === STORE_PHONE_DIGITS;
}
