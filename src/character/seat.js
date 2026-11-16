import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';

export const LOG_TOP = 0.47;      // bench top above the ground (fallback only)
const PELVIS_ABOVE_SEAT = 0.12;   // pelvis bone sits this far above the surface it rests on
const CONTACT_RADIUS = 0.15;      // where to look for the seat contact around the pelvis (scaled by width)
const SIDE = new THREE.Vector3(1, 0, 0); // character space: legs and forearms swing around this axis

/** Root height that puts a seated character's pelvis on the log, whatever its body size. */
export function seatedRootY(logTopY, pelvisAboveRoot) {
  return logTopY + PELVIS_ABOVE_SEAT - pelvisAboveRoot;
}

const v = new THREE.Vector3();
function layerPoints(c, name) {
  const out = [];
  for (const m of c.meshes) {
    if (m.name !== name) continue;
    for (let i = 0; i < m.geometry.attributes.position.count; i++) out.push(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).clone());
  }
  return out;
}
function pose(c) { c.update(0); c.root.updateMatrixWorld(true); }
const worldPos = (c, bone) => c.root.getObjectByName(bone).getWorldPosition(new THREE.Vector3());

/** Lowest trouser point under the pelvis. */
function seatContact(c) {
  const pelvis = worldPos(c, 'pelvis'), r = CONTACT_RADIUS * c.root.scale.x;
  let low = null;
  for (const p of layerPoints(c, 'Pants')) {
    if (Math.hypot(p.x - pelvis.x, p.z - pelvis.z) > r) continue;
    if (!low || p.y < low.y) low = p;
  }
  return low ?? pelvis;
}

/** Puts the seat of the trousers exactly on the bench top, then lifts out of any dip into the log. */
function dropOntoBench(c, world) {
  const low = seatContact(c);
  const top = world.topAt('Benches', low.x, low.z);
  const ground = world.groundHeightAt(low.x, low.z);
  if (top === null && ground === null) { console.warn('seatCharacter: no bench or ground under', low); return; }
  c.root.position.y += (top ?? ground + LOG_TOP) - low.y + 0.004;
  pose(c);
  let dip = 0;
  for (const p of layerPoints(c, 'Pants')) {
    const t = world.topAt('Benches', p.x, p.z);
    if (t !== null && p.y < t && p.y > t - 0.12) dip = Math.max(dip, t - p.y);
  }
  if (dip > 0) { c.root.position.y += dip + 0.003; pose(c); }
}

/** Gap between the lowest shoe point and the ground (negative = under the ground). */
function feetGap(c, world) {
  const low = layerPoints(c, 'Shoes').reduce((a, b) => (b.y < a.y ? b : a));
  return low.y - (world.groundHeightAt(low.x, low.z) ?? low.y);
}

/** Posed trousers as a BVH, to test whether hand points are inside them. */
function pantsBVH(c) {
  const m = c.meshes.find((x) => x.name === 'Pants');
  const pts = layerPoints(c, 'Pants');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap((p) => p.toArray())), 3));
  g.setIndex(m.geometry.index);
  return new MeshBVH(g);
}
const up = new THREE.Vector3(0, 1, 0);
function handsInside(c) {
  const bvh = pantsBVH(c);
  return layerPoints(c, 'Body').filter((p) => bvh.raycast(new THREE.Ray(p, up), THREE.DoubleSide).length % 2 === 1).length;
}

/**
 * Sits a character on the bench under `seat`: trousers centred over the log axis and
 * resting on its top; thighs tilted until the feet reach the ground; forearms lifted
 * until the hands clear the thighs. Returns stand(): frees the seat for walkers.
 */
export function seatCharacter(c, seat, world) {
  seat.getWorldPosition(c.root.position);
  seat.getWorldQuaternion(c.root.quaternion);
  c.poseOffsets = [];
  c.play('sit', 0);
  pose(c);
  const axis = seat.getWorldPosition(new THREE.Vector3());
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(c.root.quaternion).setY(0).normalize();
  c.root.position.addScaledVector(fwd, axis.clone().sub(seatContact(c)).dot(fwd));
  pose(c);
  dropOntoBench(c, world);

  // feet to the ground.
  // Feet under the ground (long legs): raise the knees a little.
  // Feet in the air (short legs): sit further forward on the round log — its top falls
  // away towards the front, which lowers the whole body, as people do on a high log.
  let gap = feetGap(c, world);
  if (gap < -0.005) {
    const thighLen = 0.4 * c.root.scale.y;
    const k0 = worldPos(c, 'calf_l').y;
    c.setPoseOffset('thigh_l', SIDE, 0.05); c.setPoseOffset('thigh_r', SIDE, 0.05); pose(c);
    const sign = worldPos(c, 'calf_l').y > k0 ? 1 : -1; // + raises the knees
    const tilt = sign * Math.asin(Math.min(0.9, (-gap + 0.005) / thighLen));
    c.setPoseOffset('thigh_l', SIDE, tilt); c.setPoseOffset('thigh_r', SIDE, tilt); pose(c);
  }
  for (let slid = 0; (gap = feetGap(c, world)) > 0.02 && slid < 0.2; slid += 0.02) {
    c.root.position.addScaledVector(fwd, 0.02);
    pose(c);
    dropOntoBench(c, world);
  }

  // hands off the thighs: lift both forearms in small steps
  let lift = 0, liftSign = 0;
  for (let i = 0; i < 12 && handsInside(c) > 0; i++) {
    if (!liftSign) {
      const h0 = worldPos(c, 'hand_l').y;
      c.setPoseOffset('lowerarm_l', SIDE, 0.05); pose(c);
      liftSign = worldPos(c, 'hand_l').y > h0 ? 1 : -1;
    }
    lift += liftSign * 0.05;
    c.setPoseOffset('lowerarm_l', SIDE, lift); c.setPoseOffset('lowerarm_r', SIDE, lift);
    pose(c);
  }

  // the seated body blocks walkers: a circle from the pelvis to the feet
  const pelvis = worldPos(c, 'pelvis');
  const feet = worldPos(c, 'foot_l').add(worldPos(c, 'foot_r')).multiplyScalar(0.5);
  const reach = Math.hypot(feet.x - pelvis.x, feet.z - pelvis.z) + 0.15 * c.root.scale.x;
  return world.addBlocker?.({ x: (pelvis.x + feet.x) / 2, z: (pelvis.z + feet.z) / 2, r: reach / 2 + 0.15 * c.root.scale.x }) ?? (() => {});
}
