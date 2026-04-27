// ─────────────────────────────────────────────
// DRAWER — Slide-in side panel (singleton)
// Pure UI primitive: open/close + ESC + overlay click + focus trap
// ZERO business logic — caller provides {title, body, footer}
// ─────────────────────────────────────────────

let drawerEl = null;
let titleEl = null;
let bodyEl = null;
let footerEl = null;
let overlayEl = null;
let lastFocusedBeforeOpen = null;

function ensureMounted() {
  if (drawerEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'drawer-overlay';
  overlayEl.hidden = true;
  overlayEl.addEventListener('click', () => closeDrawer());

  drawerEl = document.createElement('aside');
  drawerEl.className = 'drawer';
  drawerEl.setAttribute('role', 'dialog');
  drawerEl.setAttribute('aria-modal', 'true');
  drawerEl.setAttribute('aria-labelledby', 'drawer-title');
  drawerEl.hidden = true;

  // Header
  const header = document.createElement('div');
  header.className = 'drawer-header';

  titleEl = document.createElement('div');
  titleEl.className = 'drawer-title';
  titleEl.id = 'drawer-title';
  titleEl.textContent = '';
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'drawer-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => closeDrawer());
  header.appendChild(closeBtn);

  drawerEl.appendChild(header);

  // Body (scrollable)
  bodyEl = document.createElement('div');
  bodyEl.className = 'drawer-body';
  drawerEl.appendChild(bodyEl);

  // Footer
  footerEl = document.createElement('div');
  footerEl.className = 'drawer-footer';
  footerEl.hidden = true;
  drawerEl.appendChild(footerEl);

  document.body.appendChild(overlayEl);
  document.body.appendChild(drawerEl);

  // Global ESC handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDrawerOpen()) {
      e.preventDefault();
      closeDrawer();
    }
  });
}

/**
 * Open drawer with content.
 * @param {Object} opts
 * @param {string} opts.title - drawer header text
 * @param {Node|string} [opts.body] - DOM node or string for body
 * @param {Node|null} [opts.footer] - optional DOM node for footer
 */
export function openDrawer({ title = '', body = null, footer = null } = {}) {
  ensureMounted();

  if (!isDrawerOpen()) {
    lastFocusedBeforeOpen = document.activeElement;
  }

  titleEl.textContent = title || '';

  bodyEl.replaceChildren();
  if (body instanceof Node) {
    bodyEl.appendChild(body);
  } else if (typeof body === 'string') {
    bodyEl.textContent = body;
  }

  footerEl.replaceChildren();
  if (footer instanceof Node) {
    footerEl.appendChild(footer);
    footerEl.hidden = false;
  } else {
    footerEl.hidden = true;
  }

  overlayEl.hidden = false;
  drawerEl.hidden = false;
  // Force a synchronous reflow so the browser commits the initial style
  // (translateX(100%)) before we toggle the .drawer--open class. This makes
  // the slide-in transition fire reliably regardless of rAF throttling
  // (e.g. background tabs, low-power devices), which was the cause of the
  // "Today drawer never appears" symptom: the drawer was created in the DOM
  // but the open class was never applied so it stayed off-screen at
  // translateX(100%).
  void drawerEl.offsetWidth;
  overlayEl.classList.add('drawer-overlay--open');
  drawerEl.classList.add('drawer--open');

  document.body.classList.add('drawer-body-locked');

  // Focus close button as a sane default
  setTimeout(() => {
    const closeBtn = drawerEl.querySelector('.drawer-close');
    if (closeBtn) closeBtn.focus();
  }, 50);
}

/**
 * Replace drawer body without closing/reopening (e.g. loader → loaded content).
 */
export function setDrawerBody(body) {
  if (!drawerEl) return;
  bodyEl.replaceChildren();
  if (body instanceof Node) bodyEl.appendChild(body);
  else if (typeof body === 'string') bodyEl.textContent = body;
}

/**
 * Replace drawer footer.
 */
export function setDrawerFooter(footer) {
  if (!drawerEl) return;
  footerEl.replaceChildren();
  if (footer instanceof Node) {
    footerEl.appendChild(footer);
    footerEl.hidden = false;
  } else {
    footerEl.hidden = true;
  }
}

export function closeDrawer() {
  if (!drawerEl || drawerEl.hidden) return;
  drawerEl.classList.remove('drawer--open');
  overlayEl.classList.remove('drawer-overlay--open');
  document.body.classList.remove('drawer-body-locked');

  // Wait for CSS transition before hiding (matches drawer.css timing)
  setTimeout(() => {
    drawerEl.hidden = true;
    overlayEl.hidden = true;
    bodyEl.replaceChildren();
    footerEl.replaceChildren();
    footerEl.hidden = true;
  }, 220);

  // Restore focus
  if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === 'function') {
    try { lastFocusedBeforeOpen.focus(); } catch {}
  }
  lastFocusedBeforeOpen = null;
}

export function isDrawerOpen() {
  return !!(drawerEl && !drawerEl.hidden);
}
