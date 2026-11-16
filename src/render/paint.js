/**
 * Hand-painted look without image textures: soft value-noise mottling, fine detail
 * (weave, bark) and rock strata, anchored to the model's own coordinates so it never
 * swims over animated characters. Keyed by palette key without the variant digit.
 */
export const PAINT = {
  grass: { amp: 0.09, scale: 0.45, detail: 0.05, detailScale: 3 },
  grassDark: { amp: 0.08, scale: 1.2 },
  cliff: { amp: 0.07, scale: 0.5, strata: 0.07, strataFreq: 0.9 },
  rock: { amp: 0.09, scale: 1.6 },
  wood: { amp: 0.07, scale: 2.5, detail: 0.05, detailScale: 14 },
  woodDark: { amp: 0.06, scale: 3 },
  skin: { amp: 0.025, scale: 7 },
  shirt: { amp: 0.035, scale: 18 },
  pants: { amp: 0.05, scale: 16 },
  hair: { amp: 0.06, scale: 9 },
  shoes: { amp: 0.04, scale: 10 },
  belt: { amp: 0.04, scale: 20 },
};

const NOISE = /* glsl */`
varying vec3 vPaintPos;
uniform float paintAmp, paintScale, paintDetail, paintDetailScale, paintStrata, paintStrataFreq;
float paintHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float paintNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(paintHash(i), paintHash(i + vec3(1,0,0)), f.x), mix(paintHash(i + vec3(0,1,0)), paintHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(paintHash(i + vec3(0,0,1)), paintHash(i + vec3(1,0,1)), f.x), mix(paintHash(i + vec3(0,1,1)), paintHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

export function paintFor(colorKey) {
  return PAINT[colorKey] ?? PAINT[colorKey.replace(/\d+$/, '')] ?? null;
}

/** Adds the painted look to a material (no-op for flat details like eyes or buttons). */
export function applyPaint(material, colorKey) {
  const p = paintFor(colorKey);
  if (!p) return material;
  material.userData.paint = p;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      paintAmp: { value: p.amp }, paintScale: { value: p.scale },
      paintDetail: { value: p.detail ?? 0 }, paintDetailScale: { value: p.detailScale ?? 1 },
      paintStrata: { value: p.strata ?? 0 }, paintStrataFreq: { value: p.strataFreq ?? 1 },
    });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPaintPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float paintN = paintNoise(vPaintPos * paintScale) - 0.5;
        float paintD = paintNoise(vPaintPos * paintDetailScale + 17.0) - 0.5;
        float paintS = sin(vPaintPos.y * paintStrataFreq * 6.2831 + paintNoise(vPaintPos * 0.8) * 3.0) * 0.5;
        diffuseColor.rgb *= 1.0 + 2.0 * (paintN * paintAmp + paintD * paintDetail) + paintS * paintStrata;`);
  };
  material.customProgramCacheKey = () => 'paint';
  return material;
}
