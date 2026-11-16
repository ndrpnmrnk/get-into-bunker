import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { mouthOpenFromLevel } from '../src/voice/mouth.js';
import { OutlineRenderer } from '../src/render/outline.js';
import { createInput } from '../src/player/input.js';
import { createWalkWorld } from '../src/player/world.js';
import { enableFirstPerson } from '../src/player/firstPerson.js';
import { seatedRootY } from '../src/character/seat.js';
import rig from '../art/build/rig.json';

const DT = 1 / 60;

describe('review: mouth ignores steady room noise', () => {
  it('stays closed at a fan/music level of RMS 0.03', () => {
    let open = 0;
    for (let i = 0; i < 120; i++) open = mouthOpenFromLevel(0.03, open, DT);
    expect(open).toBe(0);
  });
  it('still opens for speech and stays open through quieter syllables', () => {
    let open = 0;
    for (let i = 0; i < 6; i++) open = mouthOpenFromLevel(0.2, open, DT);
    for (let i = 0; i < 3; i++) open = mouthOpenFromLevel(0.03, open, DT);
    expect(open).toBeGreaterThan(0.05);
  });
});

describe('review: shadow map renders once per frame', () => {
  it('only the colour pass updates shadows', () => {
    const shadowMap = { autoUpdate: true, needsUpdate: false };
    const updates = [];
    const fake = {
      shadowMap, setRenderTarget() {}, setClearColor() {}, clear() {},
      render(scene) { if (scene.isScene && (shadowMap.autoUpdate || shadowMap.needsUpdate)) updates.push(1); shadowMap.needsUpdate = false; },
    };
    const o = new OutlineRenderer(fake, { color: '#000000' });
    const scene = new THREE.Scene();
    o.render(scene, new THREE.PerspectiveCamera());
    o.render(scene, new THREE.PerspectiveCamera());
    expect(updates.length).toBe(2); // one shadow update per frame, in the colour pass
  });
});

function fakeDom() {
  const target = new EventTarget();
  const canvas = new EventTarget();
  canvas.requestPointerLock = vi.fn();
  const key = (type, code) => target.dispatchEvent(Object.assign(new Event(type), { code, preventDefault() {} }));
  return { target, canvas, key, doc: { pointerLockElement: null } };
}

describe('review: input', () => {
  it('does not grab the pointer outside first person', () => {
    const d = fakeDom();
    let active = false;
    createInput(d.canvas, { target: d.target, doc: d.doc, isActive: () => active });
    d.canvas.dispatchEvent(new Event('click'));
    expect(d.canvas.requestPointerLock).not.toHaveBeenCalled();
    active = true;
    d.canvas.dispatchEvent(new Event('click'));
    expect(d.canvas.requestPointerLock).toHaveBeenCalledTimes(1);
  });
  it('reset() drops a jump pressed before entering first person', () => {
    const d = fakeDom();
    const input = createInput(d.canvas, { target: d.target, doc: d.doc, isActive: () => true });
    d.key('keydown', 'Space');
    input.reset();
    expect(input.read().jump).toBe(false);
  });
  it('crouches on C, not on Ctrl (Ctrl+W would close the tab)', () => {
    const d = fakeDom();
    const input = createInput(d.canvas, { target: d.target, doc: d.doc, isActive: () => true });
    d.key('keydown', 'ControlLeft');
    expect(input.read().crouch).toBe(false);
    d.key('keydown', 'KeyC');
    expect(input.read().crouch).toBe(true);
  });
});

describe('review: walk world builds fast', () => {
  it('samples a ~29k-triangle ground in well under a second', () => {
    const island = new THREE.Group();
    const geo = new THREE.CircleGeometry(9, 160, 0, Math.PI * 2);
    const pos = geo.attributes.position;
    // densify like the real ground (concentric rings)
    const g = new THREE.RingGeometry(0.1, 9, 160, 90).rotateX(-Math.PI / 2).translate(0, 4, 0);
    const ground = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); ground.name = 'Ground';
    const blockers = new THREE.Group(); blockers.name = 'WalkBlockers';
    island.add(ground, blockers);
    const t0 = performance.now();
    const world = createWalkWorld(island);
    expect(performance.now() - t0).toBeLessThan(600);
    expect(world.groundHeightAt(1, 1)).toBeCloseTo(4, 3);
    expect(world.groundHeightAt(20, 0)).toBeNull();
    void pos;
  });
});

describe('review: first-person camera follows a body change', () => {
  it('keeps the camera at the eye height after setBody', () => {
    const root = new THREE.Group();
    const neck = new THREE.Object3D(); neck.name = rig.neck; neck.position.y = 1.5; root.add(neck);
    const ch = { root, meshes: [], update() {}, body: { height: 175 },
      eyeHeight() { return (rig.eyeHeightCm / 100) * root.scale.y; } };
    const cam = new THREE.PerspectiveCamera();
    const fp = enableFirstPerson(ch, cam);
    root.scale.y = 195 / 175;
    fp.update({ yaw: 0, pitch: 0 });
    expect(cam.position.y).toBeCloseTo(ch.eyeHeight(), 2);
  });
});

describe('review: seated characters sit on the log', () => {
  it('puts the pelvis just above the log top whatever the body height', () => {
    expect(seatedRootY(4.75, 0.54)).toBeCloseTo(4.75 + 0.12 - 0.54, 5);
    expect(seatedRootY(4.75, 0.6)).toBeLessThan(seatedRootY(4.75, 0.5));
  });
});
