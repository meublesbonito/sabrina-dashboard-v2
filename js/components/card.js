// ─────────────────────────────────────────────
// CARD — Generic white card component
// ─────────────────────────────────────────────

export function renderCard({ variant = 'default', title, body, footer } = {}) {
  const card = document.createElement('div');
  card.className = `card card--${variant}`;
  
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = title;
    card.appendChild(titleEl);
  }
  
  if (body) {
    const bodyEl = document.createElement('div');
    bodyEl.className = 'card-body';
    if (typeof body === 'string') {
      bodyEl.textContent = body;
    } else {
      bodyEl.appendChild(body);
    }
    card.appendChild(bodyEl);
  }
  
  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'card-footer';
    footerEl.textContent = footer;
    card.appendChild(footerEl);
  }
  
  return card;
}
