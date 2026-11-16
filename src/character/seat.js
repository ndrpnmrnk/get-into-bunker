import * as THREE from 'three';

export const LOG_TOP = 0.53;      // bench top above the ground (fallback only)
const PELVIS_ABOVE_SEAT = 0.12;   // pelvis bone sits this far above the surface it rests on
const SEAT_LAYER = 'Pants';       // the layer that touches the bench
const CONTACT_RADIUS = 0.15;      // where to look for the seat contact around the pelvis

/** Root height that puts a seated character's pelvis on the log, whatever its body size. */
export function seatedRootY(logTopY, pelvisAboveRoot) {
  return logTopY + PELVIS_ABOVE_SEAT - pelvisAboveRoot;
}

const v = new THREE.Vector3();
/** Lowest point of the seat layer under the pelvis, in world space (current pose). */
function seatContact(c) {
  const pelvis = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
  let low = null;
  for (const m of c.meshes) {
    if (m.name !== SEAT_LAYER) continue;
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      if (Math.hypot(v.x - pelvis.x, v.z - pelvis.z) > CONTACT_RADIUS) continue;
      if (!low || v.y < low.y) low = v.clone();
    }
  }
  return low ?? pelvis;
}

/**
 * Sits a character on the bench under `seat`: the seat of the trousers is centred over
 * the log's axis (the sit clip keeps the pelvis behind the root) and rests exactly on
 * the log's top surface.
 */
export function seatCharacter(c, seat, world) {
  seat.getWorldPosition(c.root.position);
  seat.getWorldQuaternion(c.root.quaternion);
  c.play('sit', 0);
  c.update(0);
  c.root.updateMatrixWorld(true);
  const axis = seat.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(c.root.quaternion).setY(0).normalize();
  // 1. slide forward/back so the contact point is over the log's axis
  const contact = seatContact(c);
  c.root.position.addScaledVector(fwd, axis.clone().sub(contact).dot(fwd));
  c.root.updateMatrixWorld(true);
  // 2. drop/raise onto the bench surface
  const low = seatContact(c);
  const top = world.topAt('Benches', low.x, low.z) ?? world.groundHeightAt(low.x, low.z) + LOG_TOP;
  c.root.position.y += top - low.y + 0.004;
  c.root.updateMatrixWorld(true);
  // 3. the seated body blocks walkers: knees and shins sit in front of the pelvis
  const pelvis = c.root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3());
  world.addBlocker?.({ x: pelvis.x + fwd.x * 0.25, z: pelvis.z + fwd.z * 0.25, r: 0.35 });
}
