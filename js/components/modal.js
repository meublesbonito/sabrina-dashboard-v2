// ─────────────────────────────────────────────
// MODAL — Generic modal dialog
// ─────────────────────────────────────────────

let activeModal = null;

export function showModal({ title = '', body = '', buttons = [] } = {}) {
  closeActiveModal();
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  
  const header = document.createElement('div');
  header.className = 'modal-header';
  
  const titleEl = document.createElement('div');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '✕';
  
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  
  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal-body';
  if (typeof body === 'string') {
    bodyEl.textContent = body;
  } else if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  }
  
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  
  buttons.forEach(({ label, variant = 'secondary', onClick }) => {
    const btn = document.createElement('button');
    btn.className = `btn-modal btn-modal--${variant}`;
    btn.textContent = label;
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      const result = onClick ? await onClick() : null;
      // Si onClick retourne false, on garde le modal ouvert
      if (result !== false) close();
    });
    footer.appendChild(btn);
  });
  
  modal.appendChild(header);
  modal.appendChild(bodyEl);
  if (buttons.length) modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  function close() {
    if (overlay.parentNode) {
      overlay.classList.add('modal-overlay--closing');
      setTimeout(() => overlay.remove(), 150);
    }
    activeModal = null;
    document.removeEventListener('keydown', escHandler);
  }
  
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  
  function escHandler(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', escHandler);
  
  activeModal = { overlay, close };
  
  setTimeout(() => {
    const firstBtn = footer.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }, 50);
  
  return { close };
}

export function closeActiveModal() {
  if (activeModal) activeModal.close();
}
