import { describe, it, expect } from 'vitest';
import { parseCalibrationInput, parseScaleRatio, formatFeetInches } from '../components/drawings/measurementUtils';

// These tests pin down the Bugatti-standard contract for the drawing
// measurement tool. The bug they protect against: before 2026-05-19 the
// measurement tool silently reported raw pixels because the `drawings`
// table had no scale_text/scale_ratio column. The fix relies on:
//   1. parseScaleRatio() correctly parsing common construction notation
//      so AI-extracted scale_text turns into a usable multiplier.
//   2. parseCalibrationInput() accepting every reasonable user input
//      format so the new modal works for both an architect typing 1/4"
//      shorthand and a site super who pastes "120".
//   3. formatFeetInches() rounding to construction-grade precision.

describe('parseCalibrationInput — user-entered known distance', () => {
  it('parses plain inches', () => {
    expect(parseCalibrationInput('12')).toBe(12);
    expect(parseCalibrationInput('120')).toBe(120);
    expect(parseCalibrationInput('12.5')).toBe(12.5);
  });

  it('parses inches with explicit unit', () => {
    expect(parseCalibrationInput('12in')).toBe(12);
    expect(parseCalibrationInput('12"')).toBe(12);
    expect(parseCalibrationInput('12 inches')).toBe(12);
  });

  it('parses feet-only input', () => {
    expect(parseCalibrationInput("10'")).toBe(120);
    expect(parseCalibrationInput('10ft')).toBe(120);
    expect(parseCalibrationInput('10 feet')).toBe(120);
  });

  it('parses mixed feet + inches', () => {
    expect(parseCalibrationInput("10'-6\"")).toBe(126);
    expect(parseCalibrationInput("10' 6\"")).toBe(126);
    expect(parseCalibrationInput("10'6")).toBe(126);
    expect(parseCalibrationInput("3'-9\"")).toBe(45);
  });

  it('parses metric distances', () => {
    expect(parseCalibrationInput('1m')).toBeCloseTo(39.3701, 3);
    expect(parseCalibrationInput('2.5m')).toBeCloseTo(98.4253, 3);
    expect(parseCalibrationInput('30cm')).toBeCloseTo(11.811, 3);
    expect(parseCalibrationInput('100mm')).toBeCloseTo(3.93701, 3);
  });

  it('returns null for garbage input', () => {
    expect(parseCalibrationInput('')).toBeNull();
    expect(parseCalibrationInput('abc')).toBeNull();
    expect(parseCalibrationInput('-5')).toBeNull();
    expect(parseCalibrationInput('0')).toBeNull();
  });

  it('is case + whitespace tolerant', () => {
    expect(parseCalibrationInput('  10FT  ')).toBe(120);
    expect(parseCalibrationInput('2.5 M')).toBeCloseTo(98.4253, 3);
  });
});

describe('parseScaleRatio — AI-extracted scale_text', () => {
  it('parses architectural notation', () => {
    // 1/4" paper = 1'-0" real → 1 paper inch = 48 real inches
    const r = parseScaleRatio('1/4"=1\'-0"');
    expect(r).not.toBeNull();
    expect(r?.realPerPaper).toBeCloseTo(48, 1);
  });

  it('parses 1/8" scale', () => {
    const r = parseScaleRatio('1/8"=1\'-0"');
    expect(r?.realPerPaper).toBeCloseTo(96, 1);
  });

  it('parses engineering scale (1"=20\')', () => {
    const r = parseScaleRatio("1\"=20'");
    expect(r?.realPerPaper).toBeCloseTo(240, 1);
  });

  it('parses metric ratio', () => {
    const r = parseScaleRatio('1:100');
    expect(r?.realPerPaper).toBe(100);
  });

  it('returns null for NTS / unparseable', () => {
    expect(parseScaleRatio('NTS')).toBeNull();
    expect(parseScaleRatio(null)).toBeNull();
    expect(parseScaleRatio('')).toBeNull();
  });
});

describe('formatFeetInches — construction-grade label rounding', () => {
  it('formats whole-foot values', () => {
    expect(formatFeetInches(12)).toBe("1'-0\"");
    expect(formatFeetInches(120)).toBe("10'-0\"");
  });

  it('formats mixed feet + inches', () => {
    expect(formatFeetInches(126)).toBe("10'-6\"");
    expect(formatFeetInches(45)).toBe("3'-9\"");
  });

  it('rounds to nearest half inch (construction standard)', () => {
    expect(formatFeetInches(126.2)).toBe("10'-6\"");
    expect(formatFeetInches(126.25)).toBe("10'-6.5\"");
  });

  it('returns inches when under a foot', () => {
    expect(formatFeetInches(6)).toBe('6"');
    expect(formatFeetInches(0.4)).toBe('0.5"');
  });
});

describe('integration — calibration round-trip', () => {
  // Sanity: if a user clicks two points 600 image-pixels apart on a sheet
  // and types "10'" as the real distance, the resulting calibrationScale
  // (real inches per image pixel) should correctly translate any other
  // pixel distance back into feet-inches.
  it("user calibrates 600 px = 10', then a 300 px measurement reads 5'-0\"", () => {
    const userIn = parseCalibrationInput("10'")!;        // = 120 inches
    const pxDist = 600;
    const calibrationScale = userIn / pxDist;            // = 0.2 in/px
    const labelInches = 300 * calibrationScale;          // = 60 inches
    expect(formatFeetInches(labelInches)).toBe("5'-0\"");
  });
});
