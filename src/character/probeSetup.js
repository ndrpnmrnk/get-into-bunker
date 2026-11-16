import * as THREE from 'three';
import { loadCharacter } from './character.js';
import { VARIANTS } from './variants.js';
import { seatCharacter } from './seat.js';

const SEATS = ['Seat_0', 'Seat_1', 'Seat_3']; // the far side of the fire, facing the close-up camera

/** Seats the three probe variants around the fire. */
export async function setupCharacters(probe, loader) {
  probe.characters = [];
  for (const [i, v] of VARIANTS.entries()) {
    const c = await loadCharacter(loader);
    c.setBody(v.body);
    c.setAppearance(v.look);
    seatCharacter(c, probe.world.island.getObjectByName(SEATS[i]), probe.walkWorld);
    c.mixer.setTime(Math.random() * 3);
    probe.scene.add(c.root);
    probe.characters.push(c);
  }
  probe.updaters.push((time, dt) => probe.characters.forEach((c) => c.update(dt)));
}
