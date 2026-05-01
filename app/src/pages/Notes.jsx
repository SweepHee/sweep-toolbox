import { useEffect, useState } from "react";
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  AlignJustify,
  LayoutGrid,
  StickyNote,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowDownRight,
  Minimize2,
  ChevronsDownUp,
  ChevronsUpDown,
  Bell,
} from "lucide-react";
import { useNotesStore } from "@/store/notesStore";

const NOTE_COLORS = [
  "#fef9c3",
  "#fce7f3",
  "#dbeafe",
  "#dcfce7",
  "#ede9fe",
  "#f1f5f9",
  "#292524",
];

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금 전";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${Math.floor(diff / 86_400_000)}일 전`;
}

function stripHtml(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstLine(html) {
  const text = stripHtml(html);
  const line = text.split("\n")[0].trim();
  return line.slice(0, 60) || "새 메모";
}

function NoteCard({ note, onShow, onHide, onDelete, onFocus }) {
  const [confirming, setConfirming] = useState(false);
  const visible = note.visible !== false;
  const title = firstLine(note.content);
  const preview = (() => {
    const text = stripHtml(note.content);
    return text.split("\n").slice(1).join(" ").trim().slice(0, 80);
  })();

  const handleDelete = () => {
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 2500);
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5 hover:bg-white/[0.06] transition-colors group">
      {/* Color swatch */}
      <div
        className="w-2.5 h-full rounded-full shrink-0 self-stretch min-h-[2.5rem]"
        style={{ background: note.color ?? "#fef9c3", minHeight: "2.5rem" }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80 truncate flex-1">
            {title}
          </span>
          <span className="text-[10px] text-white/25 shrink-0">
            {relativeTime(note.updatedAt)}
          </span>
        </div>
        {preview && (
          <p className="text-xs text-white/35 mt-0.5 truncate">{preview}</p>
        )}
        {note.reminderAt && (
          <div className="flex items-center gap-1 mt-1">
            <Bell size={9} className="text-green-400 shrink-0" />
            <span className="text-[9px] text-green-400/80">
              {new Date(note.reminderAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={visible ? onHide : onShow}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
          title={visible ? "바탕화면에서 숨기기" : "바탕화면에 표시"}
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {visible && (
          <button
            onClick={onFocus}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/70 transition-colors"
            title="창 앞으로 가져오기"
          >
            <ExternalLink size={14} />
          </button>
        )}
        <button
          onClick={handleDelete}
          className={`p-1.5 rounded-lg transition-colors ${confirming ? "bg-red-500/20 text-red-400" : "hover:bg-white/10 text-white/30 hover:text-red-400"}`}
          title={confirming ? "한 번 더 클릭하면 삭제됩니다" : "삭제"}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

const CORNERS = [
  { key: "tl", Icon: ArrowUpLeft, label: "좌상단" },
  { key: "tr", Icon: ArrowUpRight, label: "우상단" },
  { key: "bl", Icon: ArrowDownLeft, label: "좌하단" },
  { key: "br", Icon: ArrowDownRight, label: "우하단" },
];

export default function Notes() {
  const {
    notes,
    loadNotes,
    createNote,
    deleteNote,
    showNote,
    hideNote,
    focusNote,
    arrangeNotes,
    resetNoteSize,
    collapseAll,
    expandAll,
  } = useNotesStore();
  const [corner, setCorner] = useState("tl");

  useEffect(() => {
    loadNotes();
    return window.electronAPI?.onNotesUpdated(() => loadNotes());
  }, []);

  const visibleCount = notes.filter((n) => n.visible !== false).length;

  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">스티커 메모</h1>
          <p className="text-white/40 text-sm mt-1">
            {notes.length}개 메모 · 바탕화면에 {visibleCount}개 표시 중
          </p>
        </div>
        <button
          onClick={createNote}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} />새 메모
        </button>
      </div>

      {/* Note list */}
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
            <StickyNote size={40} />
            <p className="text-sm">메모가 없습니다. 새 메모를 만들어보세요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onShow={() => showNote(note.id)}
                onHide={() => hideNote(note.id)}
                onDelete={() => deleteNote(note.id)}
                onFocus={() => focusNote(note.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Arrange toolbar */}
      {notes.length > 1 && (
        <div className="flex items-center gap-2 pt-4 border-t border-white/5 shrink-0 flex-wrap">
          <span className="text-xs text-white/30">전체 정렬</span>

          {/* Corner selector */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            {CORNERS.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setCorner(key)}
                title={label}
                className={`p-1.5 rounded-md transition-colors ${corner === key ? "bg-white/15 text-white/80" : "text-white/25 hover:text-white/60"}`}
              >
                <Icon size={12} />
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={() => arrangeNotes(`cascade-${corner}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <AlignJustify size={13} />
            계단식
          </button>
          <button
            onClick={() => arrangeNotes(`grid-${corner}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
          >
            <LayoutGrid size={13} />
            격자
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={resetNoteSize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="모든 메모를 기본 크기(280×300)로 초기화"
          >
            <Minimize2 size={13} />
            크기 초기화
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={collapseAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="모든 메모 접기"
          >
            <ChevronsDownUp size={13} />
            전체 접기
          </button>
          <button
            onClick={expandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            title="모든 메모 펴기"
          >
            <ChevronsUpDown size={13} />
            전체 펴기
          </button>
        </div>
      )}
    </div>
  );
}
