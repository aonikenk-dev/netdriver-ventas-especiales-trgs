import { apiClient } from './client';

export interface FacturaUploadError {
  pagina: number;
  motivo: string;
}

export interface CertificadoUploadError {
  archivo: string;
  motivo: string;
}

export interface FacturasUploadResult {
  total: number;
  resultados: { pagina: number; nroChasis: string; fileName: string }[];
  errores: FacturaUploadError[];
  directorio: string;
}

export interface CertificadosUploadResult {
  total: number;
  guardados: string[];
  errores: CertificadoUploadError[];
  directorio: string;
}

export async function uploadFacturas(file: File): Promise<FacturasUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<FacturasUploadResult>('/api/upload/facturas', form);
  return data;
}

export async function uploadCertificados(file: File): Promise<CertificadosUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<CertificadosUploadResult>('/api/upload/certificados', form);
  return data;
}
