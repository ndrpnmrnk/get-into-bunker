/** Wraps startMic so repeated clicks share one start (no second stream). */
export function createMicToggle(start) {
  let pending = null;
  return () => (pending ??= start());
}
