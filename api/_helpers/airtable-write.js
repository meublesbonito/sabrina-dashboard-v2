// ─────────────────────────────────────────────
// AIRTABLE WRITE — Premier helper d'écriture
// PATCH (update partiel) seulement, jamais DELETE
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
 * Update partiel d'un record (PATCH).
 * Ne touche que les champs fournis. Les autres restent intacts.
 *
 * @param {string} tableName
 * @param {string} recordId - rec...
 * @param {Object} fields - { fieldName: value, ... }
 * @returns {Promise<Object>} - record mis à jour
 */
export async function updateRecord(tableName, recordId, fields) {
  if (!recordId || !recordId.startsWith('rec')) {
    throw new Error('Invalid record id');
  }
  if (!fields || typeof fields !== 'object' || !Object.keys(fields).length) {
    throw new Error('No fields to update');
  }
  
  const baseId = getBaseId();
  const url = `${AIRTABLE_BASE}/${baseId}/${encodeURIComponent(tableName)}/${recordId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields,
      typecast: true
    })
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[Airtable WRITE] ${response.status} ${tableName}/${recordId}: ${text}`);
    throw new Error(`Airtable write ${response.status}`);
  }
  
  return await response.json();
}
