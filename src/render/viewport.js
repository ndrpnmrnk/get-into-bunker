/** Canvas size that is never zero (minimised window, hidden frame); DPR capped at 2. */
export function viewportSize(width, height, dpr) {
  return { width: Math.max(1, width || 0), height: Math.max(1, height || 0), dpr: Math.min(2, Math.max(1, dpr || 1)) };
}
