// IFC loader service — parses .ifc buffers into Three.js meshes using web-ifc WASM.
// Consumed by src/hooks/useIFCModel.ts.

import * as THREE from 'three'
import { IfcAPI } from 'web-ifc'

export interface IFCLoadProgress {
  phase: 'initializing' | 'parsing' | 'geometry' | 'complete' | 'error'
  progress: number // 0 – 1
  trianglesLoaded: number
  message: string
}

export interface IFCModelData {
  meshes: THREE.Mesh[]
  root: THREE.Group
  triangleCount: number
}

let apiInstance: IfcAPI | null = null
let initPromise: Promise<IfcAPI> | null = null

async function getAPI(): Promise<IfcAPI> {
  if (apiInstance) return apiInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const api = new IfcAPI()
    // Vite's base is '/sitesync-pm/' locally and '/' on Vercel — respect it so we find the WASM.
    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`
    api.SetWasmPath(`${base}wasm/`)
    await api.Init(undefined, true) // forceSingleThread — simpler, no worker setup
    apiInstance = api
    return api
  })()
  return initPromise
}

function bufferGeometryFromPlaced(
  api: IfcAPI,
  modelID: number,
  geometryExpressID: number,
  flatTransformation: number[],
): { geometry: THREE.BufferGeometry; triangles: number } {
  const geom = api.GetGeometry(modelID, geometryExpressID)
  const verts = api.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize())
  const idx = api.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize())

  // verts layout: 6 floats per vertex (px, py, pz, nx, ny, nz)
  const vertexCount = verts.length / 6
  const positions = new Float32Array(vertexCount * 3)
  const normals = new Float32Array(vertexCount * 3)
  for (let i = 0; i < vertexCount; i++) {
    const src = i * 6
    const dst = i * 3
    positions[dst] = verts[src]
    positions[dst + 1] = verts[src + 1]
    positions[dst + 2] = verts[src + 2]
    normals[dst] = verts[src + 3]
    normals[dst + 1] = verts[src + 4]
    normals[dst + 2] = verts[src + 5]
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(idx, 1))

  // Bake IFC's column-major 4x4 placement into the geometry.
  const matrix = new THREE.Matrix4().fromArray(flatTransformation)
  geometry.applyMatrix4(matrix)

  geom.delete()
  return { geometry, triangles: idx.length / 3 }
}

export async function loadIFCFile(
  buffer: ArrayBuffer,
  _filename: string,
  onProgress: (p: IFCLoadProgress) => void,
): Promise<IFCModelData> {
  onProgress({ phase: 'initializing', progress: 0.05, trianglesLoaded: 0, message: 'Loading web-ifc…' })
  const api = await getAPI()

  onProgress({ phase: 'parsing', progress: 0.15, trianglesLoaded: 0, message: 'Parsing IFC…' })
  const modelID = api.OpenModel(new Uint8Array(buffer))
  if (modelID < 0) throw new Error('Failed to open IFC model')

  try {
    onProgress({ phase: 'geometry', progress: 0.25, trianglesLoaded: 0, message: 'Building geometry…' })

    // Group materials by color to reduce draw calls — IFC can produce thousands of tiny meshes.
    const materialCache = new Map<string, THREE.MeshStandardMaterial>()
    const getMaterial = (c: { x: number; y: number; z: number; w: number }) => {
      const key = `${c.x.toFixed(3)}|${c.y.toFixed(3)}|${c.z.toFixed(3)}|${c.w.toFixed(3)}`
      let mat = materialCache.get(key)
      if (!mat) {
        mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(c.x, c.y, c.z),
          opacity: c.w,
          transparent: c.w < 1,
          metalness: 0.05,
          roughness: 0.7,
          side: THREE.DoubleSide,
        })
        materialCache.set(key, mat)
      }
      return mat
    }

    const meshes: THREE.Mesh[] = []
    let triangles = 0
    let meshIndex = 0

    api.StreamAllMeshes(modelID, (flatMesh, _idx, total) => {
      const placed = flatMesh.geometries
      for (let i = 0; i < placed.size(); i++) {
        const p = placed.get(i)
        const { geometry, triangles: tris } = bufferGeometryFromPlaced(
          api,
          modelID,
          p.geometryExpressID,
          p.flatTransformation,
        )
        const mesh = new THREE.Mesh(geometry, getMaterial(p.color))
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.expressID = flatMesh.expressID
        meshes.push(mesh)
        triangles += tris
      }
      flatMesh.delete()

      meshIndex++
      if (meshIndex % 50 === 0) {
        onProgress({
          phase: 'geometry',
          progress: 0.25 + (0.7 * meshIndex) / Math.max(total, 1),
          trianglesLoaded: triangles,
          message: `Building geometry… ${meshIndex} / ${total}`,
        })
      }
    })

    // IFC is Z-up; Three.js scene is Y-up. Rotate the root group so the model stands upright.
    const root = new THREE.Group()
    root.rotation.x = -Math.PI / 2
    for (const mesh of meshes) root.add(mesh)

    onProgress({ phase: 'complete', progress: 1, trianglesLoaded: triangles, message: `Loaded ${meshes.length} elements` })

    return { meshes, root, triangleCount: triangles }
  } finally {
    api.CloseModel(modelID)
  }
}
