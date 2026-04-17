import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'oscuro' | 'claro' | 'negro' | 'gris' | 'magenta';
export type AppFont  = 'inter' | 'arial' | 'helvetica' | 'roboto' | 'dm-sans' | 'system';

interface AppState {
  currentModule: string;
  currentUser: { id: number; nombre: string; rol: string } | null;
  isAuthenticated: boolean;
  config: Record<string, string>;
  serverPort: number;
  localIP: string;
  sidebarCollapsed: boolean;
  iaOpen: boolean;
  theme: AppTheme;
  font: AppFont;

  setCurrentModule: (module: string) => void;
  setCurrentUser: (user: { id: number; nombre: string; rol: string } | null) => void;
  setAuthenticated: (val: boolean) => void;
  setConfig: (config: Record<string, string>) => void;
  updateConfig: (key: string, value: string) => void;
  setServerPort: (port: number) => void;
  setLocalIP: (ip: string) => void;
  setServerInfo: (ip: string, port: number) => void;
  login: (user: { id: number; nombre: string; rol: string }) => void;
  logout: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (val: boolean) => void;
  toggleIa: () => void;
  setIaOpen: (val: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setFont:  (font: AppFont)  => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentModule: 'dashboard',
      currentUser: null,
      isAuthenticated: false,
      config: {},
      serverPort: 3001,
      localIP: 'localhost',
      sidebarCollapsed: false,
      iaOpen: false,
      theme: 'oscuro',
      font:  'inter',

      setCurrentModule: (module) => set({ currentModule: module }),
      setCurrentUser: (user) => set({ currentUser: user }),
      setAuthenticated: (val) => set({ isAuthenticated: val }),
      setConfig: (config) => set({ config }),
      updateConfig: (key, value) =>
        set((state) => ({ config: { ...state.config, [key]: value } })),
      setServerPort: (port) => set({ serverPort: port }),
      setLocalIP: (ip) => set({ localIP: ip }),
      setServerInfo: (ip, port) => set({ localIP: ip, serverPort: port }),
      login: (user) => set({ currentUser: user, isAuthenticated: true }),
      logout: () => set({ currentUser: null, isAuthenticated: false }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
      toggleIa: () => set((s) => ({ iaOpen: !s.iaOpen })),
      setIaOpen: (val) => set({ iaOpen: val }),
      setTheme: (theme) => {
        document.documentElement.dataset.theme = theme === 'oscuro' ? '' : theme;
        set({ theme });
      },
      setFont: (font) => {
        const FONT_MAP: Record<string, string> = {
          'inter':     "'Inter', 'Segoe UI', sans-serif",
          'arial':     "Arial, 'Arial Nova', sans-serif",
          'helvetica': "'Helvetica Neue', Helvetica, Arial, sans-serif",
          'roboto':    "Roboto, 'Segoe UI', sans-serif",
          'dm-sans':   "'DM Sans', 'Segoe UI', sans-serif",
          'system':    "system-ui, -apple-system, 'Segoe UI', sans-serif",
        };
        document.documentElement.style.setProperty('--font-base', FONT_MAP[font] ?? FONT_MAP.inter);
        set({ font });
      },
    }),
    {
      name: 'ariespos-app-store',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        font:  state.font,
        currentModule: state.currentModule,
      }),
    }
  )
);
