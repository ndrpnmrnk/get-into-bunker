import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import rig from '../../art/build/rig.json';
import { palette } from '../style/palette.js';
import { applyToonMaterials } from '../render/toon.js';
import { bodyScale, eyeHeightFor } from './body.js';

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

  update(dt) { this.mixer.update(dt); }
}
