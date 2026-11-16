import { describe, expect, it } from 'vitest';
import { createToonMaterial } from '../src/render/toon.js';
import { outlineThicknessPx } from '../src/render/outline.js';
import { t } from '../src/i18n/index.js';

describe('toon materials', () => {
  it('takes colours from the palette', () => {
    expect(createToonMaterial('grass').color.getHexString()).toBe('a8d69a');
  });
  it('rejects unknown palette keys', () => {
    expect(() => createToonMaterial('nope')).toThrow();
  });
});

describe('outline', () => {
  it('keeps the same CSS thickness on any pixel density', () => {
    expect(outlineThicknessPx(1.5, 1)).toBe(1.5);
    expect(outlineThicknessPx(1.5, 2)).toBe(3);
  });
});

describe('texts', () => {
  it('come from ru.json', () => {
    expect(t('probe.micDenied')).toMatch(/\S/);
  });
});
