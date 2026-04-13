interface Props {
  duration: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
  onCommit?: (start: number, end: number) => void
}

export default function VideoRangeSlider({ duration, start, end, onChange, onCommit }: Props) {
  const step = 0.1
  const leftPct = (start / duration) * 100
  const rightPct = (end / duration) * 100
  const startOnTop = leftPct > 90

  const inputCls =
    'absolute inset-0 w-full h-full appearance-none bg-transparent ' +
    'pointer-events-none ' +
    '[&::-webkit-slider-runnable-track]:appearance-none ' +
    '[&::-webkit-slider-runnable-track]:bg-transparent ' +
    '[&::-webkit-slider-thumb]:pointer-events-auto ' +
    '[&::-webkit-slider-thumb]:appearance-none ' +
    '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 ' +
    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white ' +
    '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab ' +
    '[&::-moz-range-track]:bg-transparent ' +
    '[&::-moz-range-thumb]:pointer-events-auto ' +
    '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 ' +
    '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white ' +
    '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab'

  return (
    <div className="space-y-3">
      <div className="relative h-5">
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 bg-slate-700 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full pointer-events-none"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={step}
          value={start}
          onChange={(e) => onChange(Math.min(parseFloat(e.target.value), end - step), end)}
          onPointerUp={() => onCommit?.(start, end)}
          className={inputCls}
          style={{ zIndex: startOnTop ? 5 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={duration}
          step={step}
          value={end}
          onChange={(e) => onChange(start, Math.max(parseFloat(e.target.value), start + step))}
          onPointerUp={() => onCommit?.(start, end)}
          className={inputCls}
          style={{ zIndex: startOnTop ? 3 : 5 }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span><span className="text-gray-300">{start.toFixed(1)}s</span></span>
        <span>{duration.toFixed(1)}s total</span>
        <span><span className="text-gray-300">{end.toFixed(1)}s</span></span>
      </div>
    </div>
  )
}
