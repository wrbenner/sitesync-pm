/**
 * Foundation Software cost-code importer.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const foundation: CostCodeImporter = {
  id: 'foundation',
  system: 'Foundation Software',
  defaultColumnMap: {
    code: 'CC Code',
    name: 'CC Name',
    division: 'Division',
    type: 'Type',
    rate: 'Std Rate',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(csv, columnMap ?? foundation.defaultColumnMap, 'foundation');
  },
};
