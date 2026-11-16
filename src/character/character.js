import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import rig from '../../art/build/rig.json';
import { palette } from '../style/palette.js';
import { applyToonMaterials } from '../render/toon.js';
import { bodyScale, eyeHeightFor } from './body.js';

const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _a = new THREE.Vector3();

let source;
/** Loads character.glb once; every call returns a new independent character. */
export async function loadCharacter(loader) {
  source ??= await loader.loadAsync('./models/character.glb');
  return new Character(source);
}

export class Character {
  constructor(gltf) {
    this.root = cloneSkinned(gltf.scene);
    applyToonMaterials(this.root);
    this.meshes = []; // glTF splits the body into one skinned mesh per material slot
    this.root.traverse((o) => { if (o.isSkinnedMesh) this.meshes.push(o); });
    this.head = this.root.getObjectByName(rig.head);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = Object.fromEntries(gltf.animations.map((c) => [c.name, this.mixer.clipAction(c)]));
    this.current = null;
    this.body = { height: 175, width: 1 };
    this.poseOffsets = []; // [{ bone, axis (character space), angle }], applied on top of the clip
  }

  /** Extra rotation of a bone around an axis given in the character's own space. */
  setPoseOffset(boneName, axis, angle) {
    const bone = this.root.getObjectByName(boneName);
    const o = this.poseOffsets.find((p) => p.bone === bone);
    if (o) o.angle = angle; else this.poseOffsets.push({ bone, axis: axis.clone().normalize(), angle });
  }

  /** 'idle' | 'walk' | 'jump' | 'crouchIdle' | 'crouchWalk' | 'sit' */
  play(name, fade = 0.2) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current) next.crossFadeFrom(this.current, fade, false);
    this.current = next;
  }

  /** Re-colour the material slots with palette keys. */
  setAppearance(look) {
    for (const mesh of this.meshes) {
      for (const m of [].concat(mesh.material)) if (look[m.name]) m.color.set(palette[look[m.name]]);
    }
  }

  setBody(body) {
    this.body = { ...this.body, ...body };
    const s = bodyScale(this.body);
    this.root.scale.set(s.x, s.y, s.z);
  }

  eyeHeight() {
    return eyeHeightFor(rig.eyeHeightCm, this.body);
  }

  setMouth(open) {
    for (const mesh of this.meshes) {
      const i = mesh.morphTargetDictionary?.mouthOpen;
      if (i !== undefined) mesh.morphTargetInfluences[i] = open;
    }
  }

  update(dt) {
    this.mixer.update(dt);
    if (!this.poseOffsets.length) return;
    this.root.updateMatrixWorld(true);
    for (const o of this.poseOffsets) {
      const { bone, axis, angle } = o;
      // the mixer skips bones whose clip value did not change: start again from the clip pose
      if (o.applied && bone.quaternion.equals(o.applied)) bone.quaternion.copy(o.base);
      o.base = bone.quaternion.clone();
      // axis in character space -> bone's parent space, then rotate the bone in it
      _q.setFromAxisAngle(_a.copy(axis).transformDirection(this.root.matrixWorld), angle);
      bone.parent.getWorldQuaternion(_pq);
      _q.premultiply(_pq.clone().invert()).multiply(_pq);
      bone.quaternion.premultiply(_q);
      o.applied = bone.quaternion.clone();
      bone.updateMatrixWorld(true);
    }
  }
}
