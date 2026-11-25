// Lighting, environment, inspection camera and the inspection-station set shared by the
// synthetic image studio and the production line.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Lighting } from '../types'

export const IMG = 224

export interface Rig { key: THREE.DirectionalLight; fill: THREE.DirectionalLight; hemi: THREE.HemisphereLight; glare: THREE.PointLight }

export function setupRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()
}

/** Lights aimed at `target` (the inspected tin). */
export function createRig(scene: THREE.Scene, target = new THREE.Vector3(0, 0.5, 0)): Rig {
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(target.x - 1.6, 3.2, 2.4); key.target.position.copy(target)
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0015; key.shadow.radius = 4
  const sc = key.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 3; sc.bottom = -3; sc.near = 0.5; sc.far = 12
  const fill = new THREE.DirectionalLight(0xffffff, 0.6)
  fill.position.set(target.x + 2.2, 1.6, 2.0); fill.target.position.copy(target)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x30343a, 0.5)
  const glare = new THREE.PointLight(0xffffff, 0, 8, 2)
  glare.position.set(target.x + 0.25, 1.25, 2.1)
  scene.add(key, key.target, fill, fill.target, hemi, glare)
  return { key, fill, hemi, glare }
}

const PRESETS: Record<Lighting, { env: number; key: number; keyColor: number; fill: number; hemi: number; exposure: number; glare: number }> = {
  normal: { env: 1.0, key: 2.2, keyColor: 0xffffff, fill: 0.6, hemi: 0.5, exposure: 1.0, glare: 0 },
  dim: { env: 0.16, key: 0.32, keyColor: 0xdfe6ff, fill: 0.06, hemi: 0.08, exposure: 0.8, glare: 0 },
  warm: { env: 0.7, key: 2.4, keyColor: 0xff9a4a, fill: 0.5, hemi: 0.3, exposure: 0.95, glare: 0 },
  harsh: { env: 1.4, key: 3.6, keyColor: 0xffffff, fill: 0.2, hemi: 0.5, exposure: 1.08, glare: 6 },
}

/** `glare` (0..1) adds a hard light next to the lens: specular streaks on the metal. */
export function applyLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene, rig: Rig, lighting: Lighting, glare = 0) {
  const p = PRESETS[lighting]
  scene.environmentIntensity = p.env * (1 + glare * 0.8)
  rig.key.intensity = p.key; rig.key.color.setHex(p.keyColor)
  rig.fill.intensity = p.fill; rig.fill.color.setHex(lighting === 'warm' ? 0xffc890 : 0xffffff)
  rig.hemi.intensity = p.hemi
  rig.glare.intensity = p.glare + glare * 26
  renderer.toneMappingExposure = p.exposure * (1 + glare * 0.25)
}

/** The inspection camera: looks at the tin from the operator side of the belt, tilted down by `elevation` degrees. */
export function placeCamera(cam: THREE.PerspectiveCamera, elevation: number, pan: number, target = new THREE.Vector3(0, 0.5, 0), distance = 2.55, shiftX = 0, shiftY = 0) {
  const e = THREE.MathUtils.degToRad(elevation), a = THREE.MathUtils.degToRad(pan)
  cam.position.set(target.x + distance * Math.sin(a) * Math.cos(e), target.y + distance * Math.sin(e), target.z + distance * Math.cos(a) * Math.cos(e))
  cam.lookAt(target.x + shiftX, target.y + shiftY, target.z)
  cam.updateMatrixWorld()
}
export const newInspectionCamera = () => new THREE.PerspectiveCamera(28, 1, 0.2, 30)

export const BELT_COLOR = 0x23282d
/** Belt strip and light backboard as seen by the inspection camera. Centred on x = 0. */
export function buildStationSet(length = 6, boardWidth = 3.4, rails = true): THREE.Group {
  const g = new THREE.Group()
  const belt = new THREE.Mesh(new THREE.BoxGeometry(length, 0.06, 1.0), new THREE.MeshStandardMaterial({ color: BELT_COLOR, roughness: 0.92, metalness: 0 }))
  belt.position.y = -0.03; belt.receiveShadow = true; belt.name = 'belt'
  const board = new THREE.Mesh(new THREE.BoxGeometry(boardWidth, 1.9, 0.04), new THREE.MeshStandardMaterial({ color: 0xdcd9d3, roughness: 0.95, metalness: 0 }))
  board.position.set(0, 0.9, -0.62); board.receiveShadow = true
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.4, metalness: 1 })
  for (const z of rails ? [-0.53, 0.53] : []) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.04), railMat)
    rail.position.set(0, 0.05, z); rail.castShadow = true; g.add(rail)
  }
  g.add(belt, board)
  return g
}
