import * as THREE from 'three';
import rig from '../../art/build/rig.json';

const FORWARD = 0.13; // ahead of the chest, so looking down shows belly, legs and feet

/**
 * Own character in first person: neck and head shrink to nothing (only for this
 * character, so its own camera never sees them) and the camera rides at eye height.
 */
export function enableFirstPerson(character, camera) {
  const neck = character.root.getObjectByName(rig.neck);
  character.meshes.forEach((m) => { m.frustumCulled = false; });
  character.update(0);
  character.root.updateMatrixWorld(true);
  const neckPos = neck.getWorldPosition(new THREE.Vector3());
  // neck height at body scale 1; the eye offset is recomputed each frame so setBody() is followed
  const neckBase = (neckPos.y - character.root.position.y) / character.root.scale.y;
  const tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    /** Call after the mixer update each frame. */
    update(state) {
      neck.scale.setScalar(0.001);
      character.root.updateMatrixWorld(true);
      neck.getWorldPosition(tmp);
      fwd.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
      camera.position.copy(tmp).addScaledVector(fwd, FORWARD);
      camera.position.y += character.eyeHeight() - neckBase * character.root.scale.y;
      camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ');
    },
  };
}
