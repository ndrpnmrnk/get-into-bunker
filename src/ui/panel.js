import { t } from '../i18n/index.js';

/** Test-bench panel for the style probe (not game UI). */
export function createPanel() {
  const el = document.createElement('div');
  el.className = 'panel';
  document.body.appendChild(el);
  const status = document.createElement('div');
  status.className = 'status';
  document.body.appendChild(status);
  return {
    button(textKey, onClick) {
      const b = document.createElement('button');
      b.textContent = t(textKey);
      b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
      el.appendChild(b);
      return b;
    },
    status(text) { status.textContent = text; status.hidden = !text; },
  };
}
