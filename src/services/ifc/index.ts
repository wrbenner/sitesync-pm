export { loadIFCFile } from './IFCLoader'
export { SelectionHandler } from './SelectionHandler'
export { detectClashes, saveClashReport, getClashReports, resolveClash } from './ClashDetector'
export { createPhotoComparison, getPhotoComparisons, getPhotoPins, getProgressDetections } from './PhotoComparisonService'
export type { ClashResult } from './ClashDetector'
export {
  upsertElementProgress,
  getElementProgress,
  getProjectProgress,
  addRFIToElement,
  getRFIElements,
  createSafetyZone,
  getActiveSafetyZones,
  get4DSequence,
  getCrewLocations,
  reportCrewLocation,
} from './BIMDataService'
export type {
  IFCModelData,
  IFCElement,
  IFCMetadata,
  IFCLoadProgress,
  IFCLoadPhase,
  IFCCategory,
} from './types'
export { IFC_CATEGORY_MAP } from './types'
