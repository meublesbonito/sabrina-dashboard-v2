// ─────────────────────────────────────────────
// SLA BADGE — Visual urgency indicator
// ─────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: { dot: '🔴', label: 'URGENT', cls: 'sla--critical' },
  high:     { dot: '🟠', label: 'HAUTE',  cls: 'sla--high' },
  medium:   { dot: '🟡', label: 'MOYEN',  cls: 'sla--medium' },
  low:      { dot: '🟢', label: 'OK',     cls: 'sla--low' }
};

/**
 * Render un badge SLA visuel
 */
export function renderSlaBadge(priority, options = {}) {
  const { showLabel = false, size = 'md' } = options;
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  
  const badge = document.createElement('span');
  badge.className = `sla-badge ${config.cls} sla--${size}`;
  badge.setAttribute('aria-label', `Priorité ${config.label}`);
  
  const dot = document.createElement('span');
  dot.className = 'sla-dot';
  dot.textContent = config.dot;
  badge.appendChild(dot);
  
  if (showLabel) {
    const label = document.createElement('span');
    label.className = 'sla-label';
    label.textContent = config.label;
    badge.appendChild(label);
  }
  
  return badge;
}
