import { describe, expect, it } from 'vitest';
import { bodyScale, eyeHeightFor } from '../src/character/body.js';
import rig from '../art/build/rig.json';

describe('body scale', () => {
  it('is 1 for the base body', () => {
    expect(bodyScale({ height: 175, width: 1 })).toEqual({ x: 1, y: 1, z: 1 });
  });
  it('scales height and width separately', () => {
    const s = bodyScale({ height: 195, width: 0.9 });
    expect(s.y).toBeCloseTo(195 / 175, 3);
    expect(s.x).toBeCloseTo(0.9, 3);
    expect(s.z).toBeCloseTo(0.9, 3);
  });
  it('clamps values to the allowed ranges', () => {
    expect(bodyScale({ height: 300, width: 1 }).y).toBeCloseTo(200 / 175, 3);
    expect(bodyScale({ height: 175, width: 5 }).x).toBeCloseTo(1.3, 3);
  });
});

describe('eye height', () => {
  it('follows the body height (camera of a tall player is higher)', () => {
    const tall = eyeHeightFor(rig.eyeHeightCm, { height: 195, width: 1 });
    const short = eyeHeightFor(rig.eyeHeightCm, { height: 160, width: 1 });
    expect(tall).toBeCloseTo((rig.eyeHeightCm / 100) * (195 / 175), 2);
    expect(tall).toBeGreaterThan(short);
  });
});
