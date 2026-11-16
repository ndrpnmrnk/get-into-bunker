import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from '../src/character/character.js';
import { VARIANTS } from '../src/character/variants.js';
import { seatCharacter } from '../src/character/seat.js';
import { createWalkWorld } from '../src/player/world.js';

const parse = (file) => new Promise((ok, bad) => {
  const buf = readFileSync(file);
  new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', ok, bad);
});

let island, world, seated;
const down = new THREE.Vector3(0, -1, 0);
const ray = new THREE.Raycaster();

/** y values where a vertical line at (x, z) crosses the benches, top first */
function benchHits(x, z) {
  ray.set(new THREE.Vector3(x, 50, z), down);
  return ray.intersectObject(island.getObjectByName('Benches'), true).map((h) => h.point.y);
}
function worldVerts(c, names) {
  const out = [];
  const v = new THREE.Vector3();
  for (const m of c.meshes) {
    if (names && !names.includes(m.name)) continue;
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      m.getVertexPosition(i, v);
      out.push(v.clone().applyMatrix4(m.matrixWorld));
    }
  }
  return out;
}

beforeAll(async () => {
  island = (await parse('public/models/island.glb')).scene;
  island.updateMatrixWorld(true);
  world = createWalkWorld(island);
  const gltf = await parse('public/models/character.glb');
  seated = VARIANTS.map((v, i) => {
    const c = new Character(gltf);
    c.setBody(v.body);
    seatCharacter(c, island.getObjectByName(['Seat_0', 'Seat_1', 'Seat_3'][i]), world);
    return c;
  });
}, 60000);

describe('seated characters', () => {
  it('rest on the log: no gap and no sinking under the seat', () => {
    for (const c of seated) {
      const pelvis = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
      const seat = worldVerts(c, ['Pants']).filter((p) => Math.hypot(p.x - pelvis.x, p.z - pelvis.z) < 0.15);
      const low = seat.reduce((a, b) => (b.y < a.y ? b : a));
      const top = benchHits(low.x, low.z)[0];
      expect(top).toBeDefined();
      expect(Math.abs(low.y - top)).toBeLessThan(0.02);
    }
  });

  it('never put a vertex inside the log', () => {
    for (const c of seated) {
      let inside = 0;
      for (const p of worldVerts(c)) {
        const hits = benchHits(p.x, p.z);
        if (hits.length >= 2 && p.y < hits[0] - 0.015 && p.y > hits.at(-1) + 0.015) inside++;
      }
      expect(inside).toBe(0);
    }
  });

  it('keep shoes above the ground', () => {
    for (const c of seated) {
      for (const p of worldVerts(c, ['Shoes'])) {
        const g = world.groundHeightAt(p.x, p.z);
        if (g !== null) expect(p.y).toBeGreaterThan(g - 0.02);
      }
    }
  });
});

describe('walking past seated characters', () => {
  it('blocks the player from walking through someone sitting', () => {
    const c = seated[0];
    const p = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
    // approach from the fire side, stopping short of the log: only the person's legs are in the way
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(c.root.quaternion).setY(0).normalize();
    const at = (d) => { const q = p.clone().addScaledVector(f, d); q.y = world.groundHeightAt(q.x, q.z); return q; };
    const from = at(1.4), to = at(0.85);
    expect(world.blocked(from, to)).toBe(true);
  });
});
