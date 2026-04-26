import { create } from 'zustand';

export const useNotesStore = create((set, get) => ({
  notes: [],

  loadNotes: async () => {
    const notes = await window.electronAPI?.noteGetAll() ?? [];
    set({ notes });
  },

  createNote: async () => {
    const note = await window.electronAPI?.noteCreate();
    if (note) set(s => ({ notes: [note, ...s.notes] }));
    return note;
  },

  deleteNote: async (noteId) => {
    await window.electronAPI?.noteDelete(noteId);
    set(s => ({ notes: s.notes.filter(n => n.id !== noteId) }));
  },

  showNote: async (noteId) => {
    await window.electronAPI?.noteShow(noteId);
    set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, visible: true } : n) }));
  },

  hideNote: async (noteId) => {
    await window.electronAPI?.noteHide(noteId);
    set(s => ({ notes: s.notes.map(n => n.id === noteId ? { ...n, visible: false } : n) }));
  },

  focusNote: (noteId) => window.electronAPI?.noteFocus(noteId),

  arrangeNotes: async (type) => {
    await window.electronAPI?.noteArrange(type);
    await get().loadNotes();
  },

  resetNoteSize: async () => {
    await window.electronAPI?.noteResetSize();
    await get().loadNotes();
  },

  collapseAll: async () => {
    await window.electronAPI?.noteCollapseAll();
    await get().loadNotes();
  },

  expandAll: async () => {
    await window.electronAPI?.noteExpandAll();
    await get().loadNotes();
  },
}));
