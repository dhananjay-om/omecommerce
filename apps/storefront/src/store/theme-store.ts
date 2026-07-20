import { create } from 'zustand';

interface ThemeState {
  theme: 'light' | 'dark';
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  toggle: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}));
