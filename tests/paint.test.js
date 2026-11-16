import { describe, expect, it } from 'vitest';
import { createToonMaterial } from '../src/render/toon.js';
import { PAINT } from '../src/render/paint.js';

function compile(mat) {
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n#include <project_vertex>\n}',
    fragmentShader: '#include <common>\nvoid main(){\n#include <color_fragment>\n}',
  };
  mat.onBeforeCompile(shader);
  return shader;
}

describe('painted texture', () => {
  it('adds surface-anchored paint noise to textured materials', () => {
    const s = compile(createToonMaterial('grass'));
    expect(s.vertexShader).toContain('vPaintPos = position');
    expect(s.fragmentShader).toContain('paintNoise');
    expect(s.uniforms.paintAmp.value).toBe(PAINT.grass.amp);
  });
  it('gives cliffs horizontal rock strata', () => {
    const s = compile(createToonMaterial('cliff'));
    expect(s.uniforms.paintStrata.value).toBeGreaterThan(0);
  });
  it('leaves flat-colour details (eyes, buttons) untouched', () => {
    const m = createToonMaterial('eyes');
    expect(m.onBeforeCompile.toString()).not.toContain('paint');
  });
  it('compiles each paint setup once and shares it between materials', () => {
    expect(createToonMaterial('wood').customProgramCacheKey()).toBe(createToonMaterial('wood').customProgramCacheKey());
  });
});
