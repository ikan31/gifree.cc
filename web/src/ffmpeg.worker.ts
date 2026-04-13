import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let currentMsgId: string | null = null
let currentExpectedDuration: number | null = null

// CRF values per codec family — lower = better quality, bigger file
// libx264: 0–51, default 23. libvpx: 4–63, default 10 (quality scale differs).
const CRF: Record<string, Record<string, number>> = {
  mp4:  { low: 35, medium: 23, high: 18 },
  webm: { low: 40, medium: 25, high: 15 },
  mov:  { low: 35, medium: 23, high: 18 },
}

// libvpx (VP8) is reliable in single-threaded ffmpeg.wasm.
// libvpx-vp9 causes memory-out-of-bounds crashes in this build.
const CODECS: Record<string, { video: string; audio: string }> = {
  mp4:  { video: 'libx264',  audio: 'aac' },
  webm: { video: 'libvpx',   audio: 'libvorbis' },
  mov:  { video: 'libx264',  audio: 'aac' },
}

const RESOLUTION: Record<string, number> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
}

async function ensureLoaded(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
  ffmpeg.on('log', ({ message }) => {
    console.log(`[gifree] ffmpeg: ${message}`)
  })
  ffmpeg.on('progress', ({ progress, time }) => {
    if (currentMsgId) {
      let p = progress
      // When trimming, ffmpeg's progress ratio is based on the full input duration
      // which is wrong. Use the time field (microseconds processed) against the
      // expected clip duration instead.
      if (currentExpectedDuration && currentExpectedDuration > 0 && time > 0) {
        p = (time / 1_000_000) / currentExpectedDuration
      }
      self.postMessage({ msgId: currentMsgId, progress: Math.max(0, Math.min(1, p)) })
    }
  })
  self.postMessage({ type: 'status', status: 'loading' })
  const baseURL = self.location.origin + '/ffmpeg'
  const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript')
  const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
  await ffmpeg.load({ coreURL, wasmURL })
  self.postMessage({ type: 'status', status: 'ready' })
  return ffmpeg
}

function buildArgs(
  inputName: string,
  outputName: string,
  format: string,
  quality: string,
  resolution: string,
  includeAudio: boolean,
  trimStart?: number,
  trimEnd?: number,
): string[] {
  const codec = CODECS[format]
  const crf = CRF[format][quality]

  // -ss before -i for fast seek
  const args: string[] = []
  if (trimStart != null && trimStart > 0) {
    args.push('-ss', String(trimStart))
  }
  args.push('-i', inputName)
  if (trimEnd != null) {
    args.push('-to', String(trimEnd - (trimStart ?? 0)))
  }

  // Video codec + quality
  args.push('-c:v', codec.video)
  if (format === 'webm') {
    // libvpx uses -crf + -b:v 0 for constant quality mode
    args.push('-crf', String(crf), '-b:v', '0')
  } else {
    // libx264 uses -crf + -preset for quality/speed tradeoff
    args.push('-crf', String(crf), '-preset', 'medium')
    // Required for browser playback
    args.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart')
  }

  // Resolution scaling (only downscale)
  if (resolution !== 'original' && RESOLUTION[resolution]) {
    // scale=-2:H keeps aspect ratio, -2 ensures width is divisible by 2
    args.push('-vf', `scale=-2:${RESOLUTION[resolution]}`)
  }

  // Audio
  if (includeAudio) {
    args.push('-c:a', codec.audio)
  } else {
    args.push('-an')
  }

  args.push(outputName)
  return args
}

self.onmessage = async (e: MessageEvent) => {
  const { msgId, op, args } = e.data

  if (op === 'convert') {
    currentMsgId = msgId
    try {
      const ff = await ensureLoaded()
      const { inputBytes, inputExt, outputFormat, quality, resolution, includeAudio, trimStart, trimEnd, totalDuration } = args
      // Calculate expected output duration for accurate progress
      if (trimStart != null && trimEnd != null) {
        currentExpectedDuration = trimEnd - trimStart
      } else {
        currentExpectedDuration = totalDuration || null
      }
      const inputName = `input.${inputExt}`
      const outputName = `output.${outputFormat}`

      await ff.writeFile(inputName, new Uint8Array(inputBytes))
      const execArgs = buildArgs(inputName, outputName, outputFormat, quality, resolution, includeAudio, trimStart, trimEnd)

      console.log(`[gifree] ffmpeg exec: ${execArgs.join(' ')}`)
      await ff.exec(execArgs)

      const data = await ff.readFile(outputName)
      const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string)

      // Clean up virtual FS
      await ff.deleteFile(inputName)
      await ff.deleteFile(outputName)

      self.postMessage(
        { msgId, ok: true, bytes, outputFormat },
        { transfer: [bytes.buffer] },
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[gifree] ffmpeg error:`, message)
      self.postMessage({ msgId, ok: false, error: message })
    } finally {
      currentMsgId = null
    }
  }
}
