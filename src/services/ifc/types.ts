// IFC service types for the BIM viewer pipeline.

import type * as THREE from 'three'

// ── Load Progress ────────────────────────────────────────

export type IFCLoadPhase = 'initializing' | 'parsing' | 'geometry' | 'materials' | 'complete' | 'error'

export interface IFCLoadProgress {
  phase: IFCLoadPhase
  progress: number // 0-100
  trianglesLoaded: number
  message: string
}

// ── Parsed Model ─────────────────────────────────────────

export interface IFCModelData {
  meshes: THREE.Mesh[]
  metadata: IFCMetadata
  elements: Map<number, IFCElement>
}

export interface IFCMetadata {
  projectName: string
  fileName: string
  schema: string
  totalElements: number
  totalTriangles: number
  loadTimeMs: number
}

export interface IFCElement {
  expressId: number
  globalId: string
  name: string
  ifcType: string
  category: IFCCategory
  properties: Record<string, string | number | boolean>
}

export type IFCCategory =
  | 'structural'
  | 'architectural'
  | 'mep'
  | 'openings'
  | 'circulation'
  | 'furniture'
  | 'site'
  | 'other'

// ── IFC Type → Category Mapping ──────────────────────────

export const IFC_CATEGORY_MAP: Record<string, IFCCategory> = {
  IFCWALL: 'structural',
  IFCWALLSTANDARDCASE: 'structural',
  IFCSLAB: 'structural',
  IFCCOLUMN: 'structural',
  IFCBEAM: 'structural',
  IFCFOOTINGG: 'structural',
  IFCROOF: 'architectural',
  IFCCOVERING: 'architectural',
  IFCCURTAINWALL: 'architectural',
  IFCPLATE: 'architectural',
  IFCDOOR: 'openings',
  IFCWINDOW: 'openings',
  IFCOPENINGELEMENT: 'openings',
  IFCSTAIR: 'circulation',
  IFCSTAIRFLIGHT: 'circulation',
  IFCRAMP: 'circulation',
  IFCRAMPFLIGHT: 'circulation',
  IFCFURNISHINGELEMENT: 'furniture',
  IFCFURNITURE: 'furniture',
  IFCFLOWSEGMENT: 'mep',
  IFCFLOWTERMINAL: 'mep',
  IFCFLOWFITTING: 'mep',
  IFCFLOWCONTROLLER: 'mep',
  IFCFLOWMOVINGDEVICE: 'mep',
  IFCFLOWSTORAGEDEVICE: 'mep',
  IFCFLOWTREATMENTDEVICE: 'mep',
  IFCDISTRIBUTIONELEMENT: 'mep',
  IFCSITE: 'site',
  IFCBUILDING: 'site',
  IFCBUILDINGSTOREY: 'site',
}
