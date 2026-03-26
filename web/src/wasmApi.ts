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

// Restore WASM state from a previously stored blob (used for undo)
export async function restoreId(id: string): Promise<OpResult> {
  return call('restoreId', { id })
}

// Returns a blob: URL for the given id (preview or download)
export async function blobUrl(id: string): Promise<string> {
  const res = await call('getBytes', { id })
  const blob = new Blob([res.bytes], { type: 'image/gif' })
  return URL.createObjectURL(blob)
}
