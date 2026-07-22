// Almacen en memoria que simula las tablas gestor_* mientras no hay
// conexion real a SQL Server. Se reinicia cada vez que se reinicia el server.

import type { GestorTramite, TramiteLog } from '../../../shared/types/index.js';

let nextTramiteId = 16;
let nextRemitoId = 1;

const D = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function logsOk(traID: string, ingID: string, msAgo: number): TramiteLog[] {
  return [
    { timestamp: D(msAgo + 3000), nivel: 'info', operacion: 'eco', mensaje: 'Servidor TRGS disponible', detalle: 'respuestaID: 1' },
    { timestamp: D(msAgo + 2500), nivel: 'info', operacion: 'abrir_sesion', mensaje: `Sesión abierta (${ingID})`, detalle: 'rspID: 1 — Sesion abierta' },
    { timestamp: D(msAgo + 1500), nivel: 'info', operacion: 'generar_tramite_01', mensaje: 'Trámite generado correctamente', detalle: `traID: ${traID} — Tramite generado correctamente (mock)` },
    { timestamp: D(msAgo + 500), nivel: 'info', operacion: 'cerrar_sesion', mensaje: 'Sesión cerrada' },
  ];
}

interface ErrInfo { rspID: number; rspDescrip: string; mensaje: string; accion: string }

function logsError(ingID: string, err: ErrInfo, msAgo: number): TramiteLog[] {
  return [
    { timestamp: D(msAgo + 3000), nivel: 'info', operacion: 'eco', mensaje: 'Servidor TRGS disponible', detalle: 'respuestaID: 1' },
    { timestamp: D(msAgo + 2500), nivel: 'info', operacion: 'abrir_sesion', mensaje: `Sesión abierta (${ingID})`, detalle: 'rspID: 1 — Sesion abierta' },
    {
      timestamp: D(msAgo + 1500), nivel: 'error', operacion: 'generar_tramite_01',
      mensaje: err.mensaje,
      detalle: `rspID: ${err.rspID} — ${err.rspDescrip} | Acción sugerida: ${err.accion}`,
      fuenteMensaje: 'netdriver',
    },
    { timestamp: D(msAgo + 500), nivel: 'info', operacion: 'cerrar_sesion', mensaje: 'Sesión cerrada' },
  ];
}

const ERR_14: ErrInfo = {
  rspID: -14, rspDescrip: 'rspID -14: CUIT del titular no coincide con AFIP',
  mensaje: 'El CUIT del titular no coincide con los datos registrados en AFIP',
  accion: 'Verificar el CUIT en la columna O del Excel',
};
const ERR_22: ErrInfo = {
  rspID: -22, rspDescrip: 'rspID -22: Codigo de fabrica inexistente en tabla TRGS',
  mensaje: 'El código de fábrica no existe en la base de datos de TRGS',
  accion: 'Revisar las columnas J, K y L del Excel (codFabrica)',
};
const ERR_30: ErrInfo = {
  rspID: -30, rspDescrip: 'rspID -30: El numero de chasis ya fue registrado en TRGS',
  mensaje: 'El número de chasis ya tiene un trámite registrado en TRGS',
  accion: 'Verificar si el vehículo ya posee un trámite anterior',
};

const b64 = (txt: string) => Buffer.from(txt).toString('base64');

export const tramitesStore: GestorTramite[] = [
  {
    id: 1,
    auto: { id: 1, facturaNro: 'F-00123', facturaFecha: '2026-05-02', nroChasis: '8AJFA01234X567890', marcaChasis: 'TOYOTA', modelo: 'HILUX 4X4', nroMotor: '2GD1234567', marcaMotor: 'TOYOTA', ano: 2026, codFabrica: 'TOYHIL2026', facturaMonto: 32500000, certificadoFabrica: 'CERT-44321', codigoClase: 6801 },
    titular: { id: 1, idGestor: 5452, nombre: 'MARTINEZ, JUAN CARLOS', cuit: '20304050607', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(3600000),
  },
  {
    id: 2,
    auto: { id: 2, facturaNro: 'F-00124', facturaFecha: '2026-05-03', nroChasis: '9BWZZZ377VT004251', marcaChasis: 'VOLKSWAGEN', modelo: 'AMAROK', nroMotor: 'CDC9876543', marcaMotor: 'VOLKSWAGEN', ano: 2026, codFabrica: 'VWAMA2026', facturaMonto: 41200000, certificadoFabrica: 'CERT-44322', codigoClase: 6802 },
    titular: { id: 2, idGestor: 5452, nombre: 'TRANSPORTES PATAGONIA SA', cuit: '30712345678', idTipoPersona: 0 },
    estado: 'ok', traID: 'TRA-998211', errorDesc: null, formularioNro01: '01-887766', formularioNro12: '12-554433',
    formularios: [
      { id: 1, idTramite: 2, tipo: 'F01importado', numero: '01-887766', pdfBase64: b64('PDF MOCK F01importado TRA-998211') },
      { id: 2, idTramite: 2, tipo: 'F12', numero: '12-554433', pdfBase64: b64('PDF MOCK F12 TRA-998211') },
    ],
    logs: logsOk('TRA-998211', 'ING-000005-1748822400', 86400000),
    creadoEn: D(86400000),
  },
  {
    id: 3,
    auto: { id: 3, facturaNro: 'F-00125', facturaFecha: '2026-05-04', nroChasis: '8AD12345678901234', marcaChasis: 'FORD', modelo: 'RANGER', nroMotor: 'P5AT778899', marcaMotor: 'FORD', ano: 2025, codFabrica: 'FORRAN2025', facturaMonto: 38900000, certificadoFabrica: 'CERT-44320', codigoClase: 6801 },
    titular: { id: 3, idGestor: 5452, nombre: 'GOMEZ, ANA LUCIA', cuit: '27298765432', idTipoPersona: 9 },
    estado: 'error', traID: null, errorDesc: ERR_14.rspDescrip, formularioNro01: '01-112233', formularioNro12: null, formularios: [],
    logs: logsError('ING-000005-1748736000', ERR_14, 172800000),
    creadoEn: D(172800000),
  },
  {
    id: 4,
    auto: { id: 4, facturaNro: 'F-00126', facturaFecha: '2026-05-05', nroChasis: '3CZRU5H57GM700001', marcaChasis: 'HONDA', modelo: 'CR-V', nroMotor: 'K24W5001234', marcaMotor: 'HONDA', ano: 2026, codFabrica: 'HONCRV2026', facturaMonto: 35600000, certificadoFabrica: 'CERT-44323', codigoClase: 6802 },
    titular: { id: 4, idGestor: 5452, nombre: 'DIAZ, CARLOS ALBERTO', cuit: '20111222333', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(7200000),
  },
  {
    id: 5,
    auto: { id: 5, facturaNro: 'F-00127', facturaFecha: '2026-05-06', nroChasis: '8A1ZB01234Y123456', marcaChasis: 'RENAULT', modelo: 'KANGOO', nroMotor: 'K9K002345', marcaMotor: 'RENAULT', ano: 2026, codFabrica: 'RENKAN2026', facturaMonto: 21500000, certificadoFabrica: 'CERT-44324', codigoClase: 6801 },
    titular: { id: 5, idGestor: 5452, nombre: 'FERREIRA, LUCIA BEATRIZ', cuit: '27334455667', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(5400000),
  },
  {
    id: 6,
    auto: { id: 6, facturaNro: 'F-00128', facturaFecha: '2026-05-07', nroChasis: 'VF3CCHNZPJS500001', marcaChasis: 'PEUGEOT', modelo: '208', nroMotor: 'EB2A500001', marcaMotor: 'PEUGEOT', ano: 2026, codFabrica: 'PEU2082026', facturaMonto: 18900000, certificadoFabrica: 'CERT-44325', codigoClase: 6802 },
    titular: { id: 6, idGestor: 5452, nombre: 'RODRIGUEZ HERMANOS SRL', cuit: '30556677889', idTipoPersona: 0 },
    estado: 'ok', traID: 'TRA-772341', errorDesc: null, formularioNro01: '01-221100', formularioNro12: '12-443322',
    formularios: [
      { id: 3, idTramite: 6, tipo: 'F01importado', numero: '01-221100', pdfBase64: b64('PDF MOCK F01importado TRA-772341') },
      { id: 4, idTramite: 6, tipo: 'F12', numero: '12-443322', pdfBase64: b64('PDF MOCK F12 TRA-772341') },
    ],
    logs: logsOk('TRA-772341', 'ING-000005-1748909000', 259200000),
    creadoEn: D(259200000),
  },
  {
    id: 7,
    auto: { id: 7, facturaNro: 'F-00129', facturaFecha: '2026-05-08', nroChasis: '8ZNEF1EA1GX900001', marcaChasis: 'CHEVROLET', modelo: 'TRACKER', nroMotor: 'LVF900001', marcaMotor: 'CHEVROLET', ano: 2026, codFabrica: 'CHETRA2026', facturaMonto: 29800000, certificadoFabrica: 'CERT-44326', codigoClase: 6801 },
    titular: { id: 7, idGestor: 5452, nombre: 'PEREZ, MARTIN ALEJANDRO', cuit: '20445566778', idTipoPersona: 9 },
    estado: 'error', traID: null, errorDesc: ERR_22.rspDescrip, formularioNro01: '01-334411', formularioNro12: '12-556644', formularios: [],
    logs: logsError('ING-000005-1748823000', ERR_22, 345600000),
    creadoEn: D(345600000),
  },
  {
    id: 8,
    auto: { id: 8, facturaNro: 'F-00130', facturaFecha: '2026-05-09', nroChasis: '8AJFB01234X000001', marcaChasis: 'NISSAN', modelo: 'FRONTIER', nroMotor: 'YD25900001', marcaMotor: 'NISSAN', ano: 2026, codFabrica: 'NISFRO2026', facturaMonto: 45200000, certificadoFabrica: 'CERT-44327', codigoClase: 6801 },
    titular: { id: 8, idGestor: 5452, nombre: 'VILLA, ROBERTO GERMAN', cuit: '20778899001', idTipoPersona: 9 },
    estado: 'ok', traID: 'TRA-654321', errorDesc: null, formularioNro01: '01-009988', formularioNro12: '12-776655',
    formularios: [
      { id: 5, idTramite: 8, tipo: 'F01', numero: '01-009988', pdfBase64: b64('PDF MOCK F01 TRA-654321') },
      { id: 6, idTramite: 8, tipo: 'F12', numero: '12-776655', pdfBase64: b64('PDF MOCK F12 TRA-654321') },
    ],
    logs: logsOk('TRA-654321', 'ING-000005-1748824000', 432000000),
    creadoEn: D(432000000),
  },
  {
    id: 9,
    auto: { id: 9, facturaNro: 'F-00131', facturaFecha: '2026-05-10', nroChasis: 'JTDVT503X00700001', marcaChasis: 'TOYOTA', modelo: 'COROLLA', nroMotor: '2ZR700001', marcaMotor: 'TOYOTA', ano: 2026, codFabrica: 'TOYCOR2026', facturaMonto: 24300000, certificadoFabrica: 'CERT-44328', codigoClase: 6802 },
    titular: { id: 9, idGestor: 5452, nombre: 'CASTILLO, MARIA ELENA', cuit: '27889900112', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(1800000),
  },
  {
    id: 10,
    auto: { id: 10, facturaNro: 'F-00132', facturaFecha: '2026-05-11', nroChasis: 'WVWZZZ6RZ0W000001', marcaChasis: 'VOLKSWAGEN', modelo: 'POLO', nroMotor: 'BLF000001', marcaMotor: 'VOLKSWAGEN', ano: 2026, codFabrica: 'VWPOL2026', facturaMonto: 19700000, certificadoFabrica: 'CERT-44329', codigoClase: 6802 },
    titular: { id: 10, idGestor: 5452, nombre: 'ACOSTA, PABLO NICOLAS', cuit: '20100110223', idTipoPersona: 9 },
    estado: 'ok', traID: 'TRA-321654', errorDesc: null, formularioNro01: '01-118877', formularioNro12: '12-998866',
    formularios: [
      { id: 7, idTramite: 10, tipo: 'F01importado', numero: '01-118877', pdfBase64: b64('PDF MOCK F01importado TRA-321654') },
      { id: 8, idTramite: 10, tipo: 'F12', numero: '12-998866', pdfBase64: b64('PDF MOCK F12 TRA-321654') },
    ],
    logs: logsOk('TRA-321654', 'ING-000005-1748826000', 518400000),
    creadoEn: D(518400000),
  },
  {
    id: 11,
    auto: { id: 11, facturaNro: 'F-00133', facturaFecha: '2026-05-12', nroChasis: '8AGZB0107R0000001', marcaChasis: 'FIAT', modelo: 'CRONOS', nroMotor: 'FCA0000001', marcaMotor: 'FIAT', ano: 2026, codFabrica: 'FIACRO2026', facturaMonto: 17400000, certificadoFabrica: 'CERT-44330', codigoClase: 6801 },
    titular: { id: 11, idGestor: 5452, nombre: 'MORENO, SILVIA GRACIELA', cuit: '27221133445', idTipoPersona: 9 },
    estado: 'error', traID: null, errorDesc: ERR_22.rspDescrip, formularioNro01: '01-667788', formularioNro12: null, formularios: [],
    logs: logsError('ING-000005-1748827000', ERR_22, 604800000),
    creadoEn: D(604800000),
  },
  {
    id: 12,
    auto: { id: 12, facturaNro: 'F-00134', facturaFecha: '2026-05-13', nroChasis: '1C4RJFBG0LC000001', marcaChasis: 'JEEP', modelo: 'RENEGADE', nroMotor: 'B4EP000001', marcaMotor: 'FCA', ano: 2026, codFabrica: 'JEEPRN2026', facturaMonto: 31100000, certificadoFabrica: 'CERT-44331', codigoClase: 6802 },
    titular: { id: 12, idGestor: 5452, nombre: 'DISTRIBUIDORA NORTE SA', cuit: '30998877665', idTipoPersona: 0 },
    estado: 'ok', traID: 'TRA-246810', errorDesc: null, formularioNro01: '01-335577', formularioNro12: '12-668800',
    formularios: [
      { id: 9, idTramite: 12, tipo: 'F01importado', numero: '01-335577', pdfBase64: b64('PDF MOCK F01importado TRA-246810') },
      { id: 10, idTramite: 12, tipo: 'F12', numero: '12-668800', pdfBase64: b64('PDF MOCK F12 TRA-246810') },
    ],
    logs: logsOk('TRA-246810', 'ING-000005-1748828000', 691200000),
    creadoEn: D(691200000),
  },
  {
    id: 13,
    auto: { id: 13, facturaNro: 'F-00135', facturaFecha: '2026-05-14', nroChasis: '8AFB10G24Q0000001', marcaChasis: 'FORD', modelo: 'TERRITORY', nroMotor: 'HY15T000001', marcaMotor: 'FORD', ano: 2026, codFabrica: 'FORDTR2026', facturaMonto: 28500000, certificadoFabrica: 'CERT-44332', codigoClase: 6801 },
    titular: { id: 13, idGestor: 5452, nombre: 'IBARRA, MIGUEL ANGEL', cuit: '20443355669', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(4320000),
  },
  {
    id: 14,
    auto: { id: 14, facturaNro: 'F-00136', facturaFecha: '2026-05-15', nroChasis: 'WDD2050011R000001', marcaChasis: 'MERCEDES', modelo: 'C200', nroMotor: 'OM274000001', marcaMotor: 'MERCEDES', ano: 2026, codFabrica: 'MERC2002026', facturaMonto: 71500000, certificadoFabrica: 'CERT-44333', codigoClase: 6802 },
    titular: { id: 14, idGestor: 5452, nombre: 'LOPEZ, CARLOS DANIEL', cuit: '20557788990', idTipoPersona: 9 },
    estado: 'error', traID: null, errorDesc: ERR_30.rspDescrip, formularioNro01: '01-990011', formularioNro12: '12-112233', formularios: [],
    logs: logsError('ING-000005-1748829000', ERR_30, 777600000),
    creadoEn: D(777600000),
  },
  {
    id: 15,
    auto: { id: 15, facturaNro: 'F-00137', facturaFecha: '2026-05-16', nroChasis: '8ACKB02034A000001', marcaChasis: 'HYUNDAI', modelo: 'TUCSON', nroMotor: 'G4NA000001', marcaMotor: 'HYUNDAI', ano: 2026, codFabrica: 'HYUTUC2026', facturaMonto: 33200000, certificadoFabrica: 'CERT-44334', codigoClase: 6801 },
    titular: { id: 15, idGestor: 5452, nombre: 'SUAREZ, GABRIELA INES', cuit: '27667788990', idTipoPersona: 9 },
    estado: 'pendiente', traID: null, errorDesc: null, formularioNro01: null, formularioNro12: null, formularios: [], logs: [], creadoEn: D(2700000),
  },
];

export const remitosStore: { id: number; numero: string; tramiteIds: number[]; creadoEn: string }[] = [];

export function addTramites(nuevos: Omit<GestorTramite, 'id'>[]): GestorTramite[] {
  const creados = nuevos.map((t) => ({ ...t, id: nextTramiteId++, logs: [] as TramiteLog[] }));
  tramitesStore.push(...creados);
  return creados;
}

export function findTramite(id: number): GestorTramite | undefined {
  return tramitesStore.find((t) => t.id === id);
}

export function nextRemitoNumero(): { id: number; numero: string } {
  const id = nextRemitoId++;
  return { id, numero: `REM-${String(id).padStart(6, '0')}` };
}
