import { useEffect, useRef, useState } from 'react'
import { load, loadMP4, getVideoDuration, getVideoHasAudio, restoreId, blobUrl, FileMeta, OpResult } from './wasmApi'
import { fmtSize } from './utils'
import { ImageIcon, Film, ArrowLeftRight, ChevronLeft } from 'lucide-react'

function GifInfo({ meta }: { meta: FileMeta }) {
  const parts = []
  if (meta.width && meta.height) parts.push(`${meta.width}×${meta.height}`)
  if (meta.frames) parts.push(`${meta.frames} frames`)
  if (meta.size) parts.push(`~${fmtSize(meta.size)}`)
  if (parts.length === 0) return null
  return <p className="text-gray-500 text-xs">{parts.join(' · ')}</p>
}
import Dropzone from './components/Dropzone'
import Preview from './components/Preview'
import Toolbar, { Tab, TextConfig } from './components/Toolbar'
import ExportBar from './components/ExportBar'
import CropOverlay, { CropBox } from './components/CropOverlay'
import TextOverlay from './components/TextOverlay'
import VideoConvertPanel from './components/VideoConvertPanel'
import VideoRangeSlider from './components/VideoRangeSlider'

type AppMode = 'menu' | 'gif' | 'video-to-gif' | 'video-convert'

interface FileState {
  id: string
  meta: FileMeta
  src: string  // blob: URL for preview/download
}

interface HistoryEntry {
  state: FileState
  opName: string
}

const DUMMY_META: FileMeta = { type: 'gif', frames: 10, width: 320, height: 240 }

export default function App() {
  const [mode, setMode] = useState<AppMode>('menu')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [original, setOriginal] = useState<FileState | null>(null)
  const [working, setWorking] = useState<FileState | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [mp4Pending, setMp4Pending] = useState<{ file: File; duration: number; hasAudio: boolean; previewUrl: string } | null>(null)
  const [mp4Start, setMp4Start] = useState(0)
  const [mp4End, setMp4End] = useState(0)
  const [mp4Fps, setMp4Fps] = useState(10)
  const [mp4FpsCustom, setMp4FpsCustom] = useState(false)
  const [mp4FpsRaw, setMp4FpsRaw] = useState('')
  const [mp4HighQuality, setMp4HighQuality] = useState(false)
  const [videoResult, setVideoResult] = useState<{ url: string; filename: string; size: number; format: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('trim')
  const [cropBox, setCropBox] = useState<CropBox | null>(null)
  const [effectType, setEffectType] = useState<'grayscale' | 'deepfry'>('grayscale')
  const [textConfig, setTextConfig] = useState<TextConfig>({ text: '', color: 'white', font: 'regular' })
  const [textPos, setTextPos] = useState<{ x: number; y: number; size: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const prevSrcsRef = useRef<Set<string>>(new Set())

  function revokeAll() {
    prevSrcsRef.current.forEach((url) => URL.revokeObjectURL(url))
    prevSrcsRef.current.clear()
  }

  function revokeAllExcept(keepSrc: string) {
    prevSrcsRef.current.forEach((url) => { if (url !== keepSrc) URL.revokeObjectURL(url) })
    prevSrcsRef.current = new Set([keepSrc])
  }

  useEffect(() => {
    return () => { prevSrcsRef.current.forEach((url) => URL.revokeObjectURL(url)) }
  }, [])

  function clearMp4Pending() {
    if (mp4Pending?.previewUrl) URL.revokeObjectURL(mp4Pending.previewUrl)
    setMp4Pending(null)
  }

  async function makeFileState(result: OpResult): Promise<FileState> {
    const src = await blobUrl(result.id)
    prevSrcsRef.current.add(src)
    return { id: result.id, meta: result.meta, src }
  }

  async function handleFile(file: File) {
    revokeAll()
    setError(null)
    const isVideo = file.type.startsWith('video/') || ['.mp4', '.webm', '.mov'].some((ext) => file.name.toLowerCase().endsWith(ext))

    if (mode === 'gif' && isVideo) {
      setError('Upload a GIF file to use the GIF editor')
      return
    }
    if ((mode === 'video-to-gif' || mode === 'video-convert') && !isVideo) {
      setError('Upload a video file (.mp4, .webm, or .mov)')
      return
    }

    if (isVideo) {
      setUploading(true)
      try {
        const [duration, hasAudio] = await Promise.all([
          getVideoDuration(file),
          getVideoHasAudio(file),
        ])
        const previewUrl = URL.createObjectURL(file)
        setMp4Pending({ file, duration, hasAudio, previewUrl })
        setMp4Start(0)
        setMp4End(Math.round(duration * 10) / 10)
        setMp4Fps(10)
        setMp4FpsCustom(false)
        setMp4FpsRaw('')
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setUploading(false)
      }
      return
    }

    setUploading(true)
    try {
      const result = await load(file)
      const state = await makeFileState(result)
      setOriginal(state)
      setWorking(state)
      setHistory([])
      setActiveTab('trim')
      setCropBox(null)
      setTextConfig({ text: '', color: 'white', font: 'regular' })
      setTextPos(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleMp4Convert() {
    if (!mp4Pending) return
    revokeAll()
    setError(null)
    setUploading(true)
    try {
      const result = await loadMP4(mp4Pending.file, effectiveFps, mp4Start, mp4End, mp4HighQuality)
      const state = await makeFileState(result)
      setOriginal(state)
      setWorking(state)
      setHistory([])
      setActiveTab('trim')
      setCropBox(null)
      setTextConfig({ text: '', color: 'white', font: 'regular' })
      setTextPos(null)
      clearMp4Pending()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleResult(result: OpResult, opName: string) {
    try {
      const state = await makeFileState(result)
      setHistory((h) => [...h, { state: working!, opName }])
      setWorking(state)
      setCropBox(null)
      setTextPos(null)
      if (opName === 'Text') setTextConfig(c => ({ ...c, text: '' }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function undo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    const orphanedSrc = working?.src
    try {
      await restoreId(prev.state.id)
    } catch {
      // If the blob is gone just restore the UI state anyway
    }
    setWorking(prev.state)
    setHistory((h) => h.slice(0, -1))
    setCropBox(null)
    if (orphanedSrc && orphanedSrc !== original?.src) {
      requestAnimationFrame(() => {
        URL.revokeObjectURL(orphanedSrc)
        prevSrcsRef.current.delete(orphanedSrc)
      })
    }
  }

  function reset() {
    revokeAll()
    setOriginal(null)
    setWorking(null)
    setHistory([])
    setError(null)
    setCropBox(null)
    clearMp4Pending()
    if (videoResult?.url) URL.revokeObjectURL(videoResult.url)
    setVideoResult(null)
    setMode('menu')
  }

  async function resetEdits() {
    if (!original) return
    revokeAllExcept(original.src)
    try {
      await restoreId(original.id)
    } catch {
      // best effort
    }
    setWorking(original)
    setHistory([])
    setCropBox(null)
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab !== 'crop') setCropBox(null)
    if (tab !== 'text') setTextPos(null)
  }

  const effectiveFps = mp4FpsCustom ? (parseInt(mp4FpsRaw) || 0) : mp4Fps

  useEffect(() => {
    const video = videoRef.current
    if (!video || !mp4Pending) return

    const onTimeUpdate = () => {
      if (video.currentTime >= mp4End) video.currentTime = mp4Start
    }
    const onEnded = () => {
      video.currentTime = mp4Start
      video.play()
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [mp4Start, mp4End, mp4Pending])

  function handleRangeCommit(start: number, end: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = start
    video.play()
  }

  const opNames = history.map((h) => h.opName)
  const speedApplied = opNames.some((n) => n.includes('Speed'))
  const showCropOverlay = activeTab === 'crop' && working?.meta.type === 'gif'
  const showTextOverlay = activeTab === 'text' && working?.meta.type === 'gif'

  // Shared GIF editing UI (used by both 'gif' and 'video-to-gif' after conversion)
  function renderGifEditor() {
    return (
      <div className="space-y-4">
        {history.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 text-center">Original</p>
              <Preview src={original!.src} frames={original!.meta.frames} width={original!.meta.width} height={original!.meta.height} size={original!.meta.size} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 text-center">Edited</p>
              {showCropOverlay ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative" key={working!.id}>
                    <img ref={imgRef} src={working!.src}
                      className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-slate-800 object-contain block"
                      onLoad={() => setCropBox(null)} />
                    <CropOverlay key={working!.id} imgRef={imgRef} onChange={setCropBox} />
                  </div>
                  <GifInfo meta={working!.meta} />
                </div>
              ) : showTextOverlay ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="relative" key={working!.id}>
                    <img ref={imgRef} src={working!.src}
                      className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-slate-800 object-contain block" />
                    <TextOverlay key={working!.id} imgRef={imgRef}
                      text={textConfig.text} color={textConfig.color} font={textConfig.font}
                      onChange={(x, y, size) => setTextPos({ x, y, size })} />
                  </div>
                  <GifInfo meta={working!.meta} />
                </div>
              ) : (
                <Preview src={working!.src} frames={working!.meta.frames} width={working!.meta.width} height={working!.meta.height} size={working!.meta.size} />
              )}
            </div>
          </div>
        ) : (
          showCropOverlay ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative" key={working!.id}>
                <img ref={imgRef} src={working!.src}
                  className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-slate-800 object-contain block"
                  onLoad={() => setCropBox(null)} />
                <CropOverlay key={working!.id} imgRef={imgRef} onChange={setCropBox} />
              </div>
              <GifInfo meta={working!.meta} />
            </div>
          ) : showTextOverlay ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative" key={working!.id}>
                <img ref={imgRef} src={working!.src}
                  className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-slate-800 object-contain block" />
                <TextOverlay key={working!.id} imgRef={imgRef}
                  text={textConfig.text} color={textConfig.color} font={textConfig.font}
                  onChange={(x, y, size) => setTextPos({ x, y, size })} />
              </div>
              <GifInfo meta={working!.meta} />
            </div>
          ) : (
            <Preview src={working!.src} frames={working!.meta.frames} width={working!.meta.width} height={working!.meta.height} size={working!.meta.size} />
          )
        )}

        {opNames.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {['Original', ...opNames].map((step, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-600 text-xs">→</span>}
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-gray-400 text-xs">
                  {step}
                </span>
              </span>
            ))}
          </div>
        )}

        <Toolbar
          key={working!.id}
          meta={working!.meta}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          cropSelection={cropBox}
          speedApplied={speedApplied}
          effectType={effectType}
          onEffectTypeChange={setEffectType}
          textConfig={textConfig}
          onTextConfigChange={setTextConfig}
          textPos={textPos}
          onResult={handleResult}
          onError={setError}
        />

        <ExportBar
          downloadHref={working!.src}
          onReset={reset}
          onResetEdits={history.length > 0 ? resetEdits : undefined}
          onUndo={history.length > 0 ? undo : undefined}
          undoLabel={history.length > 0 ? history[history.length - 1].opName : undefined}
        />
      </div>
    )
  }

  function renderContent() {
    if (mode === 'menu') {
      return (
        <div className="space-y-6 py-4">
          <p className="text-center text-sm text-gray-500">What would you like to do?</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('gif')}
              className="aspect-square bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors text-center"
            >
              <ImageIcon className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-white">Edit GIF</p>
                <p className="text-xs text-gray-500 mt-1">Trim, crop, resize, add text & effects</p>
              </div>
            </button>
            <button
              onClick={() => setMode('video-to-gif')}
              className="aspect-square bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors text-center"
            >
              <Film className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-white">Video to GIF</p>
                <p className="text-xs text-gray-500 mt-1">Convert MP4, WebM, or MOV to an animated GIF</p>
              </div>
            </button>
            <button
              onClick={() => setMode('video-convert')}
              className="col-span-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors text-center"
            >
              <ArrowLeftRight className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm font-semibold text-white">Convert Video</p>
                <p className="text-xs text-gray-500 mt-1">Convert between MP4, WebM, and MOV — quality & resolution controls</p>
              </div>
            </button>
          </div>
        </div>
      )
    }

    if (mode === 'gif') {
      if (working) return renderGifEditor()
      return (
        <div className="space-y-4">
          <Dropzone
            onFile={handleFile}
            loading={uploading}
            accept=".gif,image/gif"
            helpText="Drop a .gif file here, or click to browse"
          />
          <Toolbar
            meta={DUMMY_META}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            cropSelection={null}
            speedApplied={false}
            effectType={effectType}
            onEffectTypeChange={setEffectType}
            textConfig={textConfig}
            onTextConfigChange={setTextConfig}
            textPos={null}
            onResult={() => {}}
            onError={() => {}}
            disabled={true}
          />
        </div>
      )
    }

    if (mode === 'video-to-gif') {
      if (working) return renderGifEditor()

      if (mp4Pending) {
        return (
          <div className="space-y-4">
            <video
              ref={videoRef}
              src={mp4Pending.previewUrl}
              className="w-full max-h-60 sm:max-h-96 rounded-lg border border-slate-800 object-contain bg-black"
              autoPlay
              muted
            />

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
              <p className="text-sm text-gray-400">
                Convert <span className="text-white font-medium">{mp4Pending.file.name}</span> → GIF
                <span className="text-gray-600 ml-2">({mp4Pending.duration.toFixed(1)}s)</span>
              </p>

              <div>
                <label className="text-xs text-gray-500 block mb-2">Clip range</label>
                <VideoRangeSlider
                  duration={mp4Pending.duration}
                  start={mp4Start}
                  end={mp4End}
                  onChange={(s, e) => { setMp4Start(s); setMp4End(e) }}
                  onCommit={handleRangeCommit}
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-2">Frame rate</label>
                <div className="flex gap-2 items-center flex-wrap">
                  {[5, 10, 15, 24].map((fps) => (
                    <button
                      key={fps}
                      onClick={() => { setMp4Fps(fps); setMp4FpsCustom(false); setMp4FpsRaw('') }}
                      className={`px-3 py-1 rounded text-sm transition-colors ${!mp4FpsCustom && mp4Fps === fps ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`}
                    >
                      {fps} fps
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={60}
                    placeholder="Custom"
                    value={mp4FpsCustom ? mp4FpsRaw : ''}
                    onChange={(e) => { setMp4FpsCustom(true); setMp4FpsRaw(e.target.value) }}
                    className={`w-24 bg-slate-800 border rounded px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none ${mp4FpsCustom ? 'border-blue-500' : 'border-slate-700'}`}
                  />
                </div>
              </div>

              <p className="text-xs text-gray-600">
                ~{Math.max(0, Math.floor((mp4End - mp4Start) * effectiveFps))} frames
              </p>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setMp4HighQuality(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${mp4HighQuality ? 'bg-blue-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${mp4HighQuality ? 'translate-x-4' : ''}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-300">Higher quality</p>
                  <p className="text-xs text-gray-600">Slower — builds a custom color palette per frame</p>
                </div>
              </label>

              <div className="flex gap-3">
                <button
                  onClick={handleMp4Convert}
                  disabled={uploading || mp4End <= mp4Start}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                >
                  {uploading ? 'Converting…' : 'Convert to GIF'}
                </button>
                <button
                  onClick={clearMp4Pending}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }

      // No file yet — show dropzone + locked conversion settings
      return (
        <div className="space-y-4">
          <Dropzone
            onFile={handleFile}
            loading={uploading}
            accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
            helpText="Drop a video file here (.mp4, .webm, .mov)"
          />
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 opacity-50 pointer-events-none select-none">
            <div>
              <label className="text-xs text-gray-500 block mb-2">Clip range</label>
              <div className="h-5 bg-slate-700 rounded-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-2">Frame rate</label>
              <div className="flex gap-2">
                {[5, 10, 15, 24].map((fps) => (
                  <div key={fps} className="px-3 py-1 rounded text-sm bg-slate-800 text-gray-400">{fps} fps</div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-5 rounded-full bg-slate-700">
                <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
              </div>
              <div>
                <p className="text-sm text-gray-300">Higher quality</p>
                <p className="text-xs text-gray-600">Slower — builds a custom color palette per frame</p>
              </div>
            </div>
            <div className="w-full bg-slate-800 rounded-lg px-4 py-2 text-sm font-medium text-white text-center">Convert to GIF</div>
          </div>
        </div>
      )
    }

    // mode === 'video-convert'
    if (videoResult) {
      return (
        <div className="space-y-4">
          <video
            src={videoResult.url}
            className="w-full max-h-60 sm:max-h-96 rounded-lg border border-slate-800 object-contain bg-black"
            controls
            autoPlay
            muted
          />
          <p className="text-center text-sm text-gray-400">
            <span className="text-white font-medium">{videoResult.filename}</span>
            <span className="text-gray-600 ml-2">({fmtSize(videoResult.size)})</span>
          </p>
          <ExportBar
            downloadHref={videoResult.url}
            downloadFilename={videoResult.filename}
            downloadLabel={`Download ${videoResult.format.toUpperCase()}`}
            onReset={reset}
          />
        </div>
      )
    }

    if (mp4Pending) {
      return (
        <VideoConvertPanel
          file={mp4Pending.file}
          duration={mp4Pending.duration}
          hasAudio={mp4Pending.hasAudio}
          previewUrl={mp4Pending.previewUrl}
          onResult={(result) => {
            setVideoResult(result)
            clearMp4Pending()
          }}
          onCancel={clearMp4Pending}
          onError={setError}
        />
      )
    }

    // No file yet — show dropzone + locked format selectors
    return (
      <div className="space-y-4">
        <Dropzone
          onFile={handleFile}
          loading={uploading}
          accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
          helpText="Drop a video file here (.mp4, .webm, .mov)"
        />
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 opacity-50 pointer-events-none select-none">
          <div>
            <label className="text-xs text-gray-500 block mb-2">Output format</label>
            <div className="flex gap-2">
              {['MP4', 'WebM', 'MOV'].map((f) => (
                <div key={f} className="px-3 py-1 rounded text-sm bg-slate-800 text-gray-400">{f}</div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-2">Quality</label>
            <div className="flex gap-2">
              {['Low', 'Medium', 'High'].map((q) => (
                <div key={q} className="px-3 py-1 rounded text-sm bg-slate-800 text-gray-400">{q}</div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-2">Resolution</label>
            <div className="flex gap-2">
              {['Original', '1080p', '720p', '480p'].map((r) => (
                <div key={r} className="px-3 py-1 rounded text-sm bg-slate-800 text-gray-400">{r}</div>
              ))}
            </div>
          </div>
          <div className="w-full bg-blue-600 rounded-lg px-4 py-2 text-sm font-medium text-white text-center">Convert video</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex justify-center">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            gi<span className="text-blue-400">free</span>
          </h1>
        </div>
      </header>

      <div className="text-center py-2 text-xs text-gray-600">
        Everything runs locally in your browser — no uploads, no servers.
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-4">
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {mode !== 'menu' && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {renderContent()}
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center">
        <p className="text-sm text-gray-600">
          Bug or feature request?{' '}
          <a href="mailto:app@gifree.cc" className="text-gray-500 hover:text-gray-400 transition-colors">app@gifree.cc</a>
          {' · '}
          Built by <a href="https://devami.cc" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 transition-colors">devami.cc</a>
          {' · '}
          <a href="https://github.com/ikan31/gifree.cc" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 transition-colors">Open Source</a>
        </p>
      </footer>
    </div>
  )
}
