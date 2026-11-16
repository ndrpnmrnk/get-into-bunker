import * as THREE from 'three';

const PLAYER_RADIUS = 0.35;

/** Walkability built from the island: a height grid sampled from Ground + ray checks on WalkBlockers. */
export function createWalkWorld(island, { cell = 0.25, radius = 9.5 } = {}) {
  island.updateMatrixWorld(true);
  const ground = island.getObjectByName('Ground');
  const blockers = island.getObjectByName('WalkBlockers');
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const n = Math.ceil((radius * 2) / cell) + 1;
  const grid = new Float32Array(n * n).fill(NaN);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ray.set(new THREE.Vector3(-radius + i * cell, 50, -radius + j * cell), down);
      const hit = ray.intersectObject(ground, true)[0];
      if (hit) grid[i * n + j] = hit.point.y;
    }
  }
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? NaN : grid[i * n + j]);

  return {
    groundHeightAt(x, z) {
      const fx = (x + radius) / cell, fz = (z + radius) / cell;
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const h = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)];
      if (h.some(Number.isNaN)) return null; // off the plateau
      return (h[0] * (1 - u) + h[1] * u) * (1 - v) + (h[2] * (1 - u) + h[3] * u) * v;
    },
    blocked(from, to) {
      const d = to.clone().sub(from); d.y = 0;
      const len = d.length();
      if (len === 0) return false;
      ray.set(from.clone().setY(from.y + 0.5), d.normalize());
      ray.far = len + PLAYER_RADIUS;
      return ray.intersectObject(blockers, true).length > 0;
    },
  };
}
