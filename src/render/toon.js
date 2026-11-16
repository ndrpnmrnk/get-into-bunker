import * as THREE from 'three';
import { palette, SLOT_DEFAULT } from '../style/palette.js';

let gradient;
function gradientMap() {
  if (!gradient) {
    // three soft light bands: shadow, mid, lit
    gradient = new THREE.DataTexture(new Uint8Array([140, 205, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}

/** Cel-shaded material coloured by a palette key. */
export function createToonMaterial(colorKey) {
  const hex = palette[colorKey];
  if (!hex) throw new Error(`Unknown palette key: ${colorKey}`);
  const m = new THREE.MeshToonMaterial({ color: new THREE.Color(hex), gradientMap: gradientMap() });
  m.name = colorKey;
  return m;
}

/** Replaces glTF materials by name (palette key or character slot) with toon ones. */
export function applyToonMaterials(root) {
  const cache = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (mat) => {
      const key = SLOT_DEFAULT[mat.name] ?? mat.name;
      if (!palette[key]) return mat;
      if (!cache.has(mat.name)) {
        const m = createToonMaterial(key);
        m.name = mat.name; // keep the slot name so appearance can re-colour it
        cache.set(mat.name, m);
      }
      return cache.get(mat.name);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = o.receiveShadow = true;
  });
}
