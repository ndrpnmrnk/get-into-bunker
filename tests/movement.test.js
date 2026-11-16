import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { stepMovement, newPlayerState, WALK_SPEED, CROUCH_SPEED } from '../src/player/movement.js';
import { eyeHeightFor } from '../src/character/body.js';
import rig from '../art/build/rig.json';

const DT = 1 / 60;
const flat = { groundHeightAt: (x) => (x > 10 ? null : 0), blocked: () => false };
const none = { forward: false, back: false, left: false, right: false, jump: false, crouch: false, dYaw: 0, dPitch: 0 };

function run(state, input, seconds, world = flat) {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    state = stepMovement(state, input, DT, world);
    input = { ...input, jump: false, dYaw: 0, dPitch: 0 };
  }
  return state;
}
// yaw = -90° makes "forward" point along +x
const facingX = () => ({ ...newPlayerState(new THREE.Vector3(0, 0, 0)), yaw: -Math.PI / 2 });

describe('walking', () => {
  it('walks 3.5 m in one second', () => {
    expect(run(facingX(), { ...none, forward: true }, 1).pos.x).toBeCloseTo(WALK_SPEED, 1);
  });
  it('is slower when crouching', () => {
    expect(run(facingX(), { ...none, forward: true, crouch: true }, 1).pos.x).toBeCloseTo(CROUCH_SPEED, 1);
  });
});

describe('jumping', () => {
  it('rises and lands again', () => {
    const up = run(facingX(), { ...none, jump: true }, 0.28);
    expect(up.pos.y).toBeGreaterThan(0.6);
    expect(run(up, none, 0.42).grounded).toBe(true);
  });
  it('never sinks below the ground', () => {
    let s = run(facingX(), { ...none, jump: true }, 0.05);
    for (let i = 0; i < 120; i++) {
      s = stepMovement(s, none, DT, flat);
      expect(s.pos.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('blocking', () => {
  it('stops at a cliff edge', () => {
    const s = { ...facingX(), pos: new THREE.Vector3(9.9, 0, 0) };
    expect(run(s, { ...none, forward: true }, 1).pos.x).toBeLessThanOrEqual(10);
  });
  it('does not walk into blockers (campfire)', () => {
    const world = { ...flat, blocked: () => true };
    const s = run(facingX(), { ...none, forward: true }, 1, world);
    expect(s.pos.x).toBe(0);
    expect(s.pos.z).toBe(0);
  });
});

describe('looking', () => {
  it('clamps the pitch to ±85°', () => {
    const s = run(facingX(), { ...none, dPitch: -10 }, DT);
    expect(s.pitch).toBeCloseTo(-85 * Math.PI / 180, 5);
  });
  it('puts the camera of a tall player higher', () => {
    expect(eyeHeightFor(rig.eyeHeightCm, { height: 195 })).toBeGreaterThan(eyeHeightFor(rig.eyeHeightCm, { height: 160 }));
  });
});
