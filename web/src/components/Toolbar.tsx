import { useState } from 'react'
import { FileMeta, trim, addText, crop, speed, applyEffect, resize, OpResult } from '../wasmApi'
import { CropBox } from './CropOverlay'

export type Tab = 'trim' | 'text' | 'crop' | 'speed' | 'effects' | 'resize'

export interface TextConfig {
  text: string
  color: string
  font: string
}

interface Props {
  meta: FileMeta
  activeTab: Tab
  onTabChange: (t: Tab) => void
  cropSelection: CropBox | null
  speedApplied: boolean
  effectType: 'grayscale' | 'deepfry'
  onEffectTypeChange: (t: 'grayscale' | 'deepfry') => void
  textConfig: TextConfig
  onTextConfigChange: (cfg: TextConfig) => void
  textPos: { x: number; y: number; size: number } | null
  onResult: (result: OpResult, opName: string) => void
  onError: (msg: string) => void
}

const COLOR_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
]

const FONT_OPTIONS = [
  { value: 'regular',   label: 'Regular' },
  { value: 'bold',      label: 'Bold' },
  { value: 'italic',    label: 'Italic' },
  { value: 'mono',      label: 'Monospace' },
  { value: 'smallcaps', label: 'Small Caps' },
]

export default function Toolbar({ meta, activeTab, onTabChange, cropSelection, speedApplied, effectType, onEffectTypeChange, textConfig, onTextConfigChange, textPos, onResult, onError }: Props) {
  const [busy, setBusy] = useState(false)

  // trim fields
  const [trimStart, setTrimStart] = useState('0')
  const [trimEnd, setTrimEnd] = useState(String((meta.frames ?? 1) - 1))

  // speed fields
  const [speedFactor, setSpeedFactor] = useState(2)

  // resize fields
  const [resizeWidth, setResizeWidth] = useState('')
  const [resizeHeight, setResizeHeight] = useState('')


  async function run() {
    setBusy(true)
    try {
      let result: OpResult
      let opName: string
      if (activeTab === 'trim') {
        result = await trim(parseInt(trimStart), parseInt(trimEnd))
        opName = 'Trim'
      } else if (activeTab === 'resize') {
        const w = parseInt(resizeWidth) || 0
        const h = parseInt(resizeHeight) || 0
        if (w === 0 && h === 0) {
          onError('Enter a width or height')
          return
        }
        result = await resize(w, h)
        opName = 'Resize'
      } else if (activeTab === 'effects') {
        result = await applyEffect(effectType)
        opName = effectType === 'grayscale' ? 'Grayscale' : 'Deep Fry'
      } else if (activeTab === 'speed') {
        result = await speed(speedFactor)
        opName = `${speedFactor}× Speed`
      } else if (activeTab === 'crop') {
        if (!cropSelection) {
          onError('Draw a crop selection first')
          return
        }
        result = await crop(cropSelection.x, cropSelection.y, cropSelection.width, cropSelection.height)
        opName = 'Crop'
      } else {
        if (!textConfig.text.trim()) {
          onError('Text cannot be empty')
          return
        }
        if (!textPos) {
          onError('Position the text on the preview first')
          return
        }
        result = await addText(textConfig.text, textPos.size, textConfig.color, textConfig.font, textPos.x, textPos.y)
        opName = 'Text'
      }
      onResult(result, opName)
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: 'trim', label: 'Trim' },
    { id: 'text', label: 'Text' },
    { id: 'crop', label: 'Crop' },
    { id: 'speed', label: 'Speed', disabled: speedApplied },
    { id: 'effects', label: 'Effects' },
    { id: 'resize', label: 'Resize' },
  ]

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={t.disabled}
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${activeTab === t.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}
              disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Trim */}
      {activeTab === 'trim' && (
        <TrimSlider
          frames={meta.frames ?? 1}
          start={parseInt(trimStart)}
          end={parseInt(trimEnd)}
          onChange={(s, e) => { setTrimStart(String(s)); setTrimEnd(String(e)) }}
        />
      )}

      {/* Text */}
      {activeTab === 'text' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Text</label>
            <input
              value={textConfig.text}
              onChange={(e) => onTextConfigChange({ ...textConfig, text: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              placeholder="Enter text…"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Color</label>
            <select
              value={textConfig.color}
              onChange={(e) => onTextConfigChange({ ...textConfig, color: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              {COLOR_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Font</label>
            <select
              value={textConfig.font}
              onChange={(e) => onTextConfigChange({ ...textConfig, font: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500">Drag text to position · drag corner handle to resize</p>
        </div>
      )}

      {/* Speed */}
      {activeTab === 'speed' && (
        <SpeedControl factor={speedFactor} onChange={setSpeedFactor} />
      )}

      {/* Effects */}
      {activeTab === 'effects' && (
        <div className="space-y-3">
          <div className="flex gap-3">
            {(['grayscale', 'deepfry'] as const).map((e) => (
              <button
                key={e}
                onClick={() => onEffectTypeChange(e)}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors
                  ${effectType === e ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {e === 'grayscale' ? 'Grayscale' : '🍳 Deep Fry'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {effectType === 'grayscale'
              ? 'Convert to black & white'
              : 'Extreme saturation, contrast, and sharpening — the meme treatment'}
          </p>
        </div>
      )}

      {/* Crop */}
      {activeTab === 'crop' && (
        <div className="text-sm text-gray-400 space-y-1">
          {cropSelection ? (
            <p>
              Selection:{' '}
              <span className="text-gray-200">
                {cropSelection.width}×{cropSelection.height}
              </span>{' '}
              at{' '}
              <span className="text-gray-200">
                ({cropSelection.x}, {cropSelection.y})
              </span>
            </p>
          ) : (
            <p>Draw a selection on the preview</p>
          )}
        </div>
      )}

      {/* Resize */}
      {activeTab === 'resize' && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Preset widths</label>
            <div className="flex gap-2 flex-wrap">
              {[320, 480, 640, 960, 1280].map((w) => (
                <button
                  key={w}
                  onClick={() => { setResizeWidth(String(w)); setResizeHeight('') }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${resizeWidth === String(w) && resizeHeight === '' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {w}px
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Width (px)</label>
              <input
                type="number"
                min={10}
                max={1280}
                value={resizeWidth}
                onChange={(e) => setResizeWidth(e.target.value)}
                placeholder="auto"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Height (px)</label>
              <input
                type="number"
                min={10}
                max={1280}
                value={resizeHeight}
                onChange={(e) => setResizeHeight(e.target.value)}
                placeholder="auto"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Fill one field — the other auto-calculates. Max 1280px.</p>
        </div>
      )}

      <button
        onClick={run}
        disabled={busy || (activeTab === 'speed' && speedApplied)}
        className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
      >
        {busy ? 'Processing…' : 'Apply'}
      </button>
    </div>
  )
}

function TrimSlider({
  frames,
  start,
  end,
  onChange,
}: {
  frames: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
}) {
  const max = Math.max(frames - 1, 1)
  const leftPct = (start / max) * 100
  const rightPct = (end / max) * 100
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
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 bg-gray-700 rounded-full" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-indigo-500 rounded-full pointer-events-none"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={start}
          onChange={(e) => onChange(Math.min(parseInt(e.target.value), end), end)}
          className={inputCls}
          style={{ zIndex: startOnTop ? 5 : 3 }}
        />
        <input
          type="range"
          min={0}
          max={max}
          value={end}
          onChange={(e) => onChange(start, Math.max(parseInt(e.target.value), start))}
          className={inputCls}
          style={{ zIndex: startOnTop ? 3 : 5 }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>Frame <span className="text-gray-300">{start}</span></span>
        <span>{frames} frames total</span>
        <span>Frame <span className="text-gray-300">{end}</span></span>
      </div>
    </div>
  )
}

const SPEED_OPTIONS = [
  { value: 0.25, label: '0.25×', desc: '4× slower' },
  { value: 0.5,  label: '0.5×',  desc: '2× slower' },
  { value: 0.75, label: '0.75×', desc: 'Slightly slower' },
  { value: 1.5,  label: '1.5×',  desc: 'Slightly faster' },
  { value: 2,    label: '2×',    desc: '2× faster' },
  { value: 4,    label: '4×',    desc: '4× faster' },
]

function SpeedControl({ factor, onChange }: { factor: number; onChange: (v: number) => void }) {
  const selected = SPEED_OPTIONS.find((o) => o.value === factor) ?? SPEED_OPTIONS[4]
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {SPEED_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${factor === o.value ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">{selected.desc}</p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
      />
    </div>
  )
}
