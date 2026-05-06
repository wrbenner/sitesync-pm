/**
 * Spectrum (Dexter+Chaney) cost-code importer.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const spectrum: CostCodeImporter = {
  id: 'spectrum',
  system: 'Spectrum',
  defaultColumnMap: {
    code: 'Phase',
    name: 'Phase Description',
    division: 'Cost Center',
    type: 'Cost Class',
    rate: 'Hourly Rate',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(csv, columnMap ?? spectrum.defaultColumnMap, 'spectrum');
  },
};
