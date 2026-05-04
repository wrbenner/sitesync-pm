/**
 * Shared CSV-with-column-map parser used by every accounting-system
 * importer. Pure function — no I/O.
 */

import type {
  ColumnMap,
  ParsedCostCode,
  CostCodeType,
} from '../../../types/integrations';
import { ok, fail, validationError, type Result } from '../../../services/errors';

const TYPE_MAP: Record<string, CostCodeType> = {
  l: 'labor',
  labor: 'labor',
  lab: 'labor',
  m: 'material',
  material: 'material',
  mat: 'material',
  e: 'equipment',
  equip: 'equipment',
  equipment: 'equipment',
  s: 'sub',
  sub: 'sub',
  subcontract: 'sub',
  o: 'overhead',
  oh: 'overhead',
  overhead: 'overhead',
};

export function parseCsvWithMap(
  csv: string,
  columnMap: ColumnMap,
  systemId: string,
): Result<ParsedCostCode[]> {
  if (!csv || typeof csv !== 'string') {
    return fail(validationError('CSV content is empty'));
  }
  const rows = parseCsvRows(csv);
  if (rows.length === 0) {
    return fail(validationError('CSV has no rows'));
  }
  const header = rows[0];
  const idx = (col: string | undefined): number => {
    if (!col) return -1;
    return header.findIndex((h) => h.toLowerCase().trim() === col.toLowerCase().trim());
  };
  const codeIdx = idx(columnMap.code);
  const nameIdx = idx(columnMap.name);
  if (codeIdx < 0 || nameIdx < 0) {
    return fail(
      validationError(
        `${systemId}: required columns missing (need "${columnMap.code}" and "${columnMap.name}"). Got: ${header.join(', ')}`,
      ),
    );
  }
  const divIdx = idx(columnMap.division);
  const typeIdx = idx(columnMap.type);
  const rateIdx = idx(columnMap.rate);

  const out: ParsedCostCode[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every((c) => !c)) continue;
    const code = (row[codeIdx] ?? '').trim();
    const name = (row[nameIdx] ?? '').trim();
    if (!code) continue;
    const entry: ParsedCostCode = { code, name };
    if (divIdx >= 0) {
      const v = (row[divIdx] ?? '').trim();
      if (v) entry.division = v;
    }
    if (typeIdx >= 0) {
      const raw = (row[typeIdx] ?? '').trim().toLowerCase();
      if (raw && TYPE_MAP[raw]) entry.type = TYPE_MAP[raw];
    }
    if (rateIdx >= 0) {
      const raw = (row[rateIdx] ?? '').trim().replace(/[$,]/g, '');
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) entry.rate = n;
    }
    out.push(entry);
  }
  return ok(out);
}

/**
 * Minimal CSV row parser that handles quoted fields with embedded
 * commas and double-quote escaping.
 */
export function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\r') {
        // ignore
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 0);
}
