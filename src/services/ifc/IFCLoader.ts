// IFC Loader Service: Parses IFC files using web-ifc WASM engine,
// extracts geometry as Three.js meshes, and builds an element property map.
//
// Uses web-ifc directly (not web-ifc-three) for maximum control over
// geometry generation, progressive loading, and memory management.

import * as THREE from 'three'
import * as WebIFC from 'web-ifc'
import type { IFCModelData, IFCElement, IFCLoadProgress, IFCMetadata } from './types'
import { IFC_CATEGORY_MAP } from './types'

// ── WASM path (served from public/) ──────────────────────

const WASM_PATH = '/wasm/'

// ── Color palette per category ───────────────────────────

const CATEGORY_COLORS: Record<string, number> = {
  structural: 0xcccccc,
  architectural: 0xe8e0d8,
  mep: 0x4ec896,
  openings: 0x88ccff,
  circulation: 0xddddaa,
  furniture: 0xc4850c,
  site: 0x8fbc8f,
  other: 0xaaaaaa,
}

// ── Main Loader ──────────────────────────────────────────

export async function loadIFCFile(
  fileData: ArrayBuffer,
  fileName: string,
  onProgress: (update: IFCLoadProgress) => void,
): Promise<IFCModelData> {
  const startTime = performance.now()

  onProgress({ phase: 'initializing', progress: 5, trianglesLoaded: 0, message: 'Initializing IFC engine...' })

  // Initialize web-ifc
  const ifcApi = new WebIFC.IfcAPI()
  ifcApi.SetWasmPath(WASM_PATH)
  await ifcApi.Init()

  onProgress({ phase: 'parsing', progress: 15, trianglesLoaded: 0, message: 'Parsing IFC structure...' })

  // Open the model
  const modelId = ifcApi.OpenModel(new Uint8Array(fileData))

  // Extract metadata
  const schema = ifcApi.GetModelSchema(modelId) || 'IFC4'

  onProgress({ phase: 'geometry', progress: 30, trianglesLoaded: 0, message: 'Generating geometry...' })

  // Get all geometry
  const meshes: THREE.Mesh[] = []
  const elements = new Map<number, IFCElement>()
  let totalTriangles = 0

  // Load all meshes via FlatMesh API
  ifcApi.StreamAllMeshes(modelId, (flatMesh: WebIFC.FlatMesh) => {
    const expressId = flatMesh.expressID

    for (let i = 0; i < flatMesh.geometries.size(); i++) {
      const placedGeom = flatMesh.geometries.get(i)
      const geomData = ifcApi.GetGeometry(modelId, placedGeom.geometryExpressID)

      const verts = ifcApi.GetVertexArray(geomData.GetVertexData(), geomData.GetVertexDataSize())
      const indices = ifcApi.GetIndexArray(geomData.GetIndexData(), geomData.GetIndexDataSize())

      if (verts.length === 0 || indices.length === 0) continue

      // Build Three.js geometry
      const positions = new Float32Array(verts.length / 2) // xyz only, skip normals
      const normals = new Float32Array(verts.length / 2)

      for (let v = 0; v < verts.length; v += 6) {
        const idx = v / 6
        positions[idx * 3] = verts[v]
        positions[idx * 3 + 1] = verts[v + 1]
        positions[idx * 3 + 2] = verts[v + 2]
        normals[idx * 3] = verts[v + 3]
        normals[idx * 3 + 1] = verts[v + 4]
        normals[idx * 3 + 2] = verts[v + 5]
      }

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
      geometry.setIndex(Array.from(indices))

      // Determine category for coloring
      const ifcType = getIFCType(ifcApi, modelId, expressId)
      const category = IFC_CATEGORY_MAP[ifcType] || 'other'
      const color = CATEGORY_COLORS[category] || 0xaaaaaa

      const material = new THREE.MeshPhongMaterial({
        color,
        side: THREE.DoubleSide,
        flatShading: false,
      })

      const mesh = new THREE.Mesh(geometry, material)

      // Apply placement transform
      const matrix = new THREE.Matrix4()
      matrix.fromArray(placedGeom.flatTransformation)
      mesh.applyMatrix4(matrix)

      mesh.userData.expressId = expressId
      mesh.userData.ifcType = ifcType
      mesh.userData.category = category

      meshes.push(mesh)
      totalTriangles += indices.length / 3

      // Clean up geometry data
      geomData.delete()
    }
  })

  onProgress({
    phase: 'materials',
    progress: 70,
    trianglesLoaded: totalTriangles,
    message: `Processing ${totalTriangles.toLocaleString()} triangles...`,
  })

  // Build element property map for the main structural types
  const typeIds = [
    WebIFC.IFCWALL, WebIFC.IFCWALLSTANDARDCASE,
    WebIFC.IFCSLAB, WebIFC.IFCCOLUMN, WebIFC.IFCBEAM,
    WebIFC.IFCDOOR, WebIFC.IFCWINDOW,
    WebIFC.IFCSTAIR, WebIFC.IFCSTAIRFLIGHT,
    WebIFC.IFCROOF,
  ]

  for (const typeId of typeIds) {
    const ids = ifcApi.GetLineIDsWithType(modelId, typeId)
    for (let i = 0; i < ids.size(); i++) {
      const eid = ids.get(i)
      try {
        const props = ifcApi.GetLine(modelId, eid)
        const ifcType = getIFCType(ifcApi, modelId, eid)
        elements.set(eid, {
          expressId: eid,
          globalId: props.GlobalId?.value || '',
          name: props.Name?.value || `${ifcType} #${eid}`,
          ifcType,
          category: IFC_CATEGORY_MAP[ifcType] || 'other',
          properties: flattenProps(props),
        })
      } catch {
        // Some elements may not have standard properties
      }
    }
  }

  onProgress({
    phase: 'complete',
    progress: 100,
    trianglesLoaded: totalTriangles,
    message: 'Model loaded successfully',
  })

  const loadTimeMs = performance.now() - startTime

  // Clean up WASM memory
  ifcApi.CloseModel(modelId)

  const metadata: IFCMetadata = {
    projectName: fileName.replace(/\.ifc$/i, ''),
    fileName,
    schema: String(schema),
    totalElements: elements.size,
    totalTriangles: totalTriangles,
    loadTimeMs: Math.round(loadTimeMs),
  }

  return { meshes, metadata, elements }
}

// ── Helpers ──────────────────────────────────────────────

function getIFCType(api: WebIFC.IfcAPI, modelId: number, expressId: number): string {
  try {
    const line = api.GetLine(modelId, expressId)
    return line?.constructor?.name?.replace('IFC', 'IFC') || 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

function flattenProps(obj: Record<string, unknown>): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'type' || key === 'expressID') continue
    if (val === null || val === undefined) continue
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
      result[key] = val
    } else if (typeof val === 'object' && 'value' in (val as Record<string, unknown>)) {
      const v = (val as Record<string, unknown>).value
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        result[key] = v
      }
    }
  }
  return result
}
