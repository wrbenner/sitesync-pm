/**
 * Cost-code importer registry. The admin UI consumes IMPORTERS for
 * the system dropdown, then calls `getImporter(id).parse(csv)` with
 * an optional column-map override.
 */

import type { CostCodeImporter } from '../../../types/integrations';
import { sage100 } from './sage100';
import { sage300 } from './sage300';
import { viewpointVista } from './viewpointVista';
import { foundation } from './foundation';
import { yardi } from './yardi';
import { spectrum } from './spectrum';

export const IMPORTERS: CostCodeImporter[] = [
  sage100,
  sage300,
  viewpointVista,
  foundation,
  yardi,
  spectrum,
];

export function getImporter(systemId: string): CostCodeImporter | undefined {
  return IMPORTERS.find((i) => i.id === systemId);
}

export {
  sage100,
  sage300,
  viewpointVista,
  foundation,
  yardi,
  spectrum,
};

export type { CostCodeImporter, ColumnMap, ParsedCostCode } from '../../../types/integrations';
