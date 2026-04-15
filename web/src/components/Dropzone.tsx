import { useRef, useState, DragEvent } from 'react'
import { Upload } from 'lucide-react'

interface Props {
  onFile: (file: File) => void
  loading: boolean
  accept?: string
  helpText?: string
}

export default function Dropzone({ onFile, loading, accept = '.gif,.mp4,.webm,.mov,video/mp4,video/webm,video/quicktime', helpText }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 sm:p-12 cursor-pointer transition-colors
        ${dragging ? 'border-blue-400 bg-blue-950/30' : 'border-slate-700 hover:border-gray-500'}
        ${loading ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <Upload className="w-10 h-10 text-gray-500 mb-3" />
      <p className="text-gray-400 text-sm">
        {loading ? 'Loading…' : 'Drop a file here, or click to browse'}
      </p>
      <p className="text-gray-600 text-xs mt-1">{helpText ?? '.gif · .mp4 · .webm · .mov'}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
