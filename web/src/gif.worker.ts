// Loads Go WASM and handles all GIF processing in a background thread.
// The main thread never touches the WASM binary directly.
export {}

// wasm_exec.js is not an ES module so we fetch and eval it instead of importing
const wasmExecSrc = await fetch('/wasm_exec.js').then((r) => r.text())
// eslint-disable-next-line no-eval
;(0, eval)(wasmExecSrc)

declare const Go: any

const go = new Go()

// Blob store: id → bytes (for preview, download, and undo restore)
const blobs = new Map<string, Uint8Array>()
let blobCounter = 0

function newId(): string {
  return String(++blobCounter)
}

// Ready promise — resolved when Go main() calls gifWASMReady
let resolveReady!: () => void
const readyPromise = new Promise<void>((r) => { resolveReady = r })

;(self as any).gifWASMReady = () => {
  console.log('[gifree] WASM ready')
  resolveReady()
}

WebAssembly.instantiateStreaming(fetch('/gifree.wasm'), go.importObject)
  .then((result) => { go.run(result.instance) })

self.onmessage = async (e) => {
  await readyPromise

  const { msgId, op, args } = e.data

  try {
    let result: any
    const t0 = performance.now()

    if (op === 'load') {
      result = (self as any).gifLoad(args.bytes)
    } else if (op === 'trim') {
      result = (self as any).gifTrim(args.start, args.end)
    } else if (op === 'crop') {
      result = (self as any).gifCrop(args.x, args.y, args.width, args.height)
    } else if (op === 'speed') {
      result = (self as any).gifSpeed(args.factor)
    } else if (op === 'text') {
      result = (self as any).gifText(args.text, args.size, args.color, args.font, args.x, args.y)
    } else if (op === 'effect') {
      result = (self as any).gifEffect(args.type)
    } else if (op === 'resize') {
      result = (self as any).gifResize(args.width, args.height)
    } else if (op === 'fromFrames') {
      result = (self as any).gifFromFrames(args.flat, args.width, args.height, args.frameCount, args.fps)
    } else if (op === 'reverse') {
      result = (self as any).gifReverse()
    } else if (op === 'transform') {
      result = (self as any).gifTransform(args.type)
    } else if (op === 'restoreId') {
      // Restore WASM state from a previously stored blob (for undo)
      const stored = blobs.get(args.id)
      if (!stored) throw new Error('blob not found')
      result = (self as any).gifLoad(stored)
    } else if (op === 'getBytes') {
      const stored = blobs.get(args.id)
      if (!stored) throw new Error('blob not found')
      const copy = new Uint8Array(stored)
      self.postMessage({ msgId, ok: true, bytes: copy }, [copy.buffer] as any)
      return
    } else {
      throw new Error(`unknown op: ${op}`)
    }

    const elapsed = (performance.now() - t0).toFixed(0)

    if (!result.ok) {
      console.error(`[gifree] op=${op} error="${result.error}"`, opLogArgs(op, args))
      throw new Error(result.error)
    }

    // Store a copy before transferring the buffer
    const id = newId()
    blobs.set(id, new Uint8Array(result.bytes))

    console.log(`[gifree] op=${op} ${elapsed}ms → ${result.frames ?? '?'} frames ${result.width ?? '?'}×${result.height ?? '?'} ~${fmtSize(result.size)}`, opLogArgs(op, args))

    self.postMessage(
      { msgId, ok: true, id, meta: { type: 'gif', frames: result.frames, width: result.width, height: result.height, size: result.size } },
      [result.bytes.buffer] as any,
    )
  } catch (err: any) {
    console.error(`[gifree] op=${op} threw:`, err?.message ?? String(err))
    self.postMessage({ msgId, ok: false, error: err?.message ?? String(err) })
  }
}

function opLogArgs(op: string, args: Record<string, any>): Record<string, any> {
  switch (op) {
    case 'load': return { size: args.bytes?.length }
    case 'trim': return { start: args.start, end: args.end }
    case 'crop': return { x: args.x, y: args.y, width: args.width, height: args.height }
    case 'speed': return { factor: args.factor }
    case 'text': return { text: args.text, size: args.size, color: args.color, font: args.font, x: args.x, y: args.y }
    case 'effect': return { type: args.type }
    case 'resize': return { width: args.width, height: args.height }
    case 'fromFrames': return { frameCount: args.frameCount, width: args.width, height: args.height, fps: args.fps }
    case 'transform': return { type: args.type }
    case 'reverse': return {}
    default: return {}
  }
}

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}
