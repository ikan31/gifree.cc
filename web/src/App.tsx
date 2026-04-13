import { useEffect, useRef, useState } from 'react'
import { load, loadMP4, getVideoDuration, getVideoHasAudio, restoreId, blobUrl, FileMeta, OpResult } from './wasmApi'

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

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

interface FileState {
  id: string
  meta: FileMeta
  src: string  // blob: URL for preview/download
}

interface HistoryEntry {
  state: FileState
  opName: string
}

export default function App() {
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
  const [videoMode, setVideoMode] = useState<'gif' | 'video' | null>(null)
  const [videoResult, setVideoResult] = useState<{ url: string; filename: string; size: number; format: string } | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('trim')
  const [cropBox, setCropBox] = useState<CropBox | null>(null)
  const [effectType, setEffectType] = useState<'grayscale' | 'deepfry'>('grayscale')
  const [textConfig, setTextConfig] = useState<TextConfig>({ text: '', color: 'white', font: 'regular' })
  const [textPos, setTextPos] = useState<{ x: number; y: number; size: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Revoke old blob URLs when they're no longer needed
  const prevSrcsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    return () => {
      prevSrcsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  function clearMp4Pending() {
    if (mp4Pending?.previewUrl) URL.revokeObjectURL(mp4Pending.previewUrl)
    setMp4Pending(null)
    setVideoMode(null)
  }

  async function makeFileState(result: OpResult): Promise<FileState> {
    const src = await blobUrl(result.id)
    prevSrcsRef.current.add(src)
    return { id: result.id, meta: result.meta, src }
  }

  async function handleFile(file: File) {
    setError(null)
    if (file.type.startsWith('video/') || ['.mp4', '.webm', '.mov'].some((ext) => file.name.toLowerCase().endsWith(ext))) {
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
    // Restore WASM state to the previous snapshot
    try {
      await restoreId(prev.state.id)
    } catch {
      // If the blob is gone just restore the UI state anyway
    }
    setWorking(prev.state)
    setHistory((h) => h.slice(0, -1))
    setCropBox(null)
  }

  function reset() {
    setOriginal(null)
    setWorking(null)
    setHistory([])
    setError(null)
    setCropBox(null)
    clearMp4Pending()
    if (videoResult?.url) URL.revokeObjectURL(videoResult.url)
    setVideoResult(null)
  }

  async function resetEdits() {
    if (!original) return
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex justify-center">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            gi<span className="text-blue-400">free</span>
          </h1>
          <p className="text-sm text-gray-600 tracking-wide">simple, server-free gif editing</p>
        </div>
      </header>

      <div className="text-center py-2 text-xs text-gray-600">
        Everything runs locally in your browser — no uploads, no servers.
      </div>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-950/50 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {videoResult ? (
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
        ) : !working && !mp4Pending ? (
          <Dropzone onFile={handleFile} loading={uploading} />
        ) : !working && mp4Pending && videoMode === null ? (
          <div className="space-y-4">
            <video
              src={mp4Pending.previewUrl}
              className="w-full max-h-60 sm:max-h-96 rounded-lg border border-slate-800 object-contain bg-black"
              autoPlay
              muted
              loop
            />
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <p className="text-sm text-gray-400">
                <span className="text-white font-medium">{mp4Pending.file.name}</span>
                <span className="text-gray-600 ml-2">({mp4Pending.duration.toFixed(1)}s · {fmtSize(mp4Pending.file.size)})</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setVideoMode('gif')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-4 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-white">Convert to GIF</p>
                  <p className="text-xs text-gray-500 mt-1">Animated image with trim &amp; edit tools</p>
                </button>
                <button
                  onClick={() => setVideoMode('video')}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-4 text-left transition-colors"
                >
                  <p className="text-sm font-medium text-white">Convert video</p>
                  <p className="text-xs text-gray-500 mt-1">MP4, WebM, or MOV with quality settings</p>
                </button>
              </div>
              <button
                onClick={clearMp4Pending}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !working && mp4Pending && videoMode === 'video' ? (
          <VideoConvertPanel
            file={mp4Pending.file}
            duration={mp4Pending.duration}
            hasAudio={mp4Pending.hasAudio}
            previewUrl={mp4Pending.previewUrl}
            onResult={(result) => {
              setVideoResult(result)
              clearMp4Pending()
            }}
            onCancel={() => setVideoMode(null)}
            onError={setError}
          />
        ) : !working && mp4Pending && videoMode === 'gif' ? (
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
                  onClick={() => setVideoMode(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Side-by-side preview: original vs current edit */}
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
          </>
        )}
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center">
        <p className="text-sm text-gray-600">
          Bug or feature request?{' '}
          <a href="mailto:app@gifree.cc" className="text-gray-500 hover:text-gray-400 transition-colors">app@gifree.cc</a>
          {' · '}
          Built by <a href="https://devami.cc" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 transition-colors">devami.cc</a>
          {' · '}
          <a href="https://github.com/ikan31/gifree.cc" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-400 transition-colors">GitHub</a>
        </p>
      </footer>
    </div>
  )
}

