import { useState, useCallback } from 'react';
import {
  Upload, FileImage, FileVideo, FileText, Database, Table,
  ChevronDown, ArrowRight, CheckCircle, XCircle,
  Loader, FolderOpen, Trash2, Save,
} from 'lucide-react';
import { useConverterStore } from '@/store';

const CATEGORY_FORMATS = {
  image:    { out: ['jpg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf'], icon: FileImage,  color: 'text-violet-400' },
  media:    { out: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm', 'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg', 'opus'], icon: FileVideo, color: 'text-blue-400' },
  pdf:      { out: ['jpg', 'png', 'gif', 'webp', 'bmp', 'tiff'],        icon: FileText,   color: 'text-red-400'    },
  document: { out: ['pdf'],                                              icon: FileText,   color: 'text-orange-400' },
  data:     { out: ['csv', 'xlsx', 'json', 'xml'],                      icon: Database,   color: 'text-green-400'  },
  excel:    { out: ['xlsx', 'ods', 'csv', 'tsv', 'json', 'xml'],         icon: Table,      color: 'text-emerald-400' },
};

const EXT_CATEGORY = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
  webp: 'image', bmp: 'image', tiff: 'image', tif: 'image',
  mp4: 'media', avi: 'media', mkv: 'media', mov: 'media', wmv: 'media',
  webm: 'media', flv: 'media', ts: 'media', mpeg: 'media', mpg: 'media', m4v: 'media',
  mp3: 'media', wav: 'media', aac: 'media', flac: 'media', m4a: 'media',
  ogg: 'media', wma: 'media', opus: 'media', aiff: 'media',
  pdf: 'pdf',
  docx: 'document', pptx: 'document', hwp: 'document', hwpx: 'document',
  xlsx: 'excel', xls: 'excel', xlsm: 'excel', ods: 'excel', tsv: 'excel', numbers: 'excel',
  csv: 'data', json: 'excel', xml: 'data',
};

function makeItem(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const category = EXT_CATEGORY[ext] ?? null;
  const formats = category ? CATEGORY_FORMATS[category].out.filter(f => f !== ext) : [];
  return {
    id: crypto.randomUUID(),
    file,
    ext,
    category,
    targetFormat: formats[0] ?? '',
    status: 'idle',   // idle | converting | done | error
    outputPath: null,
    error: null,
  };
}

function StatusBadge({ item }) {
  if (item.status === 'converting')
    return <span className="flex items-center gap-1 text-xs text-blue-400"><Loader size={12} className="animate-spin" />변환 중</span>;
  if (item.status === 'done')
    return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle size={12} />완료</span>;
  if (item.status === 'error')
    return (
      <span className="selectable flex items-center gap-1 text-xs text-red-400">
        <XCircle size={12} className="shrink-0" />
        실패: {item.error ?? '알 수 없는 오류'}
      </span>
    );
  return null;
}

function FileRow({ item, onChange, onRemove, onConvert, onSaveAs }) {
  const cat = item.category ? CATEGORY_FORMATS[item.category] : null;
  const Icon = cat?.icon ?? Upload;
  const formats = cat ? cat.out.filter(f => f !== item.ext) : [];
  const canConvert = item.status === 'idle' && item.targetFormat && item.category;

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/5 group">
      <Icon size={18} className={`shrink-0 ${cat?.color ?? 'text-white/30'}`} />

      <span className="text-sm text-white/70 truncate flex-1 min-w-0">{item.file.name}</span>

      <span className="text-xs text-white/25 uppercase shrink-0">{item.ext}</span>

      {formats.length > 0 && item.status === 'idle' && (
        <>
          <ArrowRight size={14} className="text-white/20 shrink-0" />
          <div className="relative shrink-0">
            <select
              value={item.targetFormat}
              onChange={e => onChange(item.id, e.target.value)}
              className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-7 py-1.5 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
            >
              {formats.map(f => (
                <option key={f} value={f} className="bg-[#1a1a2e]">{f.toUpperCase()}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          </div>
        </>
      )}

      {!item.category && (
        <span className="text-xs text-white/25 shrink-0">지원 안 함</span>
      )}

      <StatusBadge item={item} />

      {item.status === 'done' && item.outputPath && (
        <>
          <button
            onClick={() => window.electronAPI?.openPath(item.outputPath)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
            title="저장 폴더 열기"
          >
            <FolderOpen size={14} />
          </button>
          <button
            onClick={() => onSaveAs(item)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
            title="다른 이름으로 저장"
          >
            <Save size={14} />
          </button>
        </>
      )}

      {item.status === 'idle' && (
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/30 hover:text-red-400 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}

      {canConvert && (
        <button
          onClick={() => onConvert(item.id)}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 text-xs font-semibold transition-colors"
        >
          변환
        </button>
      )}
    </div>
  );
}

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState([]);
  const addHistoryEntry = useConverterStore(s => s.addHistoryEntry);

  const addFiles = (fileList) => {
    setItems(prev => [...prev, ...Array.from(fileList).map(makeItem)]);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => addFiles(e.target.files);
    input.click();
  };

  const updateItem = (id, patch) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));

  const removeItem = (id) =>
    setItems(prev => prev.filter(it => it.id !== id));

  const convertOne = async (id) => {
    const item = items.find(it => it.id === id);
    if (!item) return;

    const filePath = window.electronAPI.getPathForFile(item.file);
    if (!filePath) {
      updateItem(id, { status: 'error', error: '파일 경로를 읽을 수 없습니다' });
      return;
    }

    updateItem(id, { status: 'converting', error: null });
    try {
      const result = await window.electronAPI.convertFile({
        filePath,
        targetFormat: item.targetFormat,
        options: {},
      });
      if (result.ok) {
        const outputPath = result.data.outputPath;
        updateItem(id, { status: 'done', outputPath });
        addHistoryEntry({
          id: crypto.randomUUID(),
          inputName: item.file.name,
          inputPath: filePath,
          outputPath,
          outputName: outputPath.split(/[\\/]/).pop(),
          targetFormat: item.targetFormat,
          timestamp: Date.now(),
        });
      } else {
        updateItem(id, { status: 'error', error: result.error });
      }
    } catch (err) {
      updateItem(id, { status: 'error', error: err.message });
    }
  };

  const saveAs = async (item) => {
    if (!item.outputPath) return;
    await window.electronAPI.saveAs({
      sourcePath: item.outputPath,
      defaultName: item.outputName ?? item.outputPath.split(/[\\/]/).pop(),
    });
  };

  const convertAll = () => {
    items
      .filter(it => it.status === 'idle' && it.category && it.targetFormat)
      .forEach(it => convertOne(it.id));
  };

  const clearDone = () =>
    setItems(prev => prev.filter(it => it.status !== 'done'));

  const idleCount = items.filter(it => it.status === 'idle' && it.category && it.targetFormat).length;
  const doneCount = items.filter(it => it.status === 'done').length;

  return (
    <div className="flex flex-col gap-4 flex-1">
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          flex flex-col items-center justify-center min-h-40 rounded-2xl border-2 border-dashed cursor-pointer transition-all
          ${isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
          }
        `}
      >
        <Upload size={32} className={`mb-2 transition-colors ${isDragging ? 'text-indigo-400' : 'text-white/20'}`} />
        <p className="text-white/50 text-sm font-medium">파일을 드래그하거나 클릭해서 선택</p>
        <p className="text-white/25 text-xs mt-1">이미지 · 동영상 · 문서 · 데이터 파일 지원</p>
      </div>

      {/* File list */}
      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/30">{items.length}개 파일</span>
            <div className="flex items-center gap-2">
              {doneCount > 0 && (
                <button
                  onClick={clearDone}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  완료 항목 지우기
                </button>
              )}
              {idleCount > 1 && (
                <button
                  onClick={convertAll}
                  className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold transition-colors"
                >
                  모두 변환 ({idleCount})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {items.map(item => (
              <FileRow
                key={item.id}
                item={item}
                onChange={(id, fmt) => updateItem(id, { targetFormat: fmt })}
                onRemove={removeItem}
                onConvert={convertOne}
                onSaveAs={saveAs}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
