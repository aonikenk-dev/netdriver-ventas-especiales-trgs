import { create } from 'zustand';
import type { Remito } from '@shared/types';
import {
  listarRemitos,
  getRemitoActivo,
  abrirNuevoRemito as apiAbrirNuevo,
  cerrarRemito as apiCerrar,
  abrirRemito as apiAbrir,
} from '@/api/tramites';

interface RemitosState {
  remitos: Remito[];
  remitoAbierto: Remito | null;
  loading: boolean;
  procesando: boolean;
  fetchRemitos: () => Promise<void>;
  fetchRemitoAbierto: () => Promise<void>;
  abrirNuevo: () => Promise<Remito>;
  cerrar: (id: number) => Promise<Remito>;
  abrir: (id: number) => Promise<Remito>;
}

export const useRemitosStore = create<RemitosState>((set, get) => ({
  remitos: [],
  remitoAbierto: null,
  loading: false,
  procesando: false,

  fetchRemitos: async () => {
    set({ loading: true });
    try {
      const remitos = await listarRemitos();
      set({
        remitos,
        remitoAbierto: remitos.find((r) => r.estado === 'abierto') ?? null,
      });
    } finally {
      set({ loading: false });
    }
  },

  fetchRemitoAbierto: async () => {
    const activo = await getRemitoActivo();
    set({ remitoAbierto: activo });
  },

  abrirNuevo: async () => {
    set({ procesando: true });
    try {
      const remito = await apiAbrirNuevo();
      set((s) => ({
        // Cierra cualquier abierto anterior en el estado local
        remitos: [
          remito,
          ...s.remitos.map((r) =>
            r.estado === 'abierto' ? { ...r, estado: 'cerrado' as const } : r
          ),
        ],
        remitoAbierto: remito,
      }));
      return remito;
    } finally {
      set({ procesando: false });
    }
  },

  cerrar: async (id) => {
    set({ procesando: true });
    try {
      const remito = await apiCerrar(id);
      set((s) => ({
        remitos: s.remitos.map((r) => (r.id === id ? remito : r)),
        remitoAbierto: s.remitoAbierto?.id === id ? null : s.remitoAbierto,
      }));
      return remito;
    } finally {
      set({ procesando: false });
    }
  },

  abrir: async (id) => {
    set({ procesando: true });
    try {
      const remito = await apiAbrir(id);
      set((s) => ({
        remitos: s.remitos.map((r) => {
          if (r.id === id) return remito;
          if (r.estado === 'abierto') return { ...r, estado: 'cerrado' as const };
          return r;
        }),
        remitoAbierto: remito,
      }));
      return remito;
    } finally {
      set({ procesando: false });
    }
  },
}));
