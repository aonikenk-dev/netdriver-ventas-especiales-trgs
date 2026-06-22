import { create } from 'zustand';
import type { GestorTramite } from '@shared/types';
import {
  actualizarFormularios,
  enviarSuats,
  importarExcel,
  listarTramites,
} from '@/api/tramites';

interface TramitesState {
  tramites: GestorTramite[];
  loading: boolean;
  enviando: boolean;
  fetchTramites: () => Promise<void>;
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

  fetchTramites: async () => {
    set({ loading: true });
    try {
      const tramites = await listarTramites();
      set({ tramites });
    } finally {
      set({ loading: false });
    }
  },

  importarDesdeExcel: async (file) => {
    const resultado = await importarExcel(file);
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
