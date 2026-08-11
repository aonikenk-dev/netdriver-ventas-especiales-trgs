
export type EstadoTramite = 'pendiente' | 'enviando' | 'ok' | 'error' | 'descartado';

export type CodigoClase = 6801 | 6802; // 6801 nacional, 6802 importado

export interface TramiteLog {
  timestamp: string;
  nivel: 'info' | 'warning' | 'error';
  operacion: 'eco' | 'abrir_sesion' | 'generar_tramite_01' | 'cerrar_sesion' | 'interno';
  mensaje: string;
  detalle?: string;
  fuenteMensaje?: 'netdriver' | 'trgs';
}

export interface GestorAuto {
  id: number;
  facturaNro: string;
  facturaFecha: string;
  nroChasis: string;
  marcaChasis: string;
  modelo: string;
  nroMotor: string;
  marcaMotor: string;
  ano: number;
  codFabrica: string;
  facturaMonto: number;
  certificadoFabrica: string;
  codigoClase: CodigoClase;
}

export interface GestorPersona {
  id: number;
  idGestor: number;
  nombre: string;
  cuit: string;
  idTipoPersona: number; // 9 persona física (constante), 0 persona jurídica
}

export interface VeApoderado {
  idPersonaTitular: number;
  idPersonaApoderado: number;
}

export interface GestorTitular {
  idTramite: number;
  idPersona: number;
  porcentaje: 100;
}

export interface GestorFormulario {
  id: number;
  idTramite: number;
  tipo: 'F01' | 'F01importado' | 'F12';
  numero: string;
  pdfBase64?: string;
}

export interface GestorTramite {
  id: number;
  auto: GestorAuto;
  titular: GestorPersona;
  estado: EstadoTramite;
  traID: string | null;
  errorDesc: string | null;
  formularioNro01: string | null;
  formularioNro12: string | null;
  formularios: GestorFormulario[];
  logs: TramiteLog[];
  creadoEn: string;
  enviadoARemito?: boolean;
}

export interface ExcelImportRowError {
  fila: number;
  motivo: string;
  datos?: {
    facturaNro?: string;
    chasis?: string;
    titular?: string;
    cuit?: string;
    codFabrica?: string;
  };
}

export interface ExcelImportResult {
  tramites: Omit<GestorTramite, 'id'>[];
  errores: ExcelImportRowError[];
}

export interface TramiteListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: EstadoTramite | 'all' | 'activos';
  ni?: 'all' | '6801' | '6802';
  enviadoARemito?: boolean;
  sortBy?: 'creadoEn' | 'chasis' | 'titular' | 'estado';
  sortDir?: 'asc' | 'desc';
}

export interface TramiteListResult {
  tramites: GestorTramite[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TrgDatosTramite {
  traTelefono: string;
  traCalle: string;
  traNumero: string;
  traCalle_R?: string;
  traNumero_R?: string;
  traEmail: string;
  traOcupacion: string;
  traCP: string;
  traCP_R?: string;
  traLugarNacimiento: string;
  traDocumento: number;
  traDocumento_C?: string;
  traCuit: number;
  traCuitTitular?: number;
  traCedulas?: TrgCedula | TrgCedula[];
  apoDocumento?: number;
  apoTelefono?: string;
  apoCalle?: string;
  apoNumero?: string;
  apoEmail?: string;
  apoOcupacion?: string;
  apoCP?: string;
  apoLugarNacimiento?: string;
  apoCuit?: number;
}

export interface TrgCedula {
  traDocumento: string;
  traNombre: string;
}

export interface TrgRespuesta {
  rspID: number;
  rspDescrip: string;
}

export interface TrgEcoRespuesta extends TrgRespuesta {
  respuestaID: number;
}

export interface TrgSesionRespuesta extends TrgRespuesta {
  ingID: string;
}

export interface TrgTramiteRespuesta extends TrgRespuesta {
  traID: string;
}

export interface RemitoTramite {
  id: number;
  nroChasis: string;
  marcaChasis: string;
  modelo: string;
  titular: string;
  cuit: string;
  traID: string | null;
  certificadoFabrica: string | null;
  formularioNro01: string | null;
  formularioNro12: string | null;
}

export interface Remito {
  id: number;
  numero: string;
  tramiteIds: number[];
  tramites: RemitoTramite[];
  creadoEn: string;
  pdfUrl: string;
  excelUrl: string;
}

export type TipoFormularioDescarga =
  | 'F01'
  | 'F01importado'
  | 'F12'
  | 'Enmienda'
  | 'DDJJ';

export type TipoPdfLocal = 'factura' | 'certificado';
