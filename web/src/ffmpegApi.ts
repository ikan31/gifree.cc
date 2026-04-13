import FfmpegWorker from './ffmpeg.worker?worker'

export interface VideoConvertOptions {
  inputFile: File
  outputFormat: 'mp4' | 'webm' | 'mov'
  quality: 'low' | 'medium' | 'high'
  resolution: 'original' | '1080p' | '720p' | '480p'
  includeAudio: boolean
  trimStart?: number  // seconds
  trimEnd?: number    // seconds
  totalDuration?: number // full video duration in seconds, for progress accuracy
}

export interface VideoConvertResult {
  blob: Blob
  url: string
  size: number
  format: string
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

let worker: Worker | null = null
let msgCounter = 0
const pending = new Map<string, {
  resolve: (v: VideoConvertResult) => void
  reject: (e: Error) => void
  onProgress?: (p: number) => void
}>()
let statusListeners: ((status: string) => void)[] = []

function getWorker(): Worker {
  if (!worker) {
    worker = new FfmpegWorker()
    worker.onmessage = (e: MessageEvent) => {
      const data = e.data

      // Status messages (loading/ready) have no msgId
      if (data.type === 'status') {
        statusListeners.forEach((fn) => fn(data.status))
        return
      }

      const entry = pending.get(data.msgId)
      if (!entry) return

      // Progress update (not final)
      if (data.progress !== undefined && !data.ok && !data.error) {
        entry.onProgress?.(data.progress)
        return
      }

      pending.delete(data.msgId)

      if (!data.ok) {
        entry.reject(new Error(data.error || 'Conversion failed'))
        return
      }

      const bytes = data.bytes as Uint8Array
      const format = data.outputFormat as string
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: MIME[format] || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      entry.resolve({ blob, url, size: bytes.byteLength, format })
    }
  }
  return worker
}

export function onStatus(fn: (status: string) => void): () => void {
  statusListeners.push(fn)
  return () => {
    statusListeners = statusListeners.filter((l) => l !== fn)
  }
}

export async function convertVideo(
  options: VideoConvertOptions,
  onProgress?: (progress: number) => void,
): Promise<VideoConvertResult> {
  const w = getWorker()
  const msgId = String(++msgCounter)

  const inputBytes = await options.inputFile.arrayBuffer()
  const inputExt = options.inputFile.name.split('.').pop()?.toLowerCase() || 'mp4'

  return new Promise<VideoConvertResult>((resolve, reject) => {
    pending.set(msgId, { resolve, reject, onProgress })
    w.postMessage(
      {
        msgId,
        op: 'convert',
        args: {
          inputBytes,
          inputExt,
          outputFormat: options.outputFormat,
          quality: options.quality,
          resolution: options.resolution,
          includeAudio: options.includeAudio,
          trimStart: options.trimStart,
          trimEnd: options.trimEnd,
          totalDuration: options.totalDuration,
        },
      },
      [inputBytes],
    )
  })
}

export function cancelConversion(): void {
  if (worker) {
    worker.terminate()
    worker = null
    // Reject all pending
    for (const [, entry] of pending) {
      entry.reject(new Error('Conversion cancelled'))
    }
    pending.clear()
  }
}
