import { useEffect, useRef, useState } from 'react'

export interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  imgRef: React.RefObject<HTMLImageElement>
  onChange: (box: CropBox) => void
}

type DragMode = 'none' | 'draw' | 'move' | 'nw' | 'ne' | 'sw' | 'se'

interface PixelBox {
  x: number
  y: number
  w: number
  h: number
}

function getImageRect(img: HTMLImageElement): DOMRect {
  const c = img.getBoundingClientRect()
  const natRatio = img.naturalWidth / img.naturalHeight
  const containerRatio = c.width / c.height
  let rW: number, rH: number
  if (natRatio > containerRatio) {
    rW = c.width
    rH = c.width / natRatio
  } else {
    rH = c.height
    rW = c.height * natRatio
  }
  return new DOMRect(c.left + (c.width - rW) / 2, c.top + (c.height - rH) / 2, rW, rH)
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

export default function CropOverlay({ imgRef, onChange }: Props) {
  const [box, setBox] = useState<PixelBox | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: DragMode
    startX: number
    startY: number
    origBox: PixelBox | null
  } | null>(null)

  useEffect(() => {
    if (!box || !imgRef.current) return
    const img = imgRef.current
    const iRect = getImageRect(img)
    const overlayRect = overlayRef.current!.getBoundingClientRect()
    const absX = box.x + overlayRect.left
    const absY = box.y + overlayRect.top
    const scaleX = img.naturalWidth / iRect.width
    const scaleY = img.naturalHeight / iRect.height
    const gifX = Math.round((absX - iRect.left) * scaleX)
    const gifY = Math.round((absY - iRect.top) * scaleY)
    const gifW = Math.round(box.w * scaleX)
    const gifH = Math.round(box.h * scaleY)
    onChange({ x: gifX, y: gifY, width: gifW, height: gifH })
  }, [box]) // eslint-disable-line react-hooks/exhaustive-deps

  function overlayCoords(clientX: number, clientY: number) {
    const r = overlayRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top, w: r.width, h: r.height }
  }

  function applyMove(clientX: number, clientY: number) {
    const { mode, startX, startY, origBox } = dragRef.current!
    const { x: ox, y: oy, w: ow, h: oh } = overlayCoords(clientX, clientY)
    const dx = clientX - startX
    const dy = clientY - startY

    if (mode === 'draw') {
      const sx = overlayCoords(startX, startY).x
      const sy = overlayCoords(startX, startY).y
      const nx = clamp(Math.min(sx, ox), 0, ow)
      const ny = clamp(Math.min(sy, oy), 0, oh)
      const nw = clamp(Math.abs(ox - sx), 0, ow - nx)
      const nh = clamp(Math.abs(oy - sy), 0, oh - ny)
      setBox({ x: nx, y: ny, w: nw, h: nh })
    } else if (mode === 'move' && origBox) {
      const nx = clamp(origBox.x + dx, 0, ow - origBox.w)
      const ny = clamp(origBox.y + dy, 0, oh - origBox.h)
      setBox({ x: nx, y: ny, w: origBox.w, h: origBox.h })
    } else if (origBox) {
      let { x, y, w, h } = origBox
      if (mode === 'nw') {
        const newX = clamp(x + dx, 0, x + w - 1)
        const newY = clamp(y + dy, 0, y + h - 1)
        w = w + (x - newX); h = h + (y - newY); x = newX; y = newY
      } else if (mode === 'ne') {
        const newY = clamp(y + dy, 0, y + h - 1)
        h = h + (y - newY); y = newY; w = clamp(w + dx, 1, ow - x)
      } else if (mode === 'sw') {
        const newX = clamp(x + dx, 0, x + w - 1)
        w = w + (x - newX); x = newX; h = clamp(h + dy, 1, oh - y)
      } else if (mode === 'se') {
        w = clamp(w + dx, 1, ow - x); h = clamp(h + dy, 1, oh - y)
      }
      if (w > 0 && h > 0) setBox({ x, y, w, h })
    }
  }

  function startDrag(clientX: number, clientY: number, mode: DragMode) {
    dragRef.current = { mode, startX: clientX, startY: clientY, origBox: box }
  }

  function onMouseDown(e: React.MouseEvent, mode: DragMode) {
    e.preventDefault()
    e.stopPropagation()
    startDrag(e.clientX, e.clientY, mode)

    function onMove(ev: MouseEvent) { applyMove(ev.clientX, ev.clientY) }
    function onUp() {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onTouchStart(e: React.TouchEvent, mode: DragMode) {
    e.preventDefault()
    e.stopPropagation()
    const t = e.touches[0]
    startDrag(t.clientX, t.clientY, mode)

    function onMove(ev: TouchEvent) {
      ev.preventDefault()
      applyMove(ev.touches[0].clientX, ev.touches[0].clientY)
    }
    function onEnd() {
      dragRef.current = null
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  const handleSz = 16 // larger handles for touch
  const half = handleSz / 2

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair overflow-hidden touch-none"
      onMouseDown={(e) => onMouseDown(e, 'draw')}
      onTouchStart={(e) => onTouchStart(e, 'draw')}
    >
      {box && box.w > 2 && box.h > 2 && (
        <div
          style={{
            position: 'absolute',
            left: box.x,
            top: box.y,
            width: box.w,
            height: box.h,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            border: '1.5px solid rgba(255,255,255,0.8)',
            cursor: 'move',
          }}
          onMouseDown={(e) => onMouseDown(e, 'move')}
          onTouchStart={(e) => onTouchStart(e, 'move')}
        >
          {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
            const isN = corner[0] === 'n'
            const isW = corner[1] === 'w'
            return (
              <div
                key={corner}
                onMouseDown={(e) => onMouseDown(e, corner)}
                onTouchStart={(e) => onTouchStart(e, corner)}
                style={{
                  position: 'absolute',
                  width: handleSz,
                  height: handleSz,
                  background: 'white',
                  top: isN ? -half : undefined,
                  bottom: !isN ? -half : undefined,
                  left: isW ? -half : undefined,
                  right: !isW ? -half : undefined,
                  cursor: `${corner}-resize`,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
