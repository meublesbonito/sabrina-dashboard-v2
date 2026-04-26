// ─────────────────────────────────────────────
// ERROR BANNER — Bannière erreur par section
// ─────────────────────────────────────────────

export function renderErrorBanner({ message, detail, onRetry } = {}) {
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  
  const icon = document.createElement('span');
  icon.className = 'error-icon';
  icon.textContent = '⚠';
  banner.appendChild(icon);
  
  const content = document.createElement('div');
  content.className = 'error-content';
  
  const messageEl = document.createElement('div');
  messageEl.className = 'error-message';
  messageEl.textContent = message || 'Erreur inconnue';
  content.appendChild(messageEl);
  
  if (detail) {
    const detailEl = document.createElement('div');
    detailEl.className = 'error-detail';
    detailEl.textContent = detail;
    content.appendChild(detailEl);
  }
  
  banner.appendChild(content);
  
  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'error-retry';
    btn.type = 'button';
    btn.textContent = 'Réessayer';
    btn.addEventListener('click', onRetry);
    banner.appendChild(btn);
  }
  
  return banner;
}
