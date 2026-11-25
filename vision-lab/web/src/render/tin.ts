// Procedural RYBEX fish tin: metal body with rims and lid, wrapped paper label, printed batch code.
// The same builder feeds the synthetic image generator and the 3D production line, so a model
// trained on generated images sees the same kind of product on the line.
import * as THREE from 'three'
import type { ClassId, Design } from '../types'
import { rng, type Rng } from '../rng'

export interface TinSpec {
  seed: number
  design: Design
  defect: ClassId
  /** 0..1: how pronounced the defect is. */
  severity: number
  /** Rotation of the tin around its axis, radians (0 = label faces the camera). */
  yaw: number
}

export const TIN_R = 0.31
export const TIN_H = 1.0
const LABEL_Y0 = 0.33, LABEL_Y1 = 0.79

interface DesignDef { name: string[]; top: string; main: string; wave: string; text: string; sub: string; fish: string }
export const DESIGN_DEFS: Record<Design, DesignDef> = {
  szprot: { name: ['Szprot', 'w oleju'], top: '#0f5b5e', main: '#d9412b', wave: '#f4c63d', text: '#ffffff', sub: '#0f5b5e', fish: '#c9cfd4' },
  makrela: { name: ['Makrela', 'w pomidorach'], top: '#16305a', main: '#e8742a', wave: '#f7e3b0', text: '#ffffff', sub: '#16305a', fish: '#b9c4cc' },
  sledz: { name: ['Śledź', 'po kaszubsku'], top: '#22503a', main: '#efe5c8', wave: '#c8562c', text: '#22503a', sub: '#22503a', fish: '#aab6bd' },
  tunczyk: { name: ['Tuńczyk', 'w sosie własnym'], top: '#101820', main: '#2f7fc1', wave: '#e9eef2', text: '#ffffff', sub: '#101820', fish: '#d6dde2' },
}

const LW = 1024, LH = 400
const labelCanvases = new Map<Design, HTMLCanvasElement>()
const labelTextures = new Map<Design, THREE.CanvasTexture>()

function drawFish(x: CanvasRenderingContext2D, cx: number, cy: number, len: number, color: string, angle: number) {
  x.save(); x.translate(cx, cy); x.rotate(angle)
  x.fillStyle = color
  x.beginPath(); x.ellipse(0, 0, len / 2, len / 9, 0, 0, Math.PI * 2); x.fill()
  x.beginPath(); x.moveTo(len / 2 - 6, 0); x.lineTo(len / 2 + len / 7, -len / 9); x.lineTo(len / 2 + len / 7, len / 9); x.closePath(); x.fill()
  x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 2
  x.beginPath(); x.moveTo(-len / 2 + 10, -1); x.lineTo(len / 2 - 8, -1); x.stroke()
  x.fillStyle = 'rgba(0,0,0,.6)'; x.beginPath(); x.arc(-len / 2 + 16, -4, 3, 0, 7); x.fill()
  x.restore()
}

/** Full wrap-around label artwork. The front panel is centred at x = LW / 2. */
export function labelCanvas(design: Design): HTMLCanvasElement {
  const hit = labelCanvases.get(design); if (hit) return hit
  const d = DESIGN_DEFS[design]
  const c = document.createElement('canvas'); c.width = LW; c.height = LH
  const x = c.getContext('2d')!
  x.fillStyle = d.main; x.fillRect(0, 0, LW, LH)
  // wave between the main field and the lower band
  x.fillStyle = d.wave
  x.beginPath(); x.moveTo(0, LH)
  for (let i = 0; i <= LW; i += 8) x.lineTo(i, LH - 70 - 22 * Math.sin((i / LW) * Math.PI * 4 + 0.6))
  x.lineTo(LW, LH); x.closePath(); x.fill()
  x.fillStyle = d.top
  x.beginPath(); x.moveTo(0, LH)
  for (let i = 0; i <= LW; i += 8) x.lineTo(i, LH - 40 - 20 * Math.sin((i / LW) * Math.PI * 4 + 1.2))
  x.lineTo(LW, LH); x.closePath(); x.fill()
  x.fillRect(0, 0, LW, 96)
  // brand: fish mark + RYBEX
  const cx = LW / 2
  x.fillStyle = '#ffffff'
  x.beginPath(); x.ellipse(cx - 108, 50, 22, 10, 0, 0, 7); x.fill()
  x.beginPath(); x.moveTo(cx - 90, 50); x.lineTo(cx - 74, 39); x.lineTo(cx - 74, 61); x.closePath(); x.fill()
  x.fillStyle = d.top; x.beginPath(); x.arc(cx - 120, 47, 3, 0, 7); x.fill()
  x.fillStyle = '#ffffff'; x.font = '900 50px "Arial Black", "Helvetica Neue", Arial, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left'
  x.fillText('RYBEX', cx - 64, 52)
  // product name
  x.fillStyle = d.text; x.font = 'italic 800 50px "Trebuchet MS", "Helvetica Neue", Arial, sans-serif'
  x.save(); x.translate(cx - 128, 0); x.rotate(-0.045)
  x.fillText(d.name[0], 0, 160)
  x.font = `italic 800 ${d.name[1].length > 10 ? 30 : 44}px "Trebuchet MS", "Helvetica Neue", Arial, sans-serif`
  x.fillText(d.name[1], 0, 210); x.restore()
  // plate with fish
  x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.ellipse(cx + 52, 274, 76, 32, -0.12, 0, 7); x.fill()
  x.fillStyle = 'rgba(214,160,60,.55)'; x.beginPath(); x.ellipse(cx + 52, 276, 60, 22, -0.12, 0, 7); x.fill()
  for (let i = 0; i < 3; i++) drawFish(x, cx + 46 + i * 5, 264 + i * 11, 98, d.fish, -0.2)
  // back panel: ingredients block, weight, barcode
  for (const bx of [cx - 512 + 40, cx + 512 - 300]) {
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(bx, 122, 250, 170)
    x.fillStyle = '#222'
    for (let i = 0; i < 9; i++) x.fillRect(bx + 14, 136 + i * 12, 120 + ((i * 37) % 90), 4)
    for (let i = 0; i < 34; i++) { const w = 1 + ((i * 7) % 4); x.fillRect(bx + 20 + i * 6, 250, w, 32) }
  }
  x.fillStyle = d.text === '#ffffff' ? 'rgba(255,255,255,.9)' : d.sub
  x.font = '700 22px Arial, sans-serif'; x.textAlign = 'center'
  x.fillText('170 g', cx - 250, 200); x.fillText('170 g', cx + 250, 130)
  labelCanvases.set(design, c)
  return c
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
function labelTexture(design: Design): THREE.CanvasTexture {
  let t = labelTextures.get(design)
  if (!t) { t = texture(labelCanvas(design)); labelTextures.set(design, t) }
  return t
}

/** A label with torn patches, a peeled edge and scratches. Unique per tin. */
function damagedLabel(design: Design, r: Rng, sev: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = LW; c.height = LH
  const x = c.getContext('2d')!
  x.drawImage(labelCanvas(design), 0, 0)
  const tears = 1 + Math.round(sev * 2)
  for (let t = 0; t < tears; t++) {
    const fromEdge = r.chance(0.6)
    const cx = LW / 2 + r.range(-190, 190)
    const cy = fromEdge ? (r.chance(0.5) ? r.range(0, 40) : LH - r.range(0, 40)) : r.range(110, LH - 110)
    const rad = 34 + sev * 90 * r.range(0.6, 1.1)
    const pts: [number, number][] = []
    const n = 14
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const q = rad * r.range(0.55, 1.15); pts.push([cx + Math.cos(a) * q * 1.25, cy + Math.sin(a) * q]) }
    const path = (grow: number) => { x.beginPath(); pts.forEach(([px, py], i) => { const gx = cx + (px - cx) * grow, gy = cy + (py - cy) * grow; if (i) x.lineTo(gx, gy); else x.moveTo(gx, gy) }); x.closePath() }
    x.fillStyle = '#f3efe6'; path(1.12); x.fill() // exposed paper fibre around the tear
    x.globalCompositeOperation = 'destination-out'; path(1); x.fill(); x.globalCompositeOperation = 'source-over'
  }
  const scratches = Math.round(2 + sev * 7)
  x.globalCompositeOperation = 'destination-out'; x.lineCap = 'round'
  for (let i = 0; i < scratches; i++) {
    const sx = LW / 2 + r.range(-230, 230), sy = r.range(30, LH - 30), len = r.range(40, 150), a = r.range(-0.6, 0.6)
    x.lineWidth = r.range(1.5, 3 + sev * 5)
    x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); x.stroke()
  }
  x.globalCompositeOperation = 'source-over'
  return c
}

/** Batch code and best-before date, ink-jet printed on the bare metal below the label. */
function codeCanvas(r: Rng, state: 'ok' | 'smudged', sev: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 512; c.height = 110
  const x = c.getContext('2d')!
  const day = String(r.int(1, 28)).padStart(2, '0'), month = String(r.int(1, 12)).padStart(2, '0')
  const text = `RYB-27${month}${day}-L2`
  x.font = '700 60px "Courier New", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'
  if (state === 'ok') { x.fillStyle = 'rgba(28,30,34,.92)'; x.fillText(text, 256, 56); return c }
  // smudged: several faint, offset passes, then wiped streaks
  const passes = 10
  for (let i = 0; i < passes; i++) {
    x.fillStyle = `rgba(28,30,34,${(0.16 - sev * 0.07).toFixed(3)})`
    x.fillText(text, 256 + r.range(-1, 1) * (6 + sev * 22), 56 + r.range(-1, 1) * (3 + sev * 7))
  }
  x.globalCompositeOperation = 'destination-out'
  const wipes = Math.round(1 + sev * 4)
  for (let i = 0; i < wipes; i++) {
    x.fillStyle = `rgba(0,0,0,${r.range(0.5, 0.95).toFixed(2)})`
    const wx = r.range(40, 400)
    x.beginPath(); x.ellipse(wx, 56 + r.range(-8, 8), r.range(30, 60 + sev * 80), r.range(12, 30), r.range(-0.2, 0.2), 0, 7); x.fill()
  }
  x.globalCompositeOperation = 'source-over'
  return c
}

const metalMat = new THREE.MeshStandardMaterial({ color: 0xd6d9dc, metalness: 1, roughness: 0.24, vertexColors: true, side: THREE.DoubleSide })

function profile(): THREE.Vector2[] {
  const R = TIN_R, H = TIN_H, p: THREE.Vector2[] = []
  const add = (r: number, y: number) => p.push(new THREE.Vector2(r, y))
  add(0.0001, 0.014); add(R - 0.04, 0.014); add(R - 0.014, 0.002); add(R + 0.008, 0); add(R + 0.013, 0.012); add(R + 0.009, 0.03); add(R, 0.042)
  const steps = 44
  for (let i = 1; i < steps; i++) add(R, 0.042 + ((H - 0.084) * i) / steps)
  add(R, H - 0.042); add(R + 0.009, H - 0.03); add(R + 0.013, H - 0.012); add(R + 0.008, H); add(R - 0.012, H); add(R - 0.022, H - 0.03)
  const rings = 14
  for (let i = 0; i <= rings; i++) {
    const rr = (R - 0.03) * (1 - i / rings)
    const bead = Math.exp(-(((rr - R * 0.68) / 0.012) ** 2)) * 0.007 + Math.exp(-(((rr - R * 0.3) / 0.012) ** 2)) * 0.004
    add(Math.max(rr, 0.0001), H - 0.034 + bead)
  }
  return p
}
const PROFILE = profile()

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Builds one tin. Its base stands on y = 0, the axis is the y axis. */
export function buildTin(spec: TinSpec): THREE.Group {
  const r = rng(spec.seed * 7919 + 13)
  const sev = Math.min(1, Math.max(0, spec.severity))
  const g = new THREE.Group()
  const own: { dispose(): void }[] = []
  // Defects face the camera (within about 40 degrees of the front): a single camera cannot see the back.
  const front = -spec.yaw + r.range(-0.7, 0.7)

  // dent: a smooth inward pocket, slightly sharper along one edge
  let radial: ((theta: number, y: number) => number) | null = null
  if (spec.defect === 'dent') {
    const y0 = r.chance(0.6) ? r.range(0.8, 0.93) : r.chance(0.5) ? r.range(0.08, 0.26) : r.range(0.4, 0.7)
    const depth = 0.012 + sev * 0.075, st = 0.22 + sev * 0.3 * r.range(0.7, 1.2), sy = 0.05 + sev * 0.11 * r.range(0.7, 1.2), skew = r.range(-0.6, 0.6)
    radial = (theta, y) => {
      const dt = wrap(theta - front) / st, dy = (y - y0) / sy
      const base = Math.exp(-(dt * dt + dy * dy))
      const crease = Math.exp(-((dt + skew * dy) ** 2) * 6 - dy * dy * 0.8) * 0.35
      return depth * Math.min(1.2, base + crease * sev)
    }
  }

  // metal can
  const geo = new THREE.LatheGeometry(PROFILE, 80, Math.PI, Math.PI * 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const col = new Float32Array(pos.count * 3).fill(1)
  const lid = spec.defect === 'lid'
  const bulge = lid && r.chance(0.35)
  const la = front + r.range(-0.3, 0.3), lr = TIN_R * r.range(0.25, 0.6)
  const lx = Math.sin(la) * lr, lz = Math.cos(la) * lr
  const lsig = 0.06 + sev * 0.09, ldepth = 0.012 + sev * 0.05
  const rimBend = lid && sev > 0.35
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const rad = Math.hypot(x, z), theta = Math.atan2(x, z)
    if (radial && rad > TIN_R * 0.9) { const k = (rad - radial(theta, y)) / rad; x *= k; z *= k }
    if (lid && y > TIN_H - 0.05) {
      if (rad < TIN_R - 0.016) {
        if (bulge) y += (0.02 + sev * 0.05) * Math.max(0, 1 - (rad / (TIN_R - 0.02)) ** 2)
        else {
          const d2 = (x - lx) ** 2 + (z - lz) ** 2, f = Math.exp(-d2 / (lsig * lsig))
          y -= ldepth * f
          const stain = Math.min(1, f * (0.5 + sev * 0.9))
          col[i * 3] = 1 - stain * 0.5; col[i * 3 + 1] = 1 - stain * 0.68; col[i * 3 + 2] = 1 - stain * 0.82
        }
      } else if (rimBend) {
        const f = Math.exp(-((wrap(theta - la) / 0.45) ** 2)) * sev
        y -= 0.035 * f; const k = 1 - 0.06 * f; x *= k; z *= k
      }
    }
    pos.setXYZ(i, x, y, z)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.computeVertexNormals()
  const can = new THREE.Mesh(geo, metalMat); can.castShadow = true; can.receiveShadow = true
  g.add(can); own.push(geo)

  const hug = (geom: THREE.BufferGeometry, yOff: number) => {
    if (!radial) return
    const p = geom.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), rad = Math.hypot(x, z)
      const k = (rad - radial(Math.atan2(x, z), p.getY(i) + yOff)) / rad
      p.setX(i, x * k); p.setZ(i, z * k)
    }
    geom.computeVertexNormals()
  }

  // paper label
  if (spec.defect !== 'label_missing') {
    const h = (LABEL_Y1 - LABEL_Y0) * TIN_H
    const lg = new THREE.CylinderGeometry(TIN_R + 0.004, TIN_R + 0.004, h, 96, 18, true, Math.PI, Math.PI * 2)
    let yc = ((LABEL_Y0 + LABEL_Y1) / 2) * TIN_H + r.range(-0.006, 0.006)
    let map: THREE.Texture = labelTexture(spec.design)
    let alphaTest = 0
    if (spec.defect === 'label_wrong') {
      const kind = r.int(0, 2) // 0 shifted, 1 crooked, 2 both
      if (kind !== 1) yc += (r.chance(0.5) ? 0.035 + sev * 0.1 : -(0.04 + sev * 0.14))
      if (kind !== 0) {
        const k = (r.chance(0.5) ? 1 : -1) * (0.05 + sev * 0.22)
        const p = lg.attributes.position as THREE.BufferAttribute
        const c = Math.cos(spec.yaw), s = Math.sin(spec.yaw)
        for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + k * (p.getX(i) * c + p.getZ(i) * s))
      }
      if (sev > 0.8 && r.chance(0.4)) { // applied upside down
        const uv = lg.attributes.uv as THREE.BufferAttribute
        for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i))
      }
    }
    if (spec.defect === 'label_damaged') { map = texture(damagedLabel(spec.design, r, sev)); own.push(map); alphaTest = 0.5 }
    hug(lg, yc)
    const lm = new THREE.MeshStandardMaterial({ map, roughness: 0.48, metalness: 0, alphaTest, side: THREE.FrontSide, envMapIntensity: 0.6 })
    const label = new THREE.Mesh(lg, lm); label.position.y = yc; label.castShadow = false; label.receiveShadow = true
    g.add(label); own.push(lg, lm)
  }

  // printed code
  const smudged = spec.defect === 'marking'
  if (!(smudged && sev > 0.55 && r.chance(0.45))) {
    const arc = 1.95
    const cg = new THREE.CylinderGeometry(TIN_R + 0.002, TIN_R + 0.002, 0.13, 40, 4, true, Math.PI * 2 - arc / 2, arc)
    hug(cg, 0.19)
    const ct = texture(codeCanvas(r, smudged ? 'smudged' : 'ok', sev))
    const cm = new THREE.MeshStandardMaterial({ map: ct, transparent: true, roughness: 0.7, metalness: 0, depthWrite: false, envMapIntensity: 0.2 })
    const code = new THREE.Mesh(cg, cm); code.position.y = 0.19
    g.add(code); own.push(cg, cm, ct)
  }

  g.rotation.y = spec.yaw
  g.userData.own = own
  return g
}

export function disposeTin(g: THREE.Object3D) {
  for (const o of (g.userData.own as { dispose(): void }[] | undefined) ?? []) o.dispose()
  g.userData.own = []
}
