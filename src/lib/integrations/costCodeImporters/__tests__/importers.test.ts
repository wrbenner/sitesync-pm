import { describe, it, expect } from 'vitest';
import {
  IMPORTERS,
  getImporter,
  sage100,
  sage300,
  viewpointVista,
  foundation,
  yardi,
  spectrum,
} from '..';

describe('cost-code importers', () => {
  it('exposes 6 importers', () => {
    expect(IMPORTERS.length).toBe(6);
    expect(getImporter('sage100')?.id).toBe('sage100');
    expect(getImporter('does-not-exist')).toBeUndefined();
  });

  it('Sage 100 parses with default mapping', () => {
    const csv = [
      'Cost Code,Description,Phase,Job Type,Unit Cost',
      '01-100,Mobilization,General,L,75.00',
      '03-300,Concrete,Concrete,Material,$120.50',
    ].join('\n');
    const result = sage100.parse(csv);
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(2);
    expect(result.data?.[0].type).toBe('labor');
    expect(result.data?.[0].rate).toBe(75);
    expect(result.data?.[1].rate).toBe(120.5);
    expect(result.data?.[1].type).toBe('material');
  });

  it('Sage 300 parses', () => {
    const csv = [
      'Standard Cost Code,Description,CSI Division,Cost Category,Standard Rate',
      '01000,Misc,01,Equipment,150',
    ].join('\n');
    const result = sage300.parse(csv);
    expect(result.data?.[0].type).toBe('equipment');
    expect(result.data?.[0].division).toBe('01');
  });

  it('Viewpoint Vista parses', () => {
    const csv = [
      'PhaseCode,PhaseDesc,Department,CostType,BillingRate',
      'V-100,Cleanup,Site,Sub,500',
    ].join('\n');
    const result = viewpointVista.parse(csv);
    expect(result.data?.[0].type).toBe('sub');
  });

  it('Foundation parses', () => {
    const csv = [
      'CC Code,CC Name,Division,Type,Std Rate',
      'F-1,Roofing,07,Material,3.50',
    ].join('\n');
    const result = foundation.parse(csv);
    expect(result.data?.[0].code).toBe('F-1');
    expect(result.data?.[0].rate).toBe(3.5);
  });

  it('Yardi parses', () => {
    const csv = [
      'Account,Account Name,Group,Category,Rate',
      'Y-2000,GC,GC,Overhead,0',
    ].join('\n');
    const result = yardi.parse(csv);
    expect(result.data?.[0].type).toBe('overhead');
    // rate=0 should be omitted (we treat 0 as no rate)
    expect(result.data?.[0].rate).toBeUndefined();
  });

  it('Spectrum parses', () => {
    const csv = [
      'Phase,Phase Description,Cost Center,Cost Class,Hourly Rate',
      'S-100,Iron,Steel,Labor,95',
    ].join('\n');
    const result = spectrum.parse(csv);
    expect(result.data?.[0].name).toBe('Iron');
  });

  it('respects column-map overrides', () => {
    const csv = [
      'CC,Title,Div',
      '01,Mobilize,General',
    ].join('\n');
    const result = sage100.parse(csv, {
      code: 'CC',
      name: 'Title',
      division: 'Div',
    });
    expect(result.error).toBeNull();
    expect(result.data?.[0].division).toBe('General');
  });

  it('handles quoted fields with embedded commas', () => {
    const csv = [
      'Cost Code,Description,Phase,Job Type,Unit Cost',
      '"01-100","Mobilize, demob","General","L","75.00"',
    ].join('\n');
    const result = sage100.parse(csv);
    expect(result.data?.[0].name).toBe('Mobilize, demob');
  });

  it('returns ValidationError when required columns missing', () => {
    const csv = 'Foo,Bar\n1,2';
    const result = sage100.parse(csv);
    expect(result.error?.category).toBe('ValidationError');
  });

  it('returns ValidationError on empty input', () => {
    expect(sage100.parse('').error?.category).toBe('ValidationError');
  });
});
