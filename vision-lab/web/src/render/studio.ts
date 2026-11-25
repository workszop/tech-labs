// The synthetic image generator: an off-screen photo booth that renders one tin per image.
import * as THREE from 'three'
import type { Background, Lighting } from '../types'
import { buildTin, disposeTin, type TinSpec } from './tin'
import { applyLighting, buildStationSet, createRig, IMG, newInspectionCamera, placeCamera, setupRenderer, type Rig } from './rig'

export interface ViewSpec {
  lighting: Lighting
  background: Background
  /** Camera tilt in degrees above horizontal. */
  elevation: number
  /** Camera angle around the tin, degrees. */
  pan: number
  /** 0..1 strength of a hard light next to the lens. */
  glare: number
  /** A machine guard partly covers the tin. */
  occluded: boolean
  /** Framing: distance factor (1 = standard) and shift of the aim point. */
  zoom: number
  shiftX: number
  shiftY: number
  seed: number
}

export type Flaw = 'blur' | 'overexposed' | 'cutoff' | 'empty'

export class Studio {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private rig: Rig
  private cam = newInspectionCamera()
  private sets: Record<Background, THREE.Group>
  private guard: THREE.Mesh

  constructor() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = IMG
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(1); this.renderer.setSize(IMG, IMG, false)
    setupRenderer(this.renderer, this.scene)
    this.rig = createRig(this.scene)
    const plain = (ground: number, back: number, metal = 0, rough = 0.9) => {
      const g = new THREE.Group()
      const gm = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: ground, roughness: rough, metalness: metal }))
      gm.rotation.x = -Math.PI / 2; gm.receiveShadow = true
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: back, roughness: 0.95 }))
      bm.position.set(0, 3, -1.4); bm.receiveShadow = true
      g.add(gm, bm); return g
    }
    this.sets = { station: buildStationSet(), booth: plain(0xe8e5df, 0xeeebe6), steel: plain(0x8d949b, 0x4a5058, 0.9, 0.45), tray: plain(0x2c6aa3, 0xd9dde2, 0, 0.6) }
    for (const s of Object.values(this.sets)) { s.visible = false; this.scene.add(s) }
    this.guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.6, metalness: 0.3 }))
    this.guard.visible = false; this.scene.add(this.guard)
    this.scene.background = new THREE.Color(0x1a1d21)
  }

  /** Renders the scene and returns a new 224 x 224 canvas. `tin = null` gives an empty frame. */
  render(tin: TinSpec | null, view: ViewSpec, flaw?: Flaw): HTMLCanvasElement {
    for (const [k, s] of Object.entries(this.sets)) s.visible = k === view.background
    applyLighting(this.renderer, this.scene, this.rig, view.lighting, view.glare)
    let shiftX = view.shiftX, shiftY = view.shiftY
    if (flaw === 'cutoff') { shiftX += 0.55; shiftY += 0.3 }
    placeCamera(this.cam, view.elevation, view.pan, undefined, 2.55 * view.zoom, shiftX, shiftY)
    this.guard.visible = view.occluded
    if (view.occluded) {
      const side = view.seed % 2 ? 1 : -1, t = ((view.seed >> 3) % 100) / 100
      this.guard.position.set(side * (0.05 + t * 0.2), 0.75, 0.75)
      this.guard.rotation.z = side * (0.15 + t * 0.5)
    }
    const obj = tin && flaw !== 'empty' ? buildTin(tin) : null
    if (obj) this.scene.add(obj)
    this.renderer.render(this.scene, this.cam)
    if (obj) { this.scene.remove(obj); disposeTin(obj) }
    const out = document.createElement('canvas'); out.width = out.height = IMG
    const x = out.getContext('2d', { willReadFrequently: true })!
    x.drawImage(this.renderer.domElement, 0, 0)
    if (flaw === 'blur') {
      const s = document.createElement('canvas'); s.width = s.height = 20
      s.getContext('2d')!.drawImage(out, 0, 0, 20, 20)
      x.imageSmoothingEnabled = true; x.drawImage(s, 0, 0, IMG, IMG)
    }
    if (flaw === 'overexposed') {
      const d = x.getImageData(0, 0, IMG, IMG)
      for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, d.data[i + k] * 2.6 + 70)
      x.putImageData(d, 0, 0)
    }
    return out
  }
}

let studio: Studio | null = null
export const getStudio = () => (studio ??= new Studio())
