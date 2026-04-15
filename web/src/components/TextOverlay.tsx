import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getImageRect } from '../utils'

interface Props {
  imgRef: React.RefObject<HTMLImageElement>
  text: string
  color: string
  font: string
  onChange: (x: number, y: number, size: number) => void
}

const DEFAULT_RENDER_SIZE = 24

const FONT_CSS: Record<string, string> = {
  regular:   'sans-serif',
  bold:      'sans-serif',
  italic:    'sans-serif',
  mono:      'monospace',
  smallcaps: 'sans-serif',
}

const FONT_STYLE_CSS: Record<string, string> = {
  italic: 'italic',
}

const FONT_WEIGHT_CSS: Record<string, string> = {
  bold: 'bold',
}

const FONT_VARIANT_CSS: Record<string, string> = {
  smallcaps: 'small-caps',
}

export default function TextOverlay({ imgRef, text, color, font, onChange }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [renderSize, setRenderSize] = useState(DEFAULT_RENDER_SIZE)

  // Initialize position to center on mount
  useLayoutEffect(() => {
    if (!overlayRef.current) return
    const r = overlayRef.current.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      setPos({ x: r.width / 2, y: r.height / 2 })
    }
  }, [])

  // Convert rendered-pixel pos + size → GIF pixel coords and notify parent
  useEffect(() => {
    if (!pos || !imgRef.current || !overlayRef.current) return
    const img = imgRef.current
    if (!img.naturalWidth) return
    const iRect = getImageRect(img)
    const oRect = overlayRef.current.getBoundingClientRect()
    const scaleX = img.naturalWidth / iRect.width
    const scaleY = img.naturalHeight / iRect.height
    const absX = pos.x + oRect.left
    const absY = pos.y + oRect.top
    const gifX = Math.round((absX - iRect.left) * scaleX)
    const gifY = Math.round((absY - iRect.top) * scaleY)
    const gifSize = Math.round(renderSize * scaleX)
    onChange(Math.max(0, gifX), Math.max(0, gifY), Math.max(8, gifSize))
  }, [pos, renderSize]) // eslint-disable-line react-hooks/exhaustive-deps

  function onBodyMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const origPos = pos!

    function onMove(ev: MouseEvent) {
      const r = overlayRef.current!.getBoundingClientRect()
      setPos({
        x: Math.max(0, Math.min(r.width, origPos.x + (ev.clientX - startX))),
        y: Math.max(0, Math.min(r.height, origPos.y + (ev.clientY - startY))),
      })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onBodyTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    const t = e.touches[0]
    const startX = t.clientX
    const startY = t.clientY
    const origPos = pos!

    function onMove(ev: TouchEvent) {
      ev.preventDefault()
      const r = overlayRef.current!.getBoundingClientRect()
      setPos({
        x: Math.max(0, Math.min(r.width, origPos.x + (ev.touches[0].clientX - startX))),
        y: Math.max(0, Math.min(r.height, origPos.y + (ev.touches[0].clientY - startY))),
      })
    }
    function onEnd() {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  function onHandleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const origSize = renderSize

    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY
      setRenderSize(Math.max(8, Math.min(200, origSize + dy)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function onHandleTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.touches[0].clientY
    const origSize = renderSize

    function onMove(ev: TouchEvent) {
      ev.preventDefault()
      const dy = ev.touches[0].clientY - startY
      setRenderSize(Math.max(8, Math.min(200, origSize + dy)))
    }
    function onEnd() {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  const effectivePos = pos ?? { x: 0, y: 0 }
  const cssColor = color === 'black' ? '#000000' : '#ffffff'
  // Dashed border that's visible against both light and dark backgrounds
  const borderColor = color === 'black' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'
  const shadowColor = color === 'black' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'

  return (
    <div ref={overlayRef} className="absolute inset-0 pointer-events-none touch-none">
      {text && (
        <div
          onMouseDown={onBodyMouseDown}
          onTouchStart={onBodyTouchStart}
          style={{
            position: 'absolute',
            left: effectivePos.x,
            top: effectivePos.y,
            color: cssColor,
            fontSize: renderSize + 'px',
            fontFamily: FONT_CSS[font] ?? 'sans-serif',
            fontWeight: FONT_WEIGHT_CSS[font] ?? 'normal',
            fontStyle: FONT_STYLE_CSS[font] ?? 'normal',
            fontVariant: FONT_VARIANT_CSS[font] ?? 'normal',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            cursor: 'move',
            userSelect: 'none',
            pointerEvents: 'auto',
            padding: '4px 6px',
            border: `1.5px dashed ${borderColor}`,
            boxShadow: `0 0 0 1px ${shadowColor}`,
          }}
        >
          {text}
          {/* Resize handle — bottom-right corner */}
          <div
            onMouseDown={onHandleMouseDown}
            onTouchStart={onHandleTouchStart}
            title="Drag to resize"
            style={{
              position: 'absolute',
              bottom: -8,
              right: -8,
              width: 16,
              height: 16,
              background: 'white',
              border: '1px solid rgba(0,0,0,0.5)',
              cursor: 'se-resize',
            }}
          />
        </div>
      )}
    </div>
  )
}
