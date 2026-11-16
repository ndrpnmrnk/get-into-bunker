import { palette } from '../style/palette.js';

/** CSS variables for the page, from the palette. */
export function themeVars() {
  return { '--ui-bg': palette.uiBg, '--ui-ink': palette.uiInk, '--ui-accent': palette.uiAccent, '--sky': palette.sky };
}

export function applyTheme(root = document.documentElement) {
  for (const [k, v] of Object.entries(themeVars())) root.style.setProperty(k, v);
}
