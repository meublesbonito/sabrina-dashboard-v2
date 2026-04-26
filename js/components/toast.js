// ─────────────────────────────────────────────
// TOAST — Discrete notifications, auto-dismiss 3s
// ─────────────────────────────────────────────

let toastContainer = null;

function ensureContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('role', 'status');
  toastContainer.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, { type = 'info', duration = 3000 } = {}) {
  const container = ensureContainer();
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast--${type}`;
  
  const iconChar = {
    success: '✓',
    error: '⚠',
    info: 'ℹ'
  }[type] || 'ℹ';
  
  const iconEl = document.createElement('span');
  iconEl.className = 'toast-icon';
  iconEl.textContent = iconChar;
  
  const msgEl = document.createElement('span');
  msgEl.className = 'toast-message';
  msgEl.textContent = message;
  
  toastEl.appendChild(iconEl);
  toastEl.appendChild(msgEl);
  
  container.appendChild(toastEl);
  
  requestAnimationFrame(() => toastEl.classList.add('toast--visible'));
  
  setTimeout(() => {
    toastEl.classList.remove('toast--visible');
    setTimeout(() => toastEl.remove(), 200);
  }, duration);
}

export const toast = {
  success: (msg, opts) => showToast(msg, { ...opts, type: 'success' }),
  error:   (msg, opts) => showToast(msg, { ...opts, type: 'error' }),
  info:    (msg, opts) => showToast(msg, { ...opts, type: 'info' })
};
