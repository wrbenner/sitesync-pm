/**
 * Sage 100 Contractor cost-code CSV importer.
 *
 * Sage 100 exports columns like: "Cost Code", "Description", "Job
 * Type", "Unit Cost", "Phase". The importer is column-map driven so
 * an admin can override defaults at import time.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const sage100: CostCodeImporter = {
  id: 'sage100',
  system: 'Sage 100 Contractor',
  defaultColumnMap: {
    code: 'Cost Code',
    name: 'Description',
    division: 'Phase',
    type: 'Job Type',
    rate: 'Unit Cost',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(csv, columnMap ?? sage100.defaultColumnMap, 'sage100');
  },
};
