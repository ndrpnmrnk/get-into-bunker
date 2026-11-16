import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { loadCharacter } from '../character/character.js';
import { createWalkWorld } from './world.js';
import { createInput } from './input.js';
import { enableFirstPerson } from './firstPerson.js';
import { newPlayerState, stepMovement } from './movement.js';

/** Probe: walk the island in first person as your own character. */
export async function setupFirstPerson(probe, loader) {
  const world = createWalkWorld(probe.world.island);
  const input = createInput(probe.renderer.domElement);
  const me = await loadCharacter(loader);
  me.setAppearance({ skin: 'skin2', shirt: 'shirt3', shorts: 'shorts1', hair: 'hair2' });
  me.root.visible = false;
  probe.scene.add(me.root);
  const spawn = probe.world.island.getObjectByName('Spawn').getWorldPosition(new THREE.Vector3());
  let state = newPlayerState(spawn);
  state.pos.y = world.groundHeightAt(spawn.x, spawn.z);
  let fp = null, active = false;

  const enter = (pitch = 0) => {
    active = true;
    probe.controls.enabled = false;
    probe.camera.fov = 68; probe.camera.updateProjectionMatrix(); // usual PC shooter field of view
    me.root.visible = true;
    state.pitch = pitch;
    fp ??= enableFirstPerson(me, probe.camera);
    probe.panel.status(t('probe.fpvHint'));
    probe.view = 'firstPerson';
  };
  const leaveTo = (view) => () => {
    active = false; me.root.visible = false; probe.panel.status('');
    probe.camera.fov = 55; probe.camera.updateProjectionMatrix();
    view();
  };
  probe.views.overview = leaveTo(probe.views.overview);
  probe.views.closeup = leaveTo(probe.views.closeup);
  probe.views.firstPerson = () => enter(0);
  probe.views['fpv-down'] = () => enter(-1.2); // screenshot helper: look down at your own body
  probe.panel.button('probe.viewFirstPerson', () => probe.views.firstPerson());

  probe.updaters.push((time, dt) => {
    if (!active) return;
    state = stepMovement(state, input.read(), dt, world);
    me.root.position.copy(state.pos);
    me.root.rotation.set(0, state.yaw + Math.PI, 0);
    me.play(!state.grounded ? 'jump' : state.crouch ? (state.moving ? 'crouchWalk' : 'crouchIdle') : state.moving ? 'walk' : 'idle');
    me.update(dt);
    fp.update(state);
  });
}
