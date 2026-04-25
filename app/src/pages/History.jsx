import { FolderOpen, Save, Trash2, Clock } from 'lucide-react';
import { useConverterStore } from '@/store';
import Tooltip from '@/components/common/Tooltip';

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function History() {
  const history = useConverterStore(s => s.history);
  const clearHistory = useConverterStore(s => s.clearHistory);

  const openFolder = (outputPath) => {
    window.electronAPI?.openPath(outputPath);
  };

  const saveAs = async (entry) => {
    await window.electronAPI?.saveAs({
      sourcePath: entry.outputPath,
      defaultName: entry.outputName,
    });
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">변환 이력</h1>
          <p className="text-white/40 text-sm mt-1">최근 변환 기록 (최대 200건)</p>
        </div>
        {history.length > 0 && (
          <Tooltip content={<>파일에는 영향없고<br />변환 이력 리스트만 삭제되요!</>} position="bottom">
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} />
              전체 삭제
            </button>
          </Tooltip>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/15">
          <Clock size={40} strokeWidth={1.5} />
          <p className="text-sm">변환 이력이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto">
          {history.map(entry => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80 truncate">{entry.inputName}</span>
                  <span className="text-white/20 text-xs">→</span>
                  <span className="text-xs font-medium text-indigo-400 uppercase">{entry.targetFormat}</span>
                </div>
                <p className="selectable text-xs text-white/25 truncate mt-0.5">{entry.outputPath}</p>
              </div>

              <span className="text-xs text-white/20 shrink-0">{formatTime(entry.timestamp)}</span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => openFolder(entry.outputPath)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                  title="저장 폴더 열기"
                >
                  <FolderOpen size={14} />
                </button>
                <button
                  onClick={() => saveAs(entry)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
                  title="다른 이름으로 저장"
                >
                  <Save size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
