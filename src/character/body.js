export const BASE_HEIGHT = 175;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Model scale for a body: height in cm (150–200, base 175), width factor 0.85–1.3. */
export function bodyScale({ height = BASE_HEIGHT, width = 1 }) {
  const y = clamp(height, 150, 200) / BASE_HEIGHT;
  const w = clamp(width, 0.85, 1.3);
  return { x: w, y, z: w };
}

/** Eye height in metres above the feet for this body. */
export function eyeHeightFor(eyeHeightCm, body) {
  return (eyeHeightCm / 100) * bodyScale(body).y;
}
