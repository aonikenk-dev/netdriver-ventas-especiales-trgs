
export type EstadoTramite = 'pendiente' | 'enviando' | 'ok' | 'error';

export type CodigoClase = 6801 | 6802; // 6801 nacional, 6802 importado

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
  creadoEn: string;
}

export interface ExcelImportRowError {
  fila: number;
  motivo: string;
}

export interface ExcelImportResult {
  tramites: Omit<GestorTramite, 'id'>[];
  errores: ExcelImportRowError[];
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

export interface Remito {
  id: number;
  numero: string;
  tramiteIds: number[];
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
