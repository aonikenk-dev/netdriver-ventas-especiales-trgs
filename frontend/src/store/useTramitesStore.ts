import { create } from 'zustand';
import type { EstadoTramite, GestorTramite } from '@shared/types';
import {
  actualizarFormularios,
  enviarSuats,
  importarExcel,
  listarTramites,
} from '@/api/tramites';

type SortField = 'creadoEn' | 'chasis' | 'titular' | 'estado';

interface FiltersState {
  search: string;
  estado: EstadoTramite | 'all';
  ni: 'all' | '6801' | '6802';
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  pageSize: number;
}

interface PaginationState {
  page: number;
  total: number;
  totalPages: number;
}

interface TramitesState {
  tramites: GestorTramite[];
  loading: boolean;
  enviando: boolean;
  pagination: PaginationState;
  filters: FiltersState;
  fetchTramites: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (f: Partial<FiltersState>) => void;
  importarDesdeExcel: (file: File) => Promise<{ errores: number; creados: number }>;
  actualizarFormulario: (
    id: number,
    cambios: { formularioNro01?: string; formularioNro12?: string }
  ) => Promise<void>;
  enviarAlWs: (ids: number[]) => Promise<void>;
}

export const useTramitesStore = create<TramitesState>((set, get) => ({
  tramites: [],
  loading: false,
  enviando: false,
  pagination: { page: 1, total: 0, totalPages: 1 },
  filters: { search: '', estado: 'all', ni: 'all', sortBy: 'creadoEn', sortDir: 'desc', pageSize: 10 },

  fetchTramites: async () => {
    const { filters, pagination } = get();
    set({ loading: true });
    try {
      const result = await listarTramites({
        page: pagination.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        estado: filters.estado,
        ni: filters.ni,
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
      });
      set({
        tramites: result.tramites,
        pagination: { page: result.page, total: result.total, totalPages: result.totalPages },
      });
    } finally {
      set({ loading: false });
    }
  },

  setPage: (page) => {
    set((s) => ({ pagination: { ...s.pagination, page } }));
    get().fetchTramites();
  },

  setFilters: (newFilters) => {
    set((s) => ({
      filters: { ...s.filters, ...newFilters },
      pagination: { ...s.pagination, page: 1 },
    }));
    get().fetchTramites();
  },

  importarDesdeExcel: async (file) => {
    const resultado = await importarExcel(file);
    set((s) => ({ pagination: { ...s.pagination, page: 1 } }));
    await get().fetchTramites();
    return { errores: resultado.errores.length, creados: resultado.tramites.length };
  },

  actualizarFormulario: async (id, cambios) => {
    const tramite = await actualizarFormularios(id, cambios);
    set({ tramites: get().tramites.map((t) => (t.id === id ? tramite : t)) });
  },

  enviarAlWs: async (ids) => {
    set({ enviando: true });
    try {
      const actualizados = await enviarSuats(ids);
      const porId = new Map(actualizados.map((t) => [t.id, t]));
      set({ tramites: get().tramites.map((t) => porId.get(t.id) ?? t) });
    } finally {
      set({ enviando: false });
    }
  },
}));
