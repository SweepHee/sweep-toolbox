import { Minus, Square, X } from 'lucide-react';

export default function TitleBar() {
  const isMac = window.electronAPI?.platform === 'darwin';

  return (
    <div
      className="flex items-center justify-between h-10 px-4 bg-[#0d0d1a] border-b border-white/5 shrink-0"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <span className="text-sm font-semibold text-white/60 tracking-wide">
        간편변환기
      </span>

      {!isMac && (
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <Square size={12} />
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
