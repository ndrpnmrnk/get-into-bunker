const SENSITIVITY = 0.0022;

/**
 * Keyboard + pointer-lock mouse, only while isActive() (first person).
 * read() returns this frame's input; reset() drops anything pressed before entering.
 */
export function createInput(canvas, { target = window, doc = document, isActive = () => true } = {}) {
  const keys = new Set();
  let dx = 0, dy = 0, jump = false;
  target.addEventListener('keydown', (e) => {
    if (!isActive()) return;
    keys.add(e.code);
    if (e.code === 'Space') { jump = true; e.preventDefault(); }
  });
  target.addEventListener('keyup', (e) => keys.delete(e.code));
  target.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('click', () => { if (isActive()) canvas.requestPointerLock?.(); });
  target.addEventListener('mousemove', (e) => {
    if (doc.pointerLockElement !== canvas) return;
    dx += e.movementX; dy += e.movementY;
  });
  return {
    read() {
      const k = (c) => keys.has(c);
      const input = {
        forward: k('KeyW'), back: k('KeyS'), left: k('KeyA'), right: k('KeyD'),
        jump, crouch: k('KeyC'), // not Ctrl: Ctrl+W closes the browser tab
        dYaw: -dx * SENSITIVITY, dPitch: -dy * SENSITIVITY,
      };
      dx = dy = 0; jump = false;
      return input;
    },
    reset() { keys.clear(); dx = dy = 0; jump = false; },
  };
}
