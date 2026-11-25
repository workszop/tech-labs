// The 3D production line: conveyor, inspection station with camera, AI unit, pneumatic rejector,
// manual-inspection diverter and collection bins.
//
// Separation of concerns that the lab depends on: the scene hands the *rendered camera image*
// to `onCapture` and nothing else. The defect each tin was built with is only reported later,
// in `onOutcome`, so that the result can be scored.
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { ClassId, Design, Lighting } from '../types'
import { CLASSES } from '../types'
import { rng } from '../rng'
import { buildTin, disposeTin, type TinSpec } from './tin'
import { applyLighting, buildStationSet, createRig, IMG, newInspectionCamera, placeCamera, setupRenderer, type Rig } from './rig'

export type Decision = 'accept' | 'reject' | 'review'
export type Actuation = 'accepted' | 'rejected' | 'review' | 'uninspected'
export interface Outcome { id: number; truth: ClassId; actuation: Actuation }
export interface LineParams { running: boolean; speed: number; defectRate: number; lighting: Lighting; elevation: number; pan: number; designs: Design[]; yawJitter: number; human: boolean }

const SPACING = 1.3, X0 = -7, X_END = 7, X_REJECT = 2.0, X_REVIEW = 3.8

interface Tin { id: number; obj: THREE.Group; spec: TinSpec; x: number; y: number; z: number; vy: number; phase: 'belt' | 'push-' | 'push+' | 'fall' | 'table'; decision: Decision | null; captured: boolean; locked: boolean; spin: number }

const std = (color: number, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m
}

export class LineScene {
  onCapture: ((image: HTMLCanvasElement, id: number) => void) | null = null
  onOutcome: ((o: Outcome) => void) | null = null
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private rig: Rig
  private view = new THREE.PerspectiveCamera(36, 1, 0.1, 80)
  private controls: OrbitControls
  private inspect = newInspectionCamera()
  private housing = new THREE.Group()
  private ringLight: THREE.MeshStandardMaterial
  private lamps: Record<Decision, THREE.MeshStandardMaterial>
  private leds: THREE.MeshStandardMaterial[] = []
  private screen: THREE.MeshStandardMaterial
  private pushers: { reject: THREE.Mesh; review: THREE.Mesh }
  private pushT = { reject: 0, review: 0 }
  private tins: Tin[] = []
  private nextId = 1
  private sinceSpawn = SPACING
  private random = rng(Date.now() & 0xffff)
  private raf = 0
  private last = 0
  private flash = 0
  private busy = 0
  private ro: ResizeObserver
  private params: LineParams
  private frame = document.createElement('canvas')

  constructor(private canvas: HTMLCanvasElement, params: LineParams) {
    this.params = { ...params }
    this.frame.width = this.frame.height = IMG
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(1)
    setupRenderer(this.renderer, this.scene)
    this.scene.background = new THREE.Color(0x14171a)
    this.scene.fog = new THREE.Fog(0x14171a, 16, 34)
    this.rig = createRig(this.scene)

    // hall
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), std(0x33383e, 0.85))
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; this.scene.add(floor)
    const wall = box(60, 9, 0.2, std(0x262b31, 0.9), 0, 3.5, -5, this.scene, false)
    wall.receiveShadow = false
    box(60, 0.12, 0.22, std(0xd9a514, 0.6), 0, 0.2, -4.95, this.scene, false) // safety stripe
    for (const z of [-0.9, 0.9]) box(16.5, 0.05, 0.12, std(0xd9a514, 0.7), 0, -0.99, z * 2.2, this.scene, false)

    // conveyor
    this.scene.add(buildStationSet(X_END - X0, 2.4, false))
    const frameMat = std(0x8f979e, 0.35, 1), dark = std(0x1c2024, 0.6, 0.4)
    box(X_END - X0 + 0.3, 0.16, 1.16, frameMat, 0, -0.14, 0, this.scene)
    for (let x = X0 + 0.6; x <= X_END - 0.4; x += 2.6) for (const z of [-0.5, 0.5]) box(0.09, 0.8, 0.09, frameMat, x, -0.6, z, this.scene)
    for (const x of [X0, X_END]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 24), dark); r.rotation.x = Math.PI / 2; r.position.set(x, -0.06, 0); this.scene.add(r) }
    const rail = (x0: number, x1: number, z: number) => box(x1 - x0, 0.05, 0.04, frameMat, (x0 + x1) / 2, 0.05, z, this.scene)
    rail(X0, X_REJECT - 0.45, -0.53); rail(X_REJECT + 0.45, X_END, -0.53)
    rail(X0, X_REVIEW - 0.45, 0.53); rail(X_REVIEW + 0.45, X_END, 0.53)

    // inspection station: hood posts, lamp tower, camera on its stand
    for (const x of [-1.25, 1.25]) box(0.08, 2.1, 0.08, frameMat, x, 0.9, -0.66, this.scene)
    box(2.58, 0.08, 0.5, frameMat, 0, 1.92, -0.45, this.scene)
    const lamp = (c: number, y: number) => { const m = new THREE.MeshStandardMaterial({ color: 0x15181b, emissive: c, emissiveIntensity: 0.08, roughness: 0.4 }); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.13, 20), m); s.position.set(1.25, y, -0.66); this.scene.add(s); return m }
    this.lamps = { reject: lamp(0xff3b30, 2.42), review: lamp(0xffb020, 2.27), accept: lamp(0x2fd16b, 2.12) }
    box(0.07, 3.6, 0.07, dark, 0, 0.8, 3.05, this.scene)
    box(0.5, 0.05, 0.5, dark, 0, -0.97, 3.05, this.scene)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.4), std(0x2a5d9c, 0.45, 0.3)); body.position.z = 0.24; body.castShadow = true
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.16, 24), std(0x0c0e10, 0.3, 0.8)); lens.rotation.x = Math.PI / 2; lens.position.z = -0.02
    this.ringLight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 10, 32), this.ringLight); ring.position.z = -0.06
    this.housing.add(body, lens, ring); this.scene.add(this.housing)

    // AI processing unit
    const cab = new THREE.Group(); cab.position.set(-2.3, 0, -1.7); this.scene.add(cab)
    box(0.95, 1.9, 0.6, std(0x2b3036, 0.5, 0.5), 0, -0.05, 0, cab)
    this.screen = new THREE.MeshStandardMaterial({ color: 0x05080a, emissive: 0x1f8fff, emissiveIntensity: 0.35 })
    box(0.62, 0.36, 0.02, this.screen, 0, 0.5, 0.31, cab, false)
    for (let i = 0; i < 6; i++) { const m = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, emissive: 0x2fd16b, emissiveIntensity: 0.2 }); box(0.06, 0.03, 0.02, m, -0.28 + i * 0.11, 0.1, 0.31, cab, false); this.leds.push(m) }
    for (let i = 0; i < 5; i++) box(0.7, 0.012, 0.02, std(0x15181b), 0, -0.25 - i * 0.09, 0.31, cab, false)

    // rejector (pushes away from the operator) and manual-inspection diverter (pushes towards the operator)
    const pusher = (x: number, side: number, color: number) => {
      box(0.5, 0.5, 0.42, std(0x3a4047, 0.5, 0.6), x, 0.0, side * 1.25, this.scene)
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 16), frameMat); cyl.rotation.x = Math.PI / 2; cyl.position.set(x, 0.4, side * 1.0); this.scene.add(cyl)
      box(0.5, 0.06, 0.42, std(color, 0.5), x, 0.28, side * 1.25, this.scene, false)
      return box(0.5, 0.6, 0.05, std(color, 0.5, 0.2), x, 0.4, side * 0.7, this.scene)
    }
    this.pushers = { reject: pusher(X_REJECT, 1, 0xc0392b), review: pusher(X_REVIEW, -1, 0xd98e14) }
    const bin = (x: number, z: number, color: number, w = 1.2, d = 1.0) => {
      const m = std(color, 0.7, 0.1)
      box(w, 0.04, d, m, x, -0.98, z, this.scene); box(w, 0.6, 0.04, m, x, -0.7, z - d / 2, this.scene); box(w, 0.6, 0.04, m, x, -0.7, z + d / 2, this.scene)
      box(0.04, 0.6, d, m, x - w / 2, -0.7, z, this.scene); box(0.04, 0.6, d, m, x + w / 2, -0.7, z, this.scene)
    }
    bin(X_REJECT, -1.35, 0x8e2a22)
    bin(X_END + 0.8, 0, 0x1f7a45, 1.2, 1.2)
    box(1.3, 0.06, 1.0, std(0x6b727a, 0.5, 0.6), X_REVIEW, -0.03, 1.2, this.scene) // manual inspection table
    for (const dx of [-0.55, 0.55]) for (const dz of [0.8, 1.6]) box(0.06, 0.95, 0.06, frameMat, X_REVIEW + dx, -0.52, dz, this.scene)
    box(1.3, 0.2, 0.04, std(0xd98e14, 0.6), X_REVIEW, 0.08, 1.7, this.scene, false)

    this.view.position.set(3.4, 3.6, 10.6)
    this.controls = new OrbitControls(this.view, canvas)
    this.controls.target.set(0.9, 0.1, 0); this.controls.enablePan = false; this.controls.enableDamping = true
    this.controls.minDistance = 4; this.controls.maxDistance = 16; this.controls.maxPolarAngle = Math.PI / 2.05; this.controls.minAzimuthAngle = -1.1; this.controls.maxAzimuthAngle = 1.1
    this.controls.update()

    this.apply()
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas)
    this.resize()
    // a short run-in so the belt is not empty at the start
    for (let x = X0; x < -SPACING * 0.5; x += SPACING) this.spawn(x)
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  set(p: Partial<LineParams>) { Object.assign(this.params, p); this.apply() }

  /** The verdict for a captured tin. Ignored when the tin has already passed the rejector. */
  decide(id: number, d: Decision) {
    this.busy = Math.max(0, this.busy - 1)
    const t = this.tins.find((q) => q.id === id)
    if (!t || t.locked) return
    t.decision = d === 'review' && !this.params.human ? 'accept' : d
    for (const k of Object.keys(this.lamps) as Decision[]) this.lamps[k].emissiveIntensity = k === t.decision ? 2.4 : 0.08
    this.screen.emissive.setHex(t.decision === 'reject' ? 0xff3b30 : t.decision === 'review' ? 0xffb020 : 0x2fd16b)
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose()
    for (const t of this.tins) disposeTin(t.obj)
    this.tins = []
    this.renderer.dispose()
  }

  private apply() {
    applyLighting(this.renderer, this.scene, this.rig, this.params.lighting)
    placeCamera(this.inspect, this.params.elevation, this.params.pan)
    this.housing.position.copy(this.inspect.position)
    this.housing.lookAt(0, 0.5, 0); this.housing.rotateY(Math.PI)
  }

  private resize() {
    const pr = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(IMG, Math.round(this.canvas.clientWidth * pr)), h = Math.max(IMG, Math.round(this.canvas.clientHeight * pr))
    this.renderer.setSize(w, h, false)
    this.view.aspect = w / h; this.view.updateProjectionMatrix()
  }

  private spawn(x: number) {
    const r = this.random, p = this.params
    const defective = r.chance(p.defectRate / 100)
    const spec: TinSpec = {
      seed: r.int(1, 1e9), design: r.pick(p.designs.length ? p.designs : ['szprot'] as Design[]),
      defect: defective ? r.pick(CLASSES.slice(1)) : 'good', severity: r.range(0.4, 1), yaw: r.range(-1, 1) * p.yawJitter,
    }
    const obj = buildTin(spec); obj.position.set(x, 0, 0); this.scene.add(obj)
    this.tins.push({ id: this.nextId++, obj, spec, x, y: 0, z: 0, vy: 0, phase: 'belt', decision: null, captured: false, locked: false, spin: 0 })
  }

  private out(t: Tin, actuation: Actuation) { this.onOutcome?.({ id: t.id, truth: t.spec.defect, actuation }) }

  private capture(t: Tin) {
    t.captured = true
    const keep = t.obj.position.x
    t.obj.position.x = 0 // the trigger sensor fires the strobe when the tin is centred
    const size = new THREE.Vector2(); this.renderer.getSize(size)
    this.housing.visible = false
    this.renderer.setViewport(0, 0, IMG, IMG); this.renderer.setScissor(0, 0, IMG, IMG); this.renderer.setScissorTest(true)
    this.renderer.render(this.scene, this.inspect)
    this.frame.getContext('2d')!.drawImage(this.canvas, 0, size.y - IMG, IMG, IMG, 0, 0, IMG, IMG)
    this.renderer.setScissorTest(false); this.renderer.setViewport(0, 0, size.x, size.y)
    this.housing.visible = true
    t.obj.position.x = keep
    this.flash = 1; this.busy++
    const copy = document.createElement('canvas'); copy.width = copy.height = IMG
    copy.getContext('2d')!.drawImage(this.frame, 0, 0)
    this.onCapture!(copy, t.id)
  }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick)
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now
    const p = this.params
    const v = p.running ? (p.speed / 60) * SPACING : 0
    if (p.running) {
      this.sinceSpawn += v * dt
      if (this.sinceSpawn >= SPACING) { this.sinceSpawn -= SPACING; this.spawn(X0) }
    }
    for (const k of ['reject', 'review'] as const) {
      this.pushT[k] = Math.max(0, this.pushT[k] - dt * 3.5)
      const side = k === 'reject' ? 1 : -1, ext = Math.sin(Math.min(1, this.pushT[k]) * Math.PI) * 0.75
      this.pushers[k].position.z = side * (0.7 - ext)
    }
    const alive: Tin[] = []
    for (const t of this.tins) {
      if (t.phase === 'belt') {
        const before = t.x; t.x += v * dt
        if (!t.captured && before < 0 && t.x >= 0 && this.onCapture) this.capture(t)
        if (before < X_REJECT && t.x >= X_REJECT) {
          if (this.onCapture && t.captured && t.decision === null) { t.locked = true; this.out(t, 'uninspected') }
          else if (t.decision === 'reject') { t.locked = true; t.phase = 'push-'; this.pushT.reject = 1; this.out(t, 'rejected') }
          else t.locked = true
        }
        if (t.phase === 'belt' && before < X_REVIEW && t.x >= X_REVIEW && t.decision === 'review') { t.phase = 'push+'; this.pushT.review = 1; this.out(t, 'review') }
        if (t.phase === 'belt' && t.x >= X_END) { t.phase = 'fall'; if (t.decision !== null) this.out(t, 'accepted') }
      } else if (t.phase === 'push-') {
        t.z -= 4.2 * dt; if (t.z < -0.95) t.phase = 'fall'
      } else if (t.phase === 'push+') {
        t.z += 3.6 * dt; if (t.z > 1.15) { t.phase = 'table'; t.spin = 2.5 }
      } else if (t.phase === 'fall') {
        t.vy -= 9.8 * dt; t.y += t.vy * dt; t.spin += dt * 3
        if (t.z === 0) t.x += Math.max(v, 0.8) * dt; else t.z -= 1.2 * dt
        t.obj.rotation.z = -t.spin * (t.z === 0 ? 1 : 0); t.obj.rotation.x = -t.spin * (t.z === 0 ? 0 : 1)
      } else if (t.phase === 'table') {
        t.spin -= dt; if (t.spin <= 0) t.y = -99
      }
      if (t.y < -0.95) { this.scene.remove(t.obj); disposeTin(t.obj); continue }
      t.obj.position.set(t.x, t.y, t.z); alive.push(t)
    }
    this.tins = alive
    this.flash = Math.max(0, this.flash - dt * 6)
    this.ringLight.emissiveIntensity = 0.5 + this.flash * 5
    const blink = this.busy > 0
    this.leds.forEach((m, i) => { m.emissiveIntensity = blink ? (Math.sin(now / 40 + i * 1.7) > 0 ? 2 : 0.1) : 0.25 })
    this.controls.update()
    this.renderer.render(this.scene, this.view)
  }
}
