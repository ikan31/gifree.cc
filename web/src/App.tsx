import { useEffect, useRef, useState } from 'react'
import { load, restoreId, blobUrl, FileMeta, OpResult } from './wasmApi'

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

function GifInfo({ meta }: { meta: FileMeta }) {
  const parts = []
  if (meta.width && meta.height) parts.push(`${meta.width}×${meta.height}`)
  if (meta.frames) parts.push(`${meta.frames} frames`)
  if (meta.size) parts.push(fmtSize(meta.size))
  if (parts.length === 0) return null
  return <p className="text-gray-500 text-xs">{parts.join(' · ')}</p>
}
import Dropzone from './components/Dropzone'
import Preview from './components/Preview'
import Toolbar, { Tab, TextConfig } from './components/Toolbar'
import ExportBar from './components/ExportBar'
import CropOverlay, { CropBox } from './components/CropOverlay'
import TextOverlay from './components/TextOverlay'

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
  const [activeTab, setActiveTab] = useState<Tab>('trim')
  const [cropBox, setCropBox] = useState<CropBox | null>(null)
  const [effectType, setEffectType] = useState<'grayscale' | 'deepfry'>('grayscale')
  const [textConfig, setTextConfig] = useState<TextConfig>({ text: '', color: 'white', font: 'regular' })
  const [textPos, setTextPos] = useState<{ x: number; y: number; size: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Revoke old blob URLs when they're no longer needed
  const prevSrcsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    return () => {
      prevSrcsRef.current.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  async function makeFileState(result: OpResult): Promise<FileState> {
    const src = await blobUrl(result.id)
    prevSrcsRef.current.add(src)
    return { id: result.id, meta: result.meta, src }
  }

  async function handleFile(file: File) {
    setError(null)
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

  const opNames = history.map((h) => h.opName)
  const speedApplied = opNames.some((n) => n.includes('Speed'))
  const showCropOverlay = activeTab === 'crop' && working?.meta.type === 'gif'
  const showTextOverlay = activeTab === 'text' && working?.meta.type === 'gif'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex justify-center">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            gi<span className="text-indigo-400">free</span>
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

        {!working ? (
          <Dropzone onFile={handleFile} loading={uploading} />
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
                            className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-gray-800 object-contain block"
                            onLoad={() => setCropBox(null)} />
                          <CropOverlay key={working!.id} imgRef={imgRef} onChange={setCropBox} />
                        </div>
                        <GifInfo meta={working!.meta} />
                      </div>
                    ) : showTextOverlay ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="relative" key={working!.id}>
                          <img ref={imgRef} src={working!.src}
                            className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-gray-800 object-contain block" />
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
                        className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-gray-800 object-contain block"
                        onLoad={() => setCropBox(null)} />
                      <CropOverlay key={working!.id} imgRef={imgRef} onChange={setCropBox} />
                    </div>
                    <GifInfo meta={working!.meta} />
                  </div>
                ) : showTextOverlay ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative" key={working!.id}>
                      <img ref={imgRef} src={working!.src}
                        className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-gray-800 object-contain block" />
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
                      <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 text-xs">
                        {step}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <Toolbar
                key={working.id}
                meta={working.meta}
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
                downloadHref={working.src}
                onReset={reset}
                onResetEdits={history.length > 0 ? resetEdits : undefined}
                onUndo={history.length > 0 ? undo : undefined}
                undoLabel={history.length > 0 ? history[history.length - 1].opName : undefined}
              />
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-4 text-center">
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
