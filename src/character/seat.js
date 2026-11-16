export const LOG_TOP = 0.45;      // bench top above the ground
const PELVIS_ABOVE_SEAT = 0.12;   // pelvis bone sits this far above the surface it rests on

/** Root height that puts a seated character's pelvis on the log, whatever its body size. */
export function seatedRootY(logTopY, pelvisAboveRoot) {
  return logTopY + PELVIS_ABOVE_SEAT - pelvisAboveRoot;
}
