import { t } from '../i18n/index.js';
import { startMic } from './mic.js';
import { mouthOpenFromLevel } from './mouth.js';
import { createMicToggle } from './micToggle.js';

/** Probe: the player's voice moves the mouth of the first seated character. */
export function setupVoice(probe) {
  let mic = null, open = 0;
  const toggle = createMicToggle(startMic);
  probe.panel.button('probe.mic', async (btn) => {
    mic = await toggle();
    // the result lives on the button, so view hints never overwrite it
    btn.textContent = t(mic ? 'probe.micOn' : 'probe.micDenied');
    btn.title = btn.textContent;
  });
  probe.updaters.push((time, dt) => {
    open = mouthOpenFromLevel(mic ? mic.level() : 0, open, dt);
    probe.characters[0]?.setMouth(open);
  });
}
