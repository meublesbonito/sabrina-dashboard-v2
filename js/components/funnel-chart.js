// ─────────────────────────────────────────────
// FUNNEL CHART — Lot 7.2
// Computes a conversion funnel client-side from a convos array (typically
// the last 200 from /api/data/convos). Pure CSS bars, no external lib.
//
// Stages are NOT strictly sequential — a conversation can skip steps. The
// funnel is presented as an indicative snapshot, with caveats shown to the
// user in the Health page.
// ─────────────────────────────────────────────

const STAGES = [
  { key: 'total',             label: 'Total convos',           test: () => true },
  { key: 'active',            label: 'Conversations actives',  test: c => c?.status === 'active' },
  { key: 'category',          label: 'Catégorie produit',      test: c => !!c?.confirmed_category },
  { key: 'phone',             label: 'Téléphone fourni',       test: c => !!c?.customer_phone },
  { key: 'budget',            label: 'Budget confirmé',        test: c => c?.confirmed_budget !== '' && c?.confirmed_budget != null },
  { key: 'product',           label: 'Produit confirmé',       test: c => !!c?.confirmed_product_name },
  { key: 'cart',              label: 'Panier créé',            test: c => (c?.cart_value || 0) > 0 },
  { key: 'checkout_sent',     label: 'Checkout envoyé',        test: c => !!pickIso(c?.checkout_sent_at) },
  { key: 'checkout_complete', label: 'Checkout complété',      test: c => !!pickIso(c?.checkout_completed_at) },
  { key: 'converted',         label: 'Converti',               test: c => c?.traite_status === 'converted' }
];

function pickIso(d) {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.iso || null;
}

/**
 * Compute funnel counts from a convos array.
 * @param {Array<Object>} convos
 * @returns {Array<{key,label,count,pctOfTotal,pctOfPrevious}>}
 */
export function computeFunnel(convos = []) {
  const safeConvos = Array.isArray(convos) ? convos : [];
  const counts = STAGES.map(s => ({
    key: s.key,
    label: s.label,
    count: safeConvos.filter(s.test).length
  }));

  const total = counts[0].count;

  return counts.map((s, i) => {
    const pctOfTotal = total > 0 ? Math.round(100 * s.count / total) : 0;
    let pctOfPrevious = 100;
    if (i > 0) {
      const prev = counts[i - 1].count;
      pctOfPrevious = prev > 0 ? Math.round(100 * s.count / prev) : 0;
    }
    return { ...s, pctOfTotal, pctOfPrevious };
  });
}

/**
 * Render the funnel chart as a DOM node.
 * @param {Array<Object>} convos
 * @returns {HTMLElement}
 */
export function renderFunnelChart(convos) {
  const wrap = document.createElement('div');
  wrap.className = 'funnel-chart';

  const stages = computeFunnel(convos);
  const total = stages[0].count;

  if (total === 0) {
    const empty = document.createElement('div');
    empty.className = 'funnel-empty';
    empty.textContent = 'Aucune conversation à analyser.';
    wrap.appendChild(empty);
    return wrap;
  }

  const list = document.createElement('div');
  list.className = 'funnel-bars';

  stages.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = `funnel-row funnel-row--${s.key}`;
    row.dataset.stage = s.key;

    const label = document.createElement('div');
    label.className = 'funnel-label';
    label.textContent = s.label;
    row.appendChild(label);

    const barWrap = document.createElement('div');
    barWrap.className = 'funnel-bar-wrap';

    const bar = document.createElement('div');
    bar.className = 'funnel-bar';
    bar.style.width = `${s.pctOfTotal}%`;
    bar.setAttribute('aria-label', `${s.count} sur ${total}`);
    barWrap.appendChild(bar);

    row.appendChild(barWrap);

    const numbers = document.createElement('div');
    numbers.className = 'funnel-numbers';

    const count = document.createElement('span');
    count.className = 'funnel-count';
    count.textContent = String(s.count);
    numbers.appendChild(count);

    const pct = document.createElement('span');
    pct.className = 'funnel-pct';
    if (i === 0) {
      pct.textContent = `${s.pctOfTotal}%`;
    } else {
      pct.textContent = `${s.pctOfTotal}% · ${s.pctOfPrevious}% de ↑`;
    }
    numbers.appendChild(pct);

    row.appendChild(numbers);
    list.appendChild(row);
  });

  wrap.appendChild(list);

  const footnote = document.createElement('div');
  footnote.className = 'funnel-footnote';
  footnote.textContent = `Sur les ${total} dernières conversations (échantillon). Les étapes ne sont pas strictement séquentielles — un client peut sauter une étape.`;
  wrap.appendChild(footnote);

  return wrap;
}
