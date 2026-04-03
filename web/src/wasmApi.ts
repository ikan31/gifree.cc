import GifWorker from './gif.worker?worker'

export interface FileMeta {
  type: 'gif'
  frames?: number
  width?: number
  height?: number
  size?: number
}

export interface OpResult {
  id: string
  meta: FileMeta
}

const worker = new GifWorker()
let msgCounter = 0
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()

worker.onmessage = (e: MessageEvent) => {
  const { msgId, ok, ...rest } = e.data
  const p = pending.get(msgId)
  if (!p) return
  pending.delete(msgId)
  if (ok) p.resolve(rest)
  else p.reject(new Error(rest.error))
}

function call(op: string, args: Record<string, any>, transfer?: Transferable[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const msgId = ++msgCounter
    pending.set(msgId, { resolve, reject })
    worker.postMessage({ msgId, op, args }, transfer ?? [])
  })
}

export async function load(file: File): Promise<OpResult> {
  console.log(`[gifree] load file: name="${file.name}" size=${fmtSize(file.size)} type="${file.type}"`)
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  return call('load', { bytes }, [bytes.buffer])
}

export async function trim(start: number, end: number): Promise<OpResult> {
  return call('trim', { start, end })
}

export async function crop(x: number, y: number, width: number, height: number): Promise<OpResult> {
  return call('crop', { x, y, width, height })
}

export async function speed(factor: number): Promise<OpResult> {
  return call('speed', { factor })
}

export async function addText(text: string, size: number, color: string, font: string, x: number, y: number): Promise<OpResult> {
  return call('text', { text, size, color, font, x, y })
}

export async function applyEffect(type: 'grayscale' | 'deepfry'): Promise<OpResult> {
  return call('effect', { type })
}

export async function resize(width: number, height: number): Promise<OpResult> {
  return call('resize', { width, height })
}

export async function reverse(): Promise<OpResult> {
  return call('reverse', {})
}

export type TransformType = 'fliph' | 'flipv' | 'rotate90cw' | 'rotate90ccw' | 'rotate180'

export async function applyTransform(type: TransformType): Promise<OpResult> {
  return call('transform', { type })
}

// Restore WASM state from a previously stored blob (used for undo)
export async function restoreId(id: string): Promise<OpResult> {
  return call('restoreId', { id })
}

// Returns the duration of a video file in seconds.
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    })
    video.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video metadata'))
    })
  })
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    video.currentTime = time
    video.addEventListener('seeked', () => resolve(), { once: true })
  })
}

async function extractMP4Frames(
  file: File,
  fps: number,
  startSec: number,
  endSec: number,
): Promise<{ flat: Uint8Array; width: number; height: number; frameCount: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.preload = 'auto'

    video.addEventListener('loadedmetadata', async () => {
      try {
        const { videoWidth: width, videoHeight: height } = video
        if (width === 0 || height === 0) {
          console.error(`[gifree] extractMP4Frames error: could not read video dimensions (got ${width}×${height}) — file may be corrupt or use an unsupported codec`)
          URL.revokeObjectURL(url)
          reject(new Error('Could not read video dimensions — the file may be corrupt or use an unsupported codec'))
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!

        const times: number[] = []
        const interval = 1 / fps
        for (let t = startSec; t < endSec; t += interval) {
          times.push(t)
        }

        const frameSize = width * height * 4
        const flat = new Uint8Array(times.length * frameSize)

        const t0 = performance.now()
        for (let i = 0; i < times.length; i++) {
          await seekTo(video, times[i])
          ctx.drawImage(video, 0, 0)
          const imageData = ctx.getImageData(0, 0, width, height)
          flat.set(imageData.data, i * frameSize)
        }
        console.log(`[gifree] frame extraction: ${times.length} frames in ${(performance.now() - t0).toFixed(0)}ms`)

        URL.revokeObjectURL(url)
        resolve({ flat, width, height, frameCount: times.length })
      } catch (e) {
        URL.revokeObjectURL(url)
        reject(e)
      }
    })

    video.addEventListener('error', () => {
      console.error(`[gifree] extractMP4Frames error: failed to load video name="${file.name}" type="${file.type}"`)
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    })
  })
}

export async function loadMP4(file: File, fps: number, startSec: number, endSec: number): Promise<OpResult> {
  if (fps < 1 || fps > 60) {
    console.error(`[gifree] loadMP4 error: frame rate must be between 1 and 60 (got ${fps})`)
    throw new Error('frame rate must be between 1 and 60')
  }
  console.log(`[gifree] load video: name="${file.name}" size=${fmtSize(file.size)} type="${file.type}" fps=${fps} range=${startSec.toFixed(2)}s–${endSec.toFixed(2)}s`)
  const { flat, width, height, frameCount } = await extractMP4Frames(file, fps, startSec, endSec)
  return call('fromFrames', { flat, width, height, frameCount, fps }, [flat.buffer])
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

// Returns a blob: URL for the given id (preview or download)
export async function blobUrl(id: string): Promise<string> {
  const res = await call('getBytes', { id })
  const blob = new Blob([res.bytes], { type: 'image/gif' })
  return URL.createObjectURL(blob)
}
