import { create } from 'zustand';
import type { Remito } from '@shared/types';
import { generarRemito, listarRemitos } from '@/api/tramites';

interface RemitosState {
  remitos: Remito[];
  loading: boolean;
  generando: boolean;
  fetchRemitos: () => Promise<void>;
  crearRemito: (tramiteIds: number[]) => Promise<Remito>;
}

export const useRemitosStore = create<RemitosState>((set, get) => ({
  remitos: [],
  loading: false,
  generando: false,

  fetchRemitos: async () => {
    set({ loading: true });
    try {
      const remitos = await listarRemitos();
      set({ remitos });
    } finally {
      set({ loading: false });
    }
  },

  crearRemito: async (tramiteIds) => {
    set({ generando: true });
    try {
      const remito = await generarRemito(tramiteIds);
      set({ remitos: [remito, ...get().remitos] });
      return remito;
    } finally {
      set({ generando: false });
    }
  },
}));
