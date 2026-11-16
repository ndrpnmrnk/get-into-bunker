export const NOISE_FLOOR = 0.02; // RMS below this is room noise, not speech
const RANGE = 0.15;              // RMS above the floor that opens the mouth fully
const TAU_OPEN = 0.03;           // ~60 ms to open
const TAU_CLOSE = 0.06;          // ~120 ms to close

/** Smoothed mouth opening (0..1) from the current microphone RMS level. */
export function mouthOpenFromLevel(rms, prevOpen, dt) {
  const target = rms <= NOISE_FLOOR ? 0 : Math.min(1, (rms - NOISE_FLOOR) / RANGE);
  const tau = target > prevOpen ? TAU_OPEN : TAU_CLOSE;
  const next = prevOpen + (target - prevOpen) * (1 - Math.exp(-dt / tau));
  return Math.min(1, Math.max(0, next < 1e-3 && target === 0 ? 0 : next));
}
