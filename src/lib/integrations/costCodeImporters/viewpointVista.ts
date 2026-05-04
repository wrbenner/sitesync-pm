/**
 * Viewpoint Vista cost-code importer.
 */

import type {
  CostCodeImporter,
  ColumnMap,
  ParsedCostCode,
} from '../../../types/integrations';
import { parseCsvWithMap } from './shared';
import type { Result } from '../../../services/errors';

export const viewpointVista: CostCodeImporter = {
  id: 'viewpointVista',
  system: 'Viewpoint Vista',
  defaultColumnMap: {
    code: 'PhaseCode',
    name: 'PhaseDesc',
    division: 'Department',
    type: 'CostType',
    rate: 'BillingRate',
  },
  parse(csv: string, columnMap?: ColumnMap): Result<ParsedCostCode[]> {
    return parseCsvWithMap(
      csv,
      columnMap ?? viewpointVista.defaultColumnMap,
      'viewpointVista',
    );
  },
};
