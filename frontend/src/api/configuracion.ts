import { apiClient } from './client';

export interface Configuracion {
  PDF_DIR: string;
  [key: string]: string;
}

export async function getConfiguracion(): Promise<Configuracion> {
  const { data } = await apiClient.get<{ config: Configuracion }>('/api/configuracion');
  return data.config;
}

export async function saveConfiguracion(cambios: Partial<Configuracion>): Promise<Configuracion> {
  const { data } = await apiClient.put<{ config: Configuracion }>('/api/configuracion', cambios);
  return data.config;
}
