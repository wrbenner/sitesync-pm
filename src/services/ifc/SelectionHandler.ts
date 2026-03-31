// Selection Handler: Manages element selection, highlighting, and outline
// effects in the BIM viewer. Uses orange brand color for selection.

import * as THREE from 'three'
import { colors } from '../../styles/theme'

const HIGHLIGHT_COLOR = new THREE.Color(colors.primaryOrange)
const HIGHLIGHT_EMISSIVE = new THREE.Color(0xff6600)

export class SelectionHandler {
  private selected = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>()
  private highlightMat: THREE.MeshPhongMaterial

  constructor() {
    this.highlightMat = new THREE.MeshPhongMaterial({
      color: HIGHLIGHT_COLOR,
      emissive: HIGHLIGHT_EMISSIVE,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  }

  select(mesh: THREE.Mesh): void {
    if (this.selected.has(mesh)) return

    // Store original material
    this.selected.set(mesh, mesh.material)

    // Apply highlight
    mesh.material = this.highlightMat

    // Add edge outline
    const edges = new THREE.EdgesGeometry(mesh.geometry)
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: HIGHLIGHT_COLOR, linewidth: 1 }),
    )
    outline.name = '__selection_outline__'
    mesh.add(outline)
  }

  deselect(mesh: THREE.Mesh): void {
    const original = this.selected.get(mesh)
    if (!original) return

    mesh.material = original

    // Remove outline
    const outline = mesh.children.find((c) => c.name === '__selection_outline__')
    if (outline) {
      mesh.remove(outline)
      ;(outline as THREE.LineSegments).geometry.dispose()
      ;((outline as THREE.LineSegments).material as THREE.Material).dispose()
    }

    this.selected.delete(mesh)
  }

  deselectAll(): void {
    for (const [mesh] of this.selected) {
      this.deselect(mesh as THREE.Mesh)
    }
  }

  isSelected(mesh: THREE.Object3D): boolean {
    return this.selected.has(mesh)
  }

  dispose(): void {
    this.deselectAll()
    this.highlightMat.dispose()
  }
}
