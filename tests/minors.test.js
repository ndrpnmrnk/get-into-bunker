import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createMicToggle } from '../src/voice/micToggle.js';
import { OutlineRenderer } from '../src/render/outline.js';
import { viewportSize } from '../src/render/viewport.js';
import { createWalkWorld } from '../src/player/world.js';
import { themeVars } from '../src/ui/theme.js';
import { palette } from '../src/style/palette.js';

describe('mic toggle', () => {
  it('starts the microphone only once on a double click', async () => {
    const start = vi.fn(() => new Promise((r) => setTimeout(() => r({ level: () => 0 }), 10)));
    const toggle = createMicToggle(start);
    const [a, b] = await Promise.all([toggle(), toggle()]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });
});

describe('outline clear colour', () => {
  it('clears normals with a true flat normal and restores the previous clear colour', () => {
    const calls = [];
    const fake = {
      shadowMap: {}, setRenderTarget() {}, clear() {}, render() {},
      getClearColor(c) { return c.set(0x123456); }, getClearAlpha() { return 0.5; },
      setClearColor(c, a) { calls.push([new THREE.Color(c), a]); },
    };
    const o = new OutlineRenderer(fake, { color: '#000000' });
    o.render(new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(calls[0][0].r).toBeCloseTo(0.5, 5);
    expect(calls[0][0].b).toBeCloseTo(1, 5);
    expect(calls.at(-1)[0].getHex()).toBe(0x123456);
    expect(calls.at(-1)[1]).toBe(0.5);
  });
});

describe('viewport', () => {
  it('never returns a zero size (minimised window)', () => {
    expect(viewportSize(0, 0, 0)).toEqual({ width: 1, height: 1, dpr: 1 });
    expect(viewportSize(800, 600, 3)).toEqual({ width: 800, height: 600, dpr: 2 });
  });
});

function worldWithBox(size, center) {
  const island = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  ground.name = 'Ground';
  const box = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  box.position.set(...center);
  const blockers = new THREE.Group(); blockers.name = 'WalkBlockers'; blockers.add(box);
  island.add(ground, blockers);
  return createWalkWorld(island);
}

describe('blockers', () => {
  it('block a mid-jump player even when the obstacle is just below the old ray height', () => {
    const w = worldWithBox([0.4, 1.15, 2], [1.1, 0.575, 0]); // top at 1.15 m
    expect(w.blocked(new THREE.Vector3(0.5, 0.69, 0), new THREE.Vector3(0.6, 0.69, 0))).toBe(true);
  });
  it('block a player brushing past an obstacle with their shoulder', () => {
    const w = worldWithBox([0.2, 2, 0.2], [0.8, 1, 0.3]);
    expect(w.blocked(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 0, 0))).toBe(true);
  });
  it('let a player walk freely in open space', () => {
    const w = worldWithBox([0.2, 2, 0.2], [5, 1, 5]);
    expect(w.blocked(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.6, 0, 0))).toBe(false);
  });
});

describe('ui theme', () => {
  it('takes interface colours from the palette', () => {
    const v = themeVars();
    expect(v['--ui-bg']).toBe(palette.uiBg);
    expect(v['--ui-ink']).toBe(palette.uiInk);
    expect(v['--ui-accent']).toBe(palette.uiAccent);
    expect(v['--sky']).toBe(palette.sky);
  });
});
