import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { ChevronUp, ChevronDown, X, Palette, Sun, Pin, Lock, LockOpen } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const NOTE_COLORS = [
  '#fefce8', '#fef9c3', '#fed7aa', '#fecaca',
  '#fce7f3', '#f3e8ff', '#e0e7ff', '#dbeafe',
  '#dcfce7', '#d1fae5', '#ccfbf1', '#e0f2fe',
  '#f8fafc', '#e2e8f0', '#334155', '#1e293b', '#000000',
];

const NOTE_GRADIENTS = [
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
  'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #2d3561 0%, #c05c7e 100%)',
];

function isDark(colorStr) {
  const match = colorStr.match(/#([0-9a-fA-F]{6})/);
  if (!match) return false;
  const hex = match[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function Tooltip({ label, placement = 'top', align = 'center', children }) {
  const [show, setShow] = useState(false);
  const alignStyle = align === 'left'
    ? { left: 0, transform: 'none' }
    : align === 'right'
    ? { right: 0, left: 'auto', transform: 'none' }
    : { left: '50%', transform: 'translateX(-50%)' };
  return (
    <div
      style={{ position: 'relative', display: 'flex', WebkitAppRegion: 'no-drag' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && label && (
        <div style={{
          position: 'absolute',
          ...(placement === 'top'
            ? { bottom: 'calc(100% + 6px)' }
            : { top: 'calc(100% + 4px)' }),
          ...alignStyle,
          padding: '3px 8px',
          background: 'rgba(15,15,15,0.82)',
          color: '#f8fafc',
          fontSize: '10px',
          fontWeight: 500,
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          letterSpacing: '0.02em',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function extractFirstLine(html) {
  if (!html) return '새 메모';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent || '').trim();
  const firstLine = text.split('\n')[0].trim();
  return firstLine.slice(0, 60) || '새 메모';
}


// ── StickyNote ────────────────────────────────────────────────────────────────
export default function StickyNote() {
  const noteId = new URLSearchParams(window.location.search).get('id');
  const [note, setNote] = useState(null);
  const [activePopup, setActivePopup] = useState(null);
  const [opacity, setOpacity] = useState(1);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [locked, setLocked] = useState(false);
  const contentSet = useRef(false);
  const effectsSet = useRef(false);
  const saveContentTimer = useRef(null);
  const colorInputRef = useRef(null);

  const color = note?.color ?? '#fef9c3';
  const dark = isDark(color);
  const text = dark ? '#f8fafc' : '#1e293b';
  const muted = dark ? 'rgba(248,250,252,0.45)' : 'rgba(30,41,59,0.45)';
  const border = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] }, codeBlock: false }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      TaskList,
      TaskItem.configure({ nested: false }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: '메모를 입력하세요...' }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      clearTimeout(saveContentTimer.current);
      saveContentTimer.current = setTimeout(() => {
        window.electronAPI?.noteUpdate(noteId, { content: editor.getHTML() });
      }, 600);
    },
    editorProps: {
      attributes: { class: 'note-prose' },
    },
  });

  useEffect(() => {
    if (!noteId) return;
    window.electronAPI?.noteGetData(noteId).then(data => {
      if (data) setNote(data);
    });
  }, [noteId]);

  useEffect(() => {
    if (editor && note && !contentSet.current) {
      editor.commands.setContent(note.content || '');
      contentSet.current = true;
    }
  }, [editor, note]);

  useEffect(() => {
    if (note && !effectsSet.current) {
      setOpacity(note.opacity ?? 1);
      setAlwaysOnTop(note.alwaysOnTop ?? false);
      setLocked(note.locked ?? false);
      effectsSet.current = true;
    }
  }, [note]);

  useEffect(() => {
    if (!window.electronAPI?.onNoteUpdated) return;
    return window.electronAPI.onNoteUpdated((_, patch) => {
      setNote(prev => prev ? { ...prev, ...patch } : prev);
    });
  }, []);

  const handleCollapse = () => {
    if (!note) return;
    const next = !note.collapsed;
    setNote(prev => ({ ...prev, collapsed: next }));
    setActivePopup(null);
    window.electronAPI?.noteSetCollapsed(noteId, next);
  };

  const handleClose = () => {
    setActivePopup(null);
    window.electronAPI?.noteHide(noteId);
  };

  const handleColorChange = c => {
    setNote(prev => ({ ...prev, color: c }));
    window.electronAPI?.noteUpdate(noteId, { color: c });
  };

  const handleLocked = () => {
    const next = !locked;
    setLocked(next);
    window.electronAPI?.noteUpdate(noteId, { locked: next });
  };

  const handleAlwaysOnTop = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    window.electronAPI?.noteSetAlwaysOnTop(noteId, next);
  };

  const handleOpacityChange = value => {
    setOpacity(value);
    window.electronAPI?.noteSetOpacity(noteId, value);
  };

  const handleInsertImage = useCallback(async () => {
    const result = await window.electronAPI?.notePickImage();
    if (result?.dataUrl) {
      editor?.chain().focus().setImage({ src: result.dataUrl }).run();
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    return window.electronAPI?.onNoteContextMenuAction(action => {
      switch (action) {
        case 'bold':            editor.chain().focus().toggleBold().run(); break;
        case 'italic':          editor.chain().focus().toggleItalic().run(); break;
        case 'underline':       editor.chain().focus().toggleUnderline().run(); break;
        case 'fontSize-small':  editor.chain().focus().setFontSize('11px').run(); break;
        case 'fontSize-normal': editor.chain().focus().unsetFontSize().run(); break;
        case 'fontSize-large':  editor.chain().focus().setFontSize('16px').run(); break;
        case 'fontSize-xlarge': editor.chain().focus().setFontSize('22px').run(); break;
        case 'paragraph':       editor.chain().focus().setParagraph().run(); break;
        case 'heading1':        editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
        case 'heading2':        editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
        case 'bulletList':      editor.chain().focus().toggleBulletList().run(); break;
        case 'orderedList':     editor.chain().focus().toggleOrderedList().run(); break;
        case 'taskList':        editor.chain().focus().toggleTaskList().run(); break;
        case 'color':           colorInputRef.current?.click(); break;
        case 'insertImage':     handleInsertImage(); break;
      }
    });
  }, [editor, handleInsertImage]);

  const handleContextMenu = useCallback(e => {
    e.preventDefault();
    if (!editor) return;
    window.electronAPI?.showNoteContextMenu({
      bold:        editor.isActive('bold'),
      italic:      editor.isActive('italic'),
      underline:   editor.isActive('underline'),
      paragraph:   editor.isActive('paragraph'),
      heading1:    editor.isActive('heading', { level: 1 }),
      heading2:    editor.isActive('heading', { level: 2 }),
      bulletList:  editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList:    editor.isActive('taskList'),
    });
  }, [editor]);

  if (!note) return null;

  const iconBtn = (active) => ({
    background: active ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : 'none',
    border: 'none',
    cursor: 'pointer',
    color: active ? text : muted,
    padding: '3px',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    borderRadius: 4,
    transition: 'color 0.15s, background 0.15s',
  });

  // ── 접힌 상태: 헤더와 동일한 레이아웃 ───────────────────────────────────────
  if (note.collapsed) {
    const tabLabel = extractFirstLine(note.content);
    const btnStyle = {
      background: 'none', border: 'none', cursor: 'pointer',
      color: muted, padding: '2px', display: 'flex',
      flexShrink: 0, WebkitAppRegion: 'no-drag', borderRadius: 3,
    };
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        background: color, gap: 2, padding: '0 4px',
        overflow: 'hidden', userSelect: 'none',
        borderBottom: `1px solid ${border}`,
        cursor: locked ? 'default' : 'grab',
        WebkitAppRegion: locked ? 'no-drag' : 'drag',
      }}>
        {/* 텍스트 (드래그 영역) */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 4px', pointerEvents: 'none' }}>
          <span style={{
            fontSize: '11px', fontWeight: 600, color: text,
            letterSpacing: '0.03em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block',
          }}>
            {tabLabel}
          </span>
        </div>

        {/* 펼치기 */}
        <button
          onClick={handleCollapse}
          onMouseDown={e => e.stopPropagation()}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.color = text; }}
          onMouseLeave={e => { e.currentTarget.style.color = muted; }}
        >
          <ChevronDown size={11} />
        </button>

        {/* 숨기기 */}
        <button
          onClick={handleClose}
          onMouseDown={e => e.stopPropagation()}
          style={btnStyle}
          onMouseEnter={e => { e.currentTarget.style.color = text; }}
          onMouseLeave={e => { e.currentTarget.style.color = muted; }}
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  // ── 펼친 상태 ─────────────────────────────────────────────────────────────
  const collapsed = false;
  return (
    <div style={{
      height: '100vh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      background: color,
      userSelect: 'none',
    }}>
      {/* ── 최소 헤더: 드래그 영역 + 접기/닫기 버튼 ── */}
      <div
        onDoubleClick={handleCollapse}
        style={{
          display: 'flex', alignItems: 'center',
          gap: 2, padding: '3px 4px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0, cursor: locked ? 'default' : 'grab',
          WebkitAppRegion: locked ? 'no-drag' : 'drag',
        }}
      >
        {/* 드래그 공간 */}
        <div style={{ flex: 1 }} />

        {/* 접기 */}
        <Tooltip label="북마크로 접기" placement="bottom">
          <button
            onClick={handleCollapse}
            onMouseDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: muted, padding: '2px', display: 'flex',
              flexShrink: 0, WebkitAppRegion: 'no-drag', borderRadius: 3,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = text; }}
            onMouseLeave={e => { e.currentTarget.style.color = muted; }}
          >
            <ChevronUp size={11} />
          </button>
        </Tooltip>

        {/* 닫기 */}
        <Tooltip label="숨기기" placement="bottom">
          <button
            onClick={handleClose}
            onMouseDown={e => e.stopPropagation()}
            onDoubleClick={e => e.stopPropagation()}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: muted, padding: '2px', display: 'flex',
              flexShrink: 0, WebkitAppRegion: 'no-drag', borderRadius: 3,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = text; }}
            onMouseLeave={e => { e.currentTarget.style.color = muted; }}
          >
            <X size={11} />
          </button>
        </Tooltip>
      </div>

      {/* ── 에디터 + 플로팅 버튼 ── */}
      {!collapsed && (
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div
            style={{ height: '100%', overflowY: 'auto', padding: '10px 12px', userSelect: 'text', color: text }}
            onContextMenu={handleContextMenu}
          >
            <EditorContent editor={editor} />
          </div>

          {/* 색상 팔레트 팝업 */}
          {activePopup === 'color' && (
            <div style={{
              position: 'absolute', bottom: 36, left: 8,
              display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px',
              backgroundColor: dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(6px)',
              borderRadius: 8, border: `1px solid ${border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 10,
            }}>
              {/* 단색 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 148 }}>
                {NOTE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => { handleColorChange(c); setActivePopup(null); }}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: c,
                      border: c === color ? `2px solid ${text}` : `1px solid ${border}`,
                      cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                ))}
              </div>
              {/* 구분선 */}
              <div style={{ borderTop: `1px solid ${border}`, margin: '0 -2px' }} />
              {/* 그라데이션 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 148 }}>
                {NOTE_GRADIENTS.map(c => (
                  <button
                    key={c}
                    onClick={() => { handleColorChange(c); setActivePopup(null); }}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', background: c,
                      border: c === color ? `2px solid ${text}` : `1px solid ${border}`,
                      cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 투명도 슬라이더 팝업 */}
          {activePopup === 'opacity' && (
            <div style={{
              position: 'absolute', bottom: 36, left: 8,
              padding: '8px 12px',
              backgroundColor: dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(6px)',
              borderRadius: 8, border: `1px solid ${border}`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
              zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130,
            }}>
              <span style={{ fontSize: '10px', color: muted, fontWeight: 600 }}>
                투명도 {Math.round(opacity * 100)}%
              </span>
              <input
                type="range" min="20" max="100" value={Math.round(opacity * 100)}
                onChange={e => handleOpacityChange(parseInt(e.target.value) / 100)}
                style={{ width: '100%', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* 플로팅 버튼 행 */}
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            display: 'flex', gap: 2, alignItems: 'center', zIndex: 10,
          }}>
            <Tooltip label="배경색 변경" placement="top" align="left">
              <button
                onClick={() => setActivePopup(p => p === 'color' ? null : 'color')}
                style={iconBtn(activePopup === 'color')}
                onMouseEnter={e => { e.currentTarget.style.color = text; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = activePopup === 'color' ? text : muted; e.currentTarget.style.background = activePopup === 'color' ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : 'none'; }}
              >
                <Palette size={12} />
              </button>
            </Tooltip>
            <Tooltip label="투명도 조절" placement="top">
              <button
                onClick={() => setActivePopup(p => p === 'opacity' ? null : 'opacity')}
                style={iconBtn(activePopup === 'opacity')}
                onMouseEnter={e => { e.currentTarget.style.color = text; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = activePopup === 'opacity' ? text : muted; e.currentTarget.style.background = activePopup === 'opacity' ? (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)') : 'none'; }}
              >
                <Sun size={12} />
              </button>
            </Tooltip>
            {/* 이동 잠금 버튼 — 활성 시 blue 불 켜짐 효과 */}
            <Tooltip label={locked ? '이동 고정 해제' : '이동 위치 고정'} placement="top">
              <button
                onClick={handleLocked}
                style={{
                  ...iconBtn(false),
                  color: locked ? '#3b82f6' : muted,
                  background: locked
                    ? (dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)')
                    : 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = locked ? '#3b82f6' : text;
                  e.currentTarget.style.background = locked
                    ? (dark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.18)')
                    : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = locked ? '#3b82f6' : muted;
                  e.currentTarget.style.background = locked
                    ? (dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)')
                    : 'none';
                }}
              >
                {locked ? <Lock size={12} /> : <LockOpen size={12} />}
              </button>
            </Tooltip>
            {/* 항상 위 버튼 — 활성 시 amber 불 켜짐 효과 */}
            <Tooltip label={alwaysOnTop ? '항상 위 해제' : '항상 위에 표시'} placement="top">
              <button
                onClick={handleAlwaysOnTop}
                style={{
                  ...iconBtn(false),
                  color: alwaysOnTop ? '#f59e0b' : muted,
                  background: alwaysOnTop
                    ? (dark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)')
                    : 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = alwaysOnTop ? '#f59e0b' : text;
                  e.currentTarget.style.background = alwaysOnTop
                    ? (dark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.18)')
                    : (dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)');
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = alwaysOnTop ? '#f59e0b' : muted;
                  e.currentTarget.style.background = alwaysOnTop
                    ? (dark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)')
                    : 'none';
                }}
              >
                <Pin size={12} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      <input
        ref={colorInputRef}
        type="color"
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: 1, height: 1, top: 0, left: 0 }}
        onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
      />
    </div>
  );
}
