/**
 * Sage 300 Construction (Timberline) importer.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const sage300: CostCodeImporter = {
  id: 'sage300',
  system: 'Sage 300 Construction',
  defaultColumnMap: {
    code: 'Standard Cost Code',
    name: 'Description',
    division: 'CSI Division',
    type: 'Cost Category',
    rate: 'Standard Rate',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(csv, columnMap ?? sage300.defaultColumnMap, 'sage300');
  },
};
