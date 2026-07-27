// Mapeo de columnas A-U del Excel de carga + reglas de negocio.
// PROTOTIPO: el resultado se persiste en el almacen en memoria
// (src/mocks/data.ts) en lugar de gestor_autos / gestor_personas reales.

import * as XLSX from 'xlsx';
import type {
  CodigoClase,
  ExcelImportRowError,
  ExcelImportResult,
  GestorTramite,
} from '../../../shared/types/index.js';

const ID_GESTOR = 5452; // constante del cliente (Gestoria id 5452)
const HEADER_ROWS = 1; // la primera fila del Excel es encabezado

function codigoClaseDesdeChasis(nroChasis: string): CodigoClase {
  return nroChasis.trim().charAt(0) === '8' ? 6801 : 6802;
}

function parseFecha(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Fallback: número de serie Excel → fecha UTC
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val ?? '').trim();
}

export function parseExcelBuffer(buffer: Buffer): ExcelImportResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, blankrows: false });

  const tramites: Omit<GestorTramite, 'id'>[] = [];
  const errores: ExcelImportRowError[] = [];

  filas.slice(HEADER_ROWS).forEach((fila, index) => {
    const numeroFila = index + HEADER_ROWS + 1;
    const celda = (col: number) => String(fila[col] ?? '').trim();

    const facturaNro = celda(0); // A
    const facturaFecha = parseFecha(fila[1]); // B — puede llegar como Date, número de serie o string
    // C: ignorar
    const nroChasis = celda(3); // D
    const marcaChasis = celda(4); // E
    const modelo = celda(5); // F
    const nroMotor = celda(6); // G
    const marcaMotor = celda(7); // H
    const ano = Number(celda(8)); // I
    const codFabrica = `${celda(9)}${celda(10)}${celda(11)}`; // J+K+L
    const facturaMonto = Number(celda(12)); // M
    const nombreTitular = celda(13); // N
    const cuit = celda(14); // O
    // P: ignorar
    const certificadoFabrica = celda(16); // Q
    // R,S,T,U: ignorar

    if (!facturaNro || !nroChasis || !nombreTitular || !cuit) {
      errores.push({
        fila: numeroFila,
        motivo: 'Faltan campos obligatorios (factura, chasis, titular o CUIT)',
        datos: {
          facturaNro: facturaNro || undefined,
          chasis: nroChasis || undefined,
          titular: nombreTitular || undefined,
          cuit: cuit || undefined,
          codFabrica: codFabrica || undefined,
        },
      });
      return;
    }

    tramites.push({
      auto: {
        id: 0,
        facturaNro,
        facturaFecha,
        nroChasis,
        marcaChasis,
        modelo,
        nroMotor,
        marcaMotor,
        ano,
        codFabrica,
        facturaMonto,
        certificadoFabrica,
        codigoClase: codigoClaseDesdeChasis(nroChasis),
      },
      titular: {
        id: 0,
        idGestor: ID_GESTOR,
        nombre: nombreTitular,
        cuit,
        idTipoPersona: 9, // constante (persona fisica); persona juridica = 0
      },
      estado: 'pendiente',
      traID: null,
      errorDesc: null,
      formularioNro01: null,
      formularioNro12: null,
      formularios: [],
      logs: [],
      creadoEn: new Date().toISOString(),
    });
  });

  return { tramites, errores };
}
