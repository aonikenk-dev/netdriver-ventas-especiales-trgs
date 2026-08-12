import { create } from 'zustand';
import type { EstadoTramite, ExcelImportRowError, GestorTramite, TramiteDatosUpdate } from '@shared/types';
import {
  actualizarFormularios,
  actualizarDatosTramite as apiActualizarDatos,
  enviarSuats,
  importarExcel,
  listarTramites,
  enviarARemito as apiEnviarARemito,
  descartarTramite as apiDescartar,
} from '@/api/tramites';

type SortField = 'creadoEn' | 'chasis' | 'titular' | 'estado';

interface FiltersState {
  search: string;
  estado: EstadoTramite | 'all' | 'enviadoARemito' | 'activos';
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
  tramitesParaRemito: GestorTramite[];
  loading: boolean;
  enviando: boolean;
  pagination: PaginationState;
  filters: FiltersState;
  erroresExcel: ExcelImportRowError[];
  fetchTramites: () => Promise<void>;
  setPage: (page: number) => void;
  setFilters: (f: Partial<FiltersState>) => void;
  importarDesdeExcel: (file: File) => Promise<{ errores: number; creados: number }>;
  actualizarFormulario: (
    id: number,
    cambios: { formularioNro01?: string; formularioNro12?: string }
  ) => Promise<void>;
  enviarAlWs: (ids: number[]) => Promise<void>;
  enviarARemito: (id: number) => Promise<void>;
  descartar: (id: number) => Promise<void>;
  actualizarDatos: (id: number, datos: TramiteDatosUpdate) => Promise<void>;
  removerDeRemito: (ids: number[]) => void;
  limpiarErroresExcel: () => void;
}

export const useTramitesStore = create<TramitesState>((set, get) => ({
  tramites: [],
  tramitesParaRemito: [],
  loading: false,
  enviando: false,
  pagination: { page: 1, total: 0, totalPages: 1 },
  filters: { search: '', estado: 'all', ni: 'all', sortBy: 'creadoEn', sortDir: 'desc', pageSize: 10 },
  erroresExcel: [],

  fetchTramites: async () => {
    const { filters, pagination } = get();
    set({ loading: true });
    try {
      const isEnviadoARemitoFilter = filters.estado === 'enviadoARemito';
      const result = await listarTramites({
        page: pagination.page,
        pageSize: filters.pageSize,
        search: filters.search || undefined,
        estado: isEnviadoARemitoFilter ? 'ok' : filters.estado,
        enviadoARemito: isEnviadoARemitoFilter ? true : undefined,
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
    // Después de importar: ir a página 1 y mostrar solo activos (pendiente + error)
    // para que los tramites nuevos aparezcan junto a los anteriores sin resolver.
    set((s) => ({
      pagination: { ...s.pagination, page: 1 },
      erroresExcel: resultado.errores,
      filters: { ...s.filters, estado: 'activos' },
    }));
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

  enviarARemito: async (id) => {
    const tramite = await apiEnviarARemito(id);
    set((s) => ({
      tramites: s.tramites.map((t) => (t.id === id ? tramite : t)),
      tramitesParaRemito: s.tramitesParaRemito.some((t) => t.id === id)
        ? s.tramitesParaRemito.map((t) => (t.id === id ? tramite : t))
        : [...s.tramitesParaRemito, tramite],
    }));
  },

  descartar: async (id) => {
    const tramite = await apiDescartar(id);
    set((s) => ({ tramites: s.tramites.map((t) => (t.id === id ? tramite : t)) }));
  },

  actualizarDatos: async (id, datos) => {
    const tramite = await apiActualizarDatos(id, datos);
    set((s) => ({
      tramites: s.tramites.map((t) => (t.id === id ? tramite : t)),
      tramitesParaRemito: s.tramitesParaRemito.map((t) => (t.id === id ? tramite : t)),
    }));
  },

  removerDeRemito: (ids) => {
    set((s) => ({ tramitesParaRemito: s.tramitesParaRemito.filter((t) => !ids.includes(t.id)) }));
  },

  limpiarErroresExcel: () => set({ erroresExcel: [] }),
}));
