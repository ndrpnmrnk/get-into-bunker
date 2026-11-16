import { describe, expect, it } from 'vitest';
import { mouthOpenFromLevel } from '../src/voice/mouth.js';
import { startMic } from '../src/voice/mic.js';

const DT = 1 / 60;
function run(rms, seconds, open = 0) {
  for (let t = 0; t < seconds - 1e-9; t += DT) open = mouthOpenFromLevel(rms, open, DT);
  return open;
}

describe('mouth from voice level', () => {
  it('stays closed on silence and background noise', () => {
    expect(run(0.01, 2)).toBe(0);
  });
  it('opens quickly on loud speech', () => {
    expect(run(0.2, 0.1)).toBeGreaterThan(0.8);
  });
  it('closes after speech stops', () => {
    expect(run(0, 0.3, run(0.2, 0.5))).toBeLessThan(0.05);
  });
  it('always stays within 0..1', () => {
    for (const rms of [-1, 0, 0.05, 0.5, 10]) {
      const v = run(rms, 0.5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('microphone', () => {
  it('returns null instead of throwing when there is no microphone', async () => {
    expect(await startMic()).toBeNull();
  });
});
