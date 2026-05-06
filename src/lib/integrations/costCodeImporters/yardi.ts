/**
 * Yardi cost-code importer.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const yardi: CostCodeImporter = {
  id: 'yardi',
  system: 'Yardi Construction',
  defaultColumnMap: {
    code: 'Account',
    name: 'Account Name',
    division: 'Group',
    type: 'Category',
    rate: 'Rate',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(csv, columnMap ?? yardi.defaultColumnMap, 'yardi');
  },
};
