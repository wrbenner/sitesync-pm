import { describe, it, expect, vi } from 'vitest';
import {
  normalizePoint,
  denormalizePoint,
  colorForUser,
  CURSOR_PALETTE,
  throttle,
  isMeaningfulMove,
} from '../liveCursor';

describe('normalizePoint', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  it('returns 0..1 within rect', () => {
    expect(normalizePoint(100, 50, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePoint(500, 250, rect)).toEqual({ x: 1, y: 1 });
    expect(normalizePoint(300, 150, rect)).toEqual({ x: 0.5, y: 0.5 });
  });
  it('clamps outside the rect', () => {
    expect(normalizePoint(0, 0, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePoint(9999, 9999, rect)).toEqual({ x: 1, y: 1 });
  });
  it('round-trips through denormalize', () => {
    const norm = normalizePoint(300, 150, rect);
    const back = denormalizePoint(norm, { width: rect.width, height: rect.height });
    expect(back).toEqual({ x: 200, y: 100 });
  });
});

describe('colorForUser', () => {
  it('returns a value from the palette', () => {
    const c = colorForUser('u1', 'rfi:r1');
    expect(CURSOR_PALETTE.includes(c as typeof CURSOR_PALETTE[number])).toBe(true);
  });
  it('is deterministic for the same (user, room)', () => {
    expect(colorForUser('u1', 'rfi:r1')).toBe(colorForUser('u1', 'rfi:r1'));
  });
  it('different rooms produce different colors for the same user (usually)', () => {
    // Not strictly guaranteed (8 palette entries), but two distinct rooms
    // out of the same user's hash should diversify across many tries.
    const distinct = new Set(
      Array.from({ length: 50 }, (_, i) => colorForUser('u1', `rfi:r${i}`)),
    );
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe('throttle', () => {
  it('fires the first call immediately', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });
  it('coalesces calls within the window', async () => {
    const fn = vi.fn();
    const t = throttle(fn, 50);
    t('a'); t('b'); t('c');
    // First call fires immediately; the rest collapse to one trailing call.
    expect(fn).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 70));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });
});

describe('isMeaningfulMove', () => {
  it('true on first call (no prev)', () => {
    expect(isMeaningfulMove(undefined, { x: 0, y: 0 })).toBe(true);
  });
  it('false for sub-threshold movement', () => {
    expect(isMeaningfulMove({ x: 0.1, y: 0.1 }, { x: 0.101, y: 0.101 })).toBe(false);
  });
  it('true for above-threshold movement', () => {
    expect(isMeaningfulMove({ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 })).toBe(true);
  });
  it('true when caret index changes', () => {
    expect(
      isMeaningfulMove({ x: 0.1, y: 0.1, caret: 4 }, { x: 0.1, y: 0.1, caret: 5 }),
    ).toBe(true);
  });
  it('true when field changes', () => {
    expect(
      isMeaningfulMove({ x: 0.1, y: 0.1, field: 'a' }, { x: 0.1, y: 0.1, field: 'b' }),
    ).toBe(true);
  });
});
