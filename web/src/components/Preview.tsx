function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

interface Props {
  src: string
  frames?: number
  width?: number
  height?: number
  size?: number
}

export default function Preview({ src, frames, width, height, size }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <img
        key={src}
        src={src}
        alt="GIF preview"
        className="max-h-60 sm:max-h-96 max-w-full rounded-lg border border-gray-800 object-contain"
      />
      {(frames != null || (width != null && height != null) || size != null) && (
        <p className="text-gray-500 text-xs">
          {[
            width != null && height != null ? `${width}×${height}` : null,
            frames != null ? `${frames} frames` : null,
            size != null ? fmtSize(size) : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}
