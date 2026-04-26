// ─────────────────────────────────────────────
// AIRTABLE — Client READ-only
// Lot 3 = lecture pure. Aucune écriture.
// ─────────────────────────────────────────────

const AIRTABLE_BASE = 'https://api.airtable.com/v0';

function getToken() {
  const t = process.env.AIRTABLE_TOKEN;
  if (!t) throw new Error('AIRTABLE_TOKEN missing');
  return t;
}

function getBaseId() {
  const id = process.env.BASE_BOT;
  if (!id) throw new Error('BASE_BOT missing');
  return id;
}

/**
 * Liste les records d'une table
 * @param {string} tableName - nom de la table (ex: "CONVERSATIONS")
 * @param {Object} options - { filterByFormula, sort, maxRecords, fields, view }
 * @returns {Array} - liste des records [{ id, fields, createdTime }]
 */
export async function listRecords(tableName, options = {}) {
  const baseId = getBaseId();
  const params = new URLSearchParams();
  
  if (options.maxRecords) params.append('maxRecords', String(options.maxRecords));
  if (options.filterByFormula) params.append('filterByFormula', options.filterByFormula);
  if (options.view) params.append('view', options.view);
  
  if (Array.isArray(options.sort)) {
    options.sort.forEach((s, i) => {
      params.append(`sort[${i}][field]`, s.field);
      params.append(`sort[${i}][direction]`, s.direction || 'asc');
    });
  }
  
  if (Array.isArray(options.fields)) {
    options.fields.forEach(f => params.append('fields[]', f));
  }
  
  const url = `${AIRTABLE_BASE}/${baseId}/${encodeURIComponent(tableName)}?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[Airtable] ${response.status} ${tableName}: ${text}`);
    throw new Error(`Airtable ${response.status}`);
  }
  
  const json = await response.json();
  return json.records || [];
}

/**
 * Récupère un record par ID
 * @param {string} tableName
 * @param {string} recordId - rec...
 * @returns {Object|null}
 */
export async function getRecord(tableName, recordId) {
  if (!recordId || !recordId.startsWith('rec')) return null;
  
  const baseId = getBaseId();
  const url = `${AIRTABLE_BASE}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`
    }
  });
  
  if (response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[Airtable] ${response.status} ${tableName}/${recordId}: ${text}`);
    throw new Error(`Airtable ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Ping Airtable : vérifie que la connexion + token marchent
 * Retourne true si OK, false si pas accessible.
 */
export async function pingAirtable() {
  try {
    await listRecords('CONVERSATIONS', { maxRecords: 1 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise une date Airtable en ISO 8601
 * Fail-safe : retourne { raw, iso } toujours, jamais d'exception
 * Date invalide → { raw, iso: null } sans crash
 * @param {string|Date|null} value
 * @returns {{ raw: string|null, iso: string|null }}
 */
export function normalizeDate(value) {
  if (!value) return { raw: null, iso: null };
  
  const raw = String(value);
  
  // Format français Airtable : "23/4/2026 11:01am" ou "23/4/2026 6:24pm"
  const frMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)?/i);
  if (frMatch) {
    const [, day, month, year, hour, minute, ampm] = frMatch;
    let h = parseInt(hour, 10);
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h < 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(h).padStart(2,'0')}:${minute}:00`;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return { raw, iso: d.toISOString() };
    }
  }
  
  // Tentative parse direct (ISO ou autre format reconnu)
  try {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return { raw, iso: d.toISOString() };
    }
  } catch {
    // ignore
  }
  
  // Date invalide → fail-safe (pas de crash)
  return { raw, iso: null };
}

/**
 * Normalise un champ "linked record" Airtable.
 * Airtable retourne ['recXXX'] pour les champs liés. On veut une string ou null.
 * @param {Array|string|null|undefined} value
 * @returns {string|null}
 */
export function firstLinkedId(value) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }
  return value || null;
}
