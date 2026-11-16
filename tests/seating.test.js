import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Character } from '../src/character/character.js';
import { VARIANTS } from '../src/character/variants.js';
import { seatCharacter } from '../src/character/seat.js';
import { createWalkWorld } from '../src/player/world.js';
import { MeshBVH } from 'three-mesh-bvh';

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

/** Posed copy of a skinned layer in world space, for inside/outside tests. */
function posedBVH(c, name) {
  const m = c.meshes.find((x) => x.name === name);
  const n = m.geometry.attributes.position.count, pos = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); v.toArray(pos, i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(m.geometry.index);
  return new MeshBVH(g);
}
const up = new THREE.Vector3(0, 1, 0);
function insideCount(points, bvh) {
  let n = 0;
  for (const p of points) {
    const hits = bvh.raycast(new THREE.Ray(p, up), THREE.DoubleSide);
    if (hits.length % 2 === 1) n++;
  }
  return n;
}
let gltfAll;

beforeAll(async () => {
  island = (await parse('public/models/island.glb')).scene;
  island.updateMatrixWorld(true);
  world = createWalkWorld(island);
  const gltf = await parse('public/models/character.glb');
  gltfAll = gltf;
  seated = VARIANTS.map((v, i) => {
    const c = new Character(gltf);
    c.setBody(v.body);
    seatCharacter(c, island.getObjectByName(['Seat_0', 'Seat_1', 'Seat_3'][i]), world);
    return c;
  });
}, 60000);

describe('seated characters', () => {
  it('rest on the log: the trousers touch it (seat or thighs), no gap, no sinking', () => {
    for (const c of seated) {
      const pelvis = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
      let closest = Infinity;
      for (const p of worldVerts(c, ['Pants'])) {
        if (Math.hypot(p.x - pelvis.x, p.z - pelvis.z) > 0.35) continue;
        const top = benchHits(p.x, p.z)[0];
        if (top !== undefined) closest = Math.min(closest, p.y - top);
      }
      expect(closest).toBeGreaterThan(-0.006);
      expect(closest).toBeLessThan(0.02);
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

describe('seated pose', () => {
  it('keeps hands out of the thighs', () => {
    for (const c of seated) expect(insideCount(worldVerts(c, ['Body']).filter((p, i, a) => true), posedBVH(c, 'Pants'))).toBe(0);
  });
  it('keeps the belt outside the trousers when the hips bend', () => {
    for (const c of seated) expect(insideCount(worldVerts(c, ['Belt']), posedBVH(c, 'Pants'))).toBe(0);
  });
  it('rests the feet on the ground (no dangling)', () => {
    for (const c of seated) {
      const shoes = worldVerts(c, ['Shoes']);
      const low = shoes.reduce((a, b) => (b.y < a.y ? b : a));
      expect(low.y - world.groundHeightAt(low.x, low.z)).toBeLessThan(0.03);
    }
  });
  it('fits the smallest and the biggest bodies on any seat without sinking into the log', () => {
    for (const body of [{ height: 150, width: 0.85 }, { height: 200, width: 1.3 }]) {
      for (const seatName of ['Seat_0', 'Seat_6']) {
        const c = new Character(gltfAll);
        c.setBody(body);
        seatCharacter(c, island.getObjectByName(seatName), world);
        let inside = 0;
        for (const p of worldVerts(c)) {
          const hits = benchHits(p.x, p.z);
          if (hits.length >= 2 && p.y < hits[0] - 0.006 && p.y > hits.at(-1) + 0.006) inside++;
        }
        expect(inside).toBe(0);
      }
    }
  });
});

describe('walking past seated characters', () => {
  it('keeps walkers off a wide seated body and frees the seat when they stand up', () => {
    const w = createWalkWorld(island);
    const c = new Character(gltfAll);
    c.setBody({ height: 200, width: 1.3 });
    const stand = seatCharacter(c, island.getObjectByName('Seat_4'), w);
    const p = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(c.root.quaternion).setY(0).normalize();
    const at = (d) => { const q = p.clone().addScaledVector(f, d); q.y = w.groundHeightAt(q.x, q.z); return q; };
    expect(w.blocked(at(1.6), at(1.0))).toBe(true); // shoes of a wide 2 m body reach ~0.7 m forward
    stand();
    expect(w.blocked(at(1.6), at(1.0))).toBe(false);
  });

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
