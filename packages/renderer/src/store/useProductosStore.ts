import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewMode = 'grid' | 'list';

interface ProductosState {
  viewMode: ViewMode;
  searchQuery: string;
  selectedCategoria: number | null;
  showInactive: boolean;

  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (q: string) => void;
  setSelectedCategoria: (id: number | null) => void;
  setShowInactive: (val: boolean) => void;
}

export const useProductosStore = create<ProductosState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      searchQuery: '',
      selectedCategoria: null,
      showInactive: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSelectedCategoria: (id) => set({ selectedCategoria: id }),
      setShowInactive: (val) => set({ showInactive: val }),
    }),
    {
      name: 'ariespos-productos-store',
      partialize: (state) => ({ viewMode: state.viewMode }),
    }
  )
);
