import { Download, RotateCcw, Undo2 } from 'lucide-react'

interface Props {
  downloadHref: string
  downloadFilename?: string
  downloadLabel?: string
  onReset: () => void
  onResetEdits?: () => void
  onUndo?: () => void
  undoLabel?: string
}

export default function ExportBar({ downloadHref, downloadFilename, downloadLabel, onReset, onResetEdits, onUndo, undoLabel }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <a
        href={downloadHref}
        download={downloadFilename || 'gifree.gif'}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition-colors"
      >
        <Download className="w-4 h-4" />
        {downloadLabel || 'Download GIF'}
      </a>
      {onUndo && (
        <button
          onClick={onUndo}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-gray-400 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
          Undo {undoLabel}
        </button>
      )}
      {onResetEdits && (
        <button
          onClick={onResetEdits}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-gray-400 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset edits
        </button>
      )}
    </div>
  )
}
