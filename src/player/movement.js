import * as THREE from 'three';

export const WALK_SPEED = 3.5;
export const CROUCH_SPEED = 1.6;
export const JUMP_SPEED = 5;
export const GRAVITY = 18;
const MAX_PITCH = (85 * Math.PI) / 180;
const SNAP_DOWN = 0.3; // stay glued to gentle slopes instead of hopping off them

export function newPlayerState(pos) {
  return { pos: pos.clone(), velY: 0, yaw: 0, pitch: 0, crouch: false, grounded: true, moving: false };
}

/**
 * One movement step. Pure: returns a new state.
 * world.groundHeightAt(x, z) -> number | null (null = no walkable ground, e.g. past a cliff)
 * world.blocked(from, to) -> boolean (campfire, trees…)
 */
export function stepMovement(state, input, dt, world) {
  const s = { ...state, pos: state.pos.clone() };
  s.yaw += input.dYaw;
  s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch + input.dPitch));
  s.crouch = input.crouch;

  // camera looks along -Z at yaw 0
  const fwd = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
  const right = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
  const dir = new THREE.Vector3()
    .addScaledVector(fwd, (input.forward ? 1 : 0) - (input.back ? 1 : 0))
    .addScaledVector(right, (input.right ? 1 : 0) - (input.left ? 1 : 0));
  s.moving = dir.lengthSq() > 0;
  if (s.moving) {
    const step = dir.normalize().multiplyScalar((s.crouch ? CROUCH_SPEED : WALK_SPEED) * dt);
    // full move, else slide along one axis
    for (const d of [step, new THREE.Vector3(step.x, 0, 0), new THREE.Vector3(0, 0, step.z)]) {
      if (d.lengthSq() === 0) continue;
      const to = s.pos.clone().add(d);
      if (world.groundHeightAt(to.x, to.z) !== null && !world.blocked(s.pos, to)) {
        s.pos.x = to.x; s.pos.z = to.z;
        break;
      }
    }
  }

  if (s.grounded && input.jump) { s.velY = JUMP_SPEED; s.grounded = false; }
  const ground = world.groundHeightAt(s.pos.x, s.pos.z) ?? s.pos.y;
  if (s.grounded) {
    if (s.pos.y - ground <= SNAP_DOWN) s.pos.y = ground;
    else s.grounded = false;
  }
  if (!s.grounded) {
    s.velY -= GRAVITY * dt;
    s.pos.y += s.velY * dt;
    if (s.pos.y <= ground) { s.pos.y = ground; s.velY = 0; s.grounded = true; }
  }
  return s;
}
