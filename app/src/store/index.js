import { create } from 'zustand';

export const useConverterStore = create((set) => ({
  history: [],

  loadHistory: async () => {
    const h = await window.electronAPI?.loadHistory() ?? [];
    set({ history: h });
  },

  addHistoryEntry: (entry) => {
    window.electronAPI?.appendHistory(entry);
    set((s) => ({ history: [entry, ...s.history].slice(0, 200) }));
  },

  clearHistory: () => {
    window.electronAPI?.clearHistory();
    set({ history: [] });
  },
}));
