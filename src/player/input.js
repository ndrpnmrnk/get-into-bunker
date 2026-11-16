const SENSITIVITY = 0.0022;

/** Keyboard + pointer-lock mouse. read() returns this frame's input and resets mouse deltas. */
export function createInput(canvas) {
  const keys = new Set();
  let dx = 0, dy = 0, jump = false;
  addEventListener('keydown', (e) => { keys.add(e.code); if (e.code === 'Space') jump = true; });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('click', () => canvas.requestPointerLock?.());
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== canvas) return;
    dx += e.movementX; dy += e.movementY;
  });
  return {
    read() {
      const k = (c) => keys.has(c);
      const input = {
        forward: k('KeyW'), back: k('KeyS'), left: k('KeyA'), right: k('KeyD'),
        jump, crouch: k('KeyC') || k('ControlLeft') || k('ControlRight'),
        dYaw: -dx * SENSITIVITY, dPitch: -dy * SENSITIVITY,
      };
      dx = dy = 0; jump = false;
      return input;
    },
  };
}
