import { t } from '../i18n/index.js';
import { startMic } from './mic.js';
import { mouthOpenFromLevel } from './mouth.js';

/** Probe: the player's voice moves the mouth of the first seated character. */
export function setupVoice(probe) {
  let mic = null, open = 0;
  probe.panel.button('probe.mic', async (btn) => {
    if (mic) return;
    mic = await startMic();
    if (!mic) { probe.panel.status(t('probe.micDenied')); return; }
    btn.textContent = t('probe.micOn');
  });
  probe.updaters.push((time, dt) => {
    open = mouthOpenFromLevel(mic ? mic.level() : 0, open, dt);
    probe.characters[0]?.setMouth(open);
  });
}
