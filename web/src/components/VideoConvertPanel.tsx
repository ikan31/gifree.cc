import { useState, useEffect, useRef } from 'react'
import { convertVideo, cancelConversion, onStatus, VideoConvertResult } from '../ffmpegApi'
import VideoRangeSlider from './VideoRangeSlider'

interface Props {
  file: File
  duration: number
  hasAudio: boolean
  previewUrl: string
  onResult: (result: VideoConvertResult & { filename: string }) => void
  onCancel: () => void
  onError: (msg: string) => void
}

type Format = 'mp4' | 'webm' | 'mov'
type Quality = 'low' | 'medium' | 'high'
type Resolution = 'original' | '1080p' | '720p' | '480p'

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

function defaultOutputFormat(inputName: string): Format {
  const ext = inputName.split('.').pop()?.toLowerCase()
  if (ext === 'mp4' || ext === 'mov') return 'webm'
  return 'mp4'
}

const btn = (active: boolean) =>
  `px-3 py-1 rounded text-sm transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-400 hover:bg-slate-700'}`

export default function VideoConvertPanel({ file, duration, hasAudio, previewUrl, onResult, onCancel, onError }: Props) {
  const [format, setFormat] = useState<Format>(defaultOutputFormat(file.name))
  const [quality, setQuality] = useState<Quality>('medium')
  const [resolution, setResolution] = useState<Resolution>('original')
  const [includeAudio, setIncludeAudio] = useState(hasAudio)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(Math.round(duration * 10) / 10)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [ffmpegStatus, setFfmpegStatus] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    return onStatus((status) => setFfmpegStatus(status))
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => {
      if (video.currentTime >= trimEnd) video.currentTime = trimStart
    }
    const onEnded = () => {
      video.currentTime = trimStart
      video.play()
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [trimStart, trimEnd])

  function handleRangeCommit(start: number) {
    const video = videoRef.current
    if (!video) return
    video.currentTime = start
    video.play()
  }

  async function handleConvert() {
    setConverting(true)
    setProgress(0)
    try {
      const isTrimmed = trimStart > 0 || trimEnd < duration
      const result = await convertVideo(
        {
          inputFile: file,
          outputFormat: format,
          quality,
          resolution,
          includeAudio,
          trimStart: isTrimmed ? trimStart : undefined,
          trimEnd: isTrimmed ? trimEnd : undefined,
          totalDuration: duration,
        },
        (p) => setProgress(p),
      )
      const baseName = file.name.replace(/\.[^.]+$/, '')
      onResult({ ...result, filename: `${baseName}.${format}` })
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'Conversion cancelled') return
      onError(e instanceof Error ? e.message : String(e))
    } finally {
      setConverting(false)
      setProgress(null)
      setFfmpegStatus(null)
    }
  }

  function handleCancel() {
    if (converting) {
      cancelConversion()
      setConverting(false)
      setProgress(null)
    }
    onCancel()
  }

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        src={previewUrl}
        className="w-full max-h-60 sm:max-h-96 rounded-lg border border-slate-800 object-contain bg-black"
        autoPlay
        muted
      />

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <p className="text-sm text-gray-400">
          Convert <span className="text-white font-medium">{file.name}</span>
          <span className="text-gray-600 ml-2">({fmtSize(file.size)})</span>
        </p>

        <div>
          <label className="text-xs text-gray-500 block mb-2">Clip range</label>
          <VideoRangeSlider
            duration={duration}
            start={trimStart}
            end={trimEnd}
            onChange={(s, e) => { setTrimStart(s); setTrimEnd(e) }}
            onCommit={(s) => handleRangeCommit(s)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-2">Output format</label>
          <div className="flex gap-2 flex-wrap">
            {(['mp4', 'webm', 'mov'] as Format[]).map((f) => (
              <button key={f} onClick={() => setFormat(f)} className={btn(format === f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-2">Quality</label>
          <div className="flex gap-2 flex-wrap">
            {(['low', 'medium', 'high'] as Quality[]).map((q) => (
              <button key={q} onClick={() => setQuality(q)} className={btn(quality === q)}>
                {q.charAt(0).toUpperCase() + q.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-2">Resolution</label>
          <div className="flex gap-2 flex-wrap">
            {(['original', '1080p', '720p', '480p'] as Resolution[]).map((r) => (
              <button key={r} onClick={() => setResolution(r)} className={btn(resolution === r)}>
                {r === 'original' ? 'Original' : r}
              </button>
            ))}
          </div>
        </div>

        {hasAudio ? (
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setIncludeAudio((v) => !v)}
              className={`relative w-9 h-5 rounded-full transition-colors ${includeAudio ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${includeAudio ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <p className="text-sm text-gray-300">Include audio</p>
            </div>
          </label>
        ) : (
          <p className="text-xs text-gray-600">No audio track detected</p>
        )}

        {converting && (
          <div className="space-y-2">
            {ffmpegStatus === 'loading' && (
              <p className="text-xs text-gray-500">Loading ffmpeg (first time may take a moment)...</p>
            )}
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 text-right">{Math.round((progress ?? 0) * 100)}%</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleConvert}
            disabled={converting}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {converting ? 'Converting...' : `Convert to ${format.toUpperCase()}`}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
