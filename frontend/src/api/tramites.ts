import type { ExcelImportResult, GestorTramite, Remito, TramiteDatosUpdate, TramiteListParams, TramiteListResult } from '@shared/types';
import { apiClient } from './client';

export async function importarExcel(file: File): Promise<ExcelImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ExcelImportResult>('/api/excel/import', formData);
  return data;
}

export async function listarTramites(params?: TramiteListParams): Promise<TramiteListResult> {
  const { data } = await apiClient.get<TramiteListResult>('/api/tramites', { params });
  return data;
}

export async function actualizarFormularios(
  id: number,
  cambios: { formularioNro01?: string; formularioNro12?: string }
): Promise<GestorTramite> {
  const { data } = await apiClient.patch<{ tramite: GestorTramite }>(`/api/tramites/${id}`, cambios);
  return data.tramite;
}

export async function enviarSuats(ids: number[]): Promise<GestorTramite[]> {
  const { data } = await apiClient.post<{ tramites: GestorTramite[] }>('/api/tramites/enviar', { ids });
  return data.tramites;
}

export async function enviarARemito(id: number): Promise<GestorTramite> {
  const { data } = await apiClient.patch<{ tramite: GestorTramite }>(`/api/tramites/${id}/enviar-remito`);
  return data.tramite;
}

export async function actualizarDatosTramite(
  id: number,
  datos: TramiteDatosUpdate
): Promise<GestorTramite> {
  const { data } = await apiClient.patch<{ tramite: GestorTramite }>(`/api/tramites/${id}/datos`, datos);
  return data.tramite;
}

export async function descartarTramite(id: number): Promise<GestorTramite> {
  const { data } = await apiClient.patch<{ tramite: GestorTramite }>(`/api/tramites/${id}/descartar`);
  return data.tramite;
}

export async function listarRemitos(): Promise<Remito[]> {
  const { data } = await apiClient.get<{ remitos: Remito[] }>('/api/remitos');
  return data.remitos;
}

export async function generarRemito(tramiteIds: number[]): Promise<Remito> {
  const { data } = await apiClient.post<{ remito: Remito }>('/api/remitos', { tramiteIds });
  return data.remito;
}
