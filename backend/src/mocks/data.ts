// Almacen en memoria que simula las tablas gestor_* mientras no hay
// conexion real a SQL Server. Se reinicia cada vez que se reinicia el server.

import type { GestorTramite } from '../../../shared/types/index.js';

let nextTramiteId = 4;

export const tramitesStore: GestorTramite[] = [
  {
    id: 1,
    auto: {
      id: 1,
      facturaNro: 'F-00123',
      facturaFecha: '2026-05-02',
      nroChasis: '8AJFA01234X567890',
      marcaChasis: 'TOYOTA',
      modelo: 'HILUX 4x4',
      nroMotor: '2GD1234567',
      marcaMotor: 'TOYOTA',
      ano: 2026,
      codFabrica: 'TOYHIL2026',
      facturaMonto: 32500000,
      certificadoFabrica: 'CERT-44321',
      codigoClase: 6801,
    },
    titular: { id: 1, idGestor: 5452, nombre: 'MARTINEZ, JUAN CARLOS', cuit: '20304050607', idTipoPersona: 9 },
    estado: 'pendiente',
    traID: null,
    errorDesc: null,
    formularioNro01: null,
    formularioNro12: null,
    formularios: [],
    creadoEn: new Date().toISOString(),
  },
  {
    id: 2,
    auto: {
      id: 2,
      facturaNro: 'F-00124',
      facturaFecha: '2026-05-03',
      nroChasis: '9BWZZZ377VT004251',
      marcaChasis: 'VOLKSWAGEN',
      modelo: 'AMAROK',
      nroMotor: 'CDC9876543',
      marcaMotor: 'VOLKSWAGEN',
      ano: 2026,
      codFabrica: 'VWAMA2026',
      facturaMonto: 41200000,
      certificadoFabrica: 'CERT-44322',
      codigoClase: 6802,
    },
    titular: { id: 2, idGestor: 5452, nombre: 'TRANSPORTES PATAGONIA SA', cuit: '30712345678', idTipoPersona: 0 },
    estado: 'ok',
    traID: 'TRA-998211',
    errorDesc: null,
    formularioNro01: '01-887766',
    formularioNro12: '12-554433',
    formularios: [
      { id: 1, idTramite: 2, tipo: 'F01importado', numero: '01-887766' },
      { id: 2, idTramite: 2, tipo: 'F12', numero: '12-554433' },
    ],
    creadoEn: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 3,
    auto: {
      id: 3,
      facturaNro: 'F-00125',
      facturaFecha: '2026-05-04',
      nroChasis: '8AD12345678901234',
      marcaChasis: 'FORD',
      modelo: 'RANGER',
      nroMotor: 'P5AT778899',
      marcaMotor: 'FORD',
      ano: 2025,
      codFabrica: 'FORRAN2025',
      facturaMonto: 38900000,
      certificadoFabrica: 'CERT-44320',
      codigoClase: 6801,
    },
    titular: { id: 3, idGestor: 5452, nombre: 'GOMEZ, ANA LUCIA', cuit: '27298765432', idTipoPersona: 9 },
    estado: 'error',
    traID: null,
    errorDesc: 'rspID -14: CUIT del titular no coincide con AFIP',
    formularioNro01: '01-112233',
    formularioNro12: null,
    formularios: [],
    creadoEn: new Date(Date.now() - 172_800_000).toISOString(),
  },
];

export const remitosStore: { id: number; numero: string; tramiteIds: number[]; creadoEn: string }[] = [];
let nextRemitoId = 1;

export function addTramites(nuevos: Omit<GestorTramite, 'id'>[]): GestorTramite[] {
  const creados = nuevos.map((t) => ({ ...t, id: nextTramiteId++ }));
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
