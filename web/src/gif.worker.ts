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
  resolveReady()
}

WebAssembly.instantiateStreaming(fetch('/gifree.wasm'), go.importObject)
  .then((result) => { go.run(result.instance) })

self.onmessage = async (e) => {
  await readyPromise

  const { msgId, op, args } = e.data

  try {
    let result: any

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

    if (!result.ok) throw new Error(result.error)

    // Store a copy before transferring the buffer
    const id = newId()
    blobs.set(id, new Uint8Array(result.bytes))

    self.postMessage(
      { msgId, ok: true, id, meta: { type: 'gif', frames: result.frames, width: result.width, height: result.height, size: result.size } },
      [result.bytes.buffer] as any,
    )
  } catch (err: any) {
    self.postMessage({ msgId, ok: false, error: err?.message ?? String(err) })
  }
}
