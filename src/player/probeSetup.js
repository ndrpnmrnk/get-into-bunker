import * as THREE from 'three';
import { t } from '../i18n/index.js';
import { loadCharacter } from '../character/character.js';
import { createInput } from './input.js';
import { enableFirstPerson } from './firstPerson.js';
import { newPlayerState, stepMovement } from './movement.js';
import { VARIANTS } from '../character/variants.js';

/** Probe: walk the island in first person as your own character. */
export async function setupFirstPerson(probe, loader) {
  const world = probe.walkWorld;
  let active = false;
  const input = createInput(probe.renderer.domElement, { isActive: () => active });
  const me = await loadCharacter(loader);
  let variant = 0;
  const applyVariant = () => { me.setBody(VARIANTS[variant].body); me.setAppearance(VARIANTS[variant].look); };
  applyVariant();
  me.root.visible = false;
  probe.scene.add(me.root);
  const spawn = probe.world.island.getObjectByName('Spawn').getWorldPosition(new THREE.Vector3());
  let state = newPlayerState(spawn);
  state.pos.y = world.groundHeightAt(spawn.x, spawn.z);
  let fp = null;

  const enter = (pitch = 0) => {
    active = true;
    probe.controls.enabled = false;
    probe.camera.fov = 68; probe.camera.updateProjectionMatrix(); // usual PC shooter field of view
    me.root.visible = true;
    state.pitch = pitch;
    input.reset();
    fp ??= enableFirstPerson(me, probe.camera);
    probe.panel.status(t('probe.fpvHint'));
    probe.view = 'firstPerson';
  };
  const leaveTo = (view) => () => {
    active = false; me.root.visible = false; probe.panel.status('');
    document.exitPointerLock?.();
    probe.camera.fov = 55; probe.camera.updateProjectionMatrix();
    view();
  };
  probe.views.overview = leaveTo(probe.views.overview);
  probe.views.closeup = leaveTo(probe.views.closeup);
  probe.views.firstPerson = () => enter(0);
  probe.views['fpv-down'] = () => enter(-1.2); // screenshot helper: look down at your own body
  probe.panel.button('probe.viewFirstPerson', () => probe.views.firstPerson());
  probe.panel.button('probe.variant', () => { variant = (variant + 1) % VARIANTS.length; applyVariant(); });

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
