import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { LineScene, type Decision, type LineParams, type Outcome } from '../render/line'

export interface LineHandle { decide(id: number, d: Decision): void }

/** Mounts the 3D production line. Without `onCapture` the line only runs as an animation. */
export const LineView = forwardRef<LineHandle, { params: LineParams; onCapture?: (image: HTMLCanvasElement, id: number) => void; onOutcome?: (o: Outcome) => void; label: string }>(
  function LineView({ params, onCapture, onOutcome, label }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const scene = useRef<LineScene | null>(null)
    const cb = useRef({ onCapture, onOutcome }); cb.current = { onCapture, onOutcome }
    useEffect(() => {
      const s = new LineScene(canvas.current!, params)
      scene.current = s
      return () => { s.dispose(); scene.current = null }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    useEffect(() => {
      const s = scene.current; if (!s) return
      s.onCapture = onCapture ? (img, id) => cb.current.onCapture?.(img, id) : null
      s.onOutcome = (o) => cb.current.onOutcome?.(o)
    }, [onCapture === undefined])
    useEffect(() => { scene.current?.set(params) }, [params])
    useImperativeHandle(ref, () => ({ decide: (id, d) => scene.current?.decide(id, d) }), [])
    return <canvas ref={canvas} className="line-canvas" aria-label={label} />
  })
