// Construye el payload completo para generar_tramite_01 desde un GestorTramite.
// Los campos que no están disponibles en nuestro esquema simplificado se envían
// como strings vacíos; el WS responderá con el rspID correspondiente si son requeridos.

import type { GestorTramite } from '../../../shared/types/index.js';

// ─── Tipos del payload ────────────────────────────────────────────────────────

interface TrgTitular {
  frmID: string;
  traTT: string;
  tdcID: string;
  traDocumento: number;
  traSexo: string;
  emdID: number;
  nacID: number;
  traCuit: number;
  traNombre: string;
  traApellido: string;
  traPorcentaje: number;
  traFecNac: string;
  escID: string;
  traNupcias: string;
  tdcID_C: string;
  traDocumento_C: string;
  traNombre_C: string;
  traApellido_C: string;
  traPersoneria_C: string;
  traNumero_C: string;
  traFecCre_C: string;
  traEmail: string;
  traOcupacion: string;
  traTelefono: string;
  traLugarNacimiento: string;
  traCalle: string;
  traNumero: string;
  traPiso: string;
  traDpto: string;
  traCP: string;
  traLocalidad: string;
  traBarrio: string;
  zonID: string;
  traMunicipalidad: string;
  traCalle_R: string;
  traNumero_R: string;
  traPiso_R: string;
  traDpto_R: string;
  traCP_R: string;
  traLocalidad_R: string;
  traBarrio_R: string;
  zonID_R: string;
  traMunicipalidad_R: string;
}

export interface TrgPayload {
  datosDelTramite: Record<string, unknown>;
  datosTitulares: { trgArrayTitularesTramites: TrgTitular };
  datosVehiculo: { cerID: string; cerNumeroCC: string; cerTipo: string };
  datosCedulasAzul: Record<string, unknown>;
  datosApoderados: Record<string, unknown>;
  datosTitularesDJApoderados: Record<string, unknown>;
  datosGuardaHabitual: Record<string, unknown>;
  datosPrestamo: Record<string, unknown>;
  datosAutopartes: { formaPago: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cuitNumerico(cuit: string): number {
  return parseFloat(cuit.replace(/-/g, '')) || 0;
}

function dniDesdeCuit(cuit: string): number {
  const soloNums = cuit.replace(/-/g, '');
  // CUIT: XX + 8 dígitos DNI + D → extraer posiciones 2..9
  if (soloNums.length >= 10) return parseInt(soloNums.slice(2, 10), 10) || 0;
  return cuitNumerico(cuit);
}

// Divide "APELLIDO NOMBRE" o "APELLIDO, NOMBRE" en apellido y nombre.
// La lógica es best-effort: en Argentina los DB suelen venir "APELLIDO NOMBRE".
function splitNombreApellido(nombreCompleto: string): { nombre: string; apellido: string } {
  const limpio = nombreCompleto.trim().toUpperCase();
  if (limpio.includes(',')) {
    const [ap, nm] = limpio.split(',', 2);
    return { apellido: ap.trim(), nombre: nm.trim() };
  }
  const partes = limpio.split(/\s+/);
  if (partes.length === 1) return { apellido: limpio, nombre: '' };
  return { apellido: partes[0], nombre: partes.slice(1).join(' ') };
}

// Parsea el nroFactura (ej. "B0065-00127868" o "0065-00127868") en sus partes.
// Retorna defaults si el formato no es reconocible.
function parsearFactura(facturaNro: string): {
  ticID: string;
  codigoPuntoVenta: string;
  elpFacNum: string;
} {
  const s = facturaNro.trim().toUpperCase().replace(/\s+/g, '');

  // Intentar "L####-########" o "L #### ########" o "####-########"
  const match = s.match(/^([A-Z]?)(\d{1,4})[-\s]?(\d{4,8})$/);
  if (match) {
    const letra = match[1];
    const pventa = match[2].padStart(4, '0');
    const nro = match[3].padStart(8, '0');
    const ticID = { A: '01', B: '06', C: '11', M: '51', X: '06' }[letra] ?? '06';
    return { ticID, codigoPuntoVenta: pventa, elpFacNum: nro };
  }

  // Formato largo "B 0065 00127868" (sin guion)
  const match2 = s.match(/^([A-Z]?)(\d{4})(\d{8})$/);
  if (match2) {
    const letra = match2[1];
    const ticID = { A: '01', B: '06', C: '11', M: '51', X: '06' }[letra] ?? '06';
    return { ticID, codigoPuntoVenta: match2[2], elpFacNum: match2[3] };
  }

  // Fallback: enviar el número como elpFacNum sin parsear
  return { ticID: '06', codigoPuntoVenta: '0001', elpFacNum: s.slice(-8).padStart(8, '0') };
}

// Normaliza una fecha a "YYYY-MM-DD". Acepta "DD/MM/YYYY" o ISO.
function normalizarFecha(fecha: string): string {
  if (!fecha) return '';
  const dmY = fecha.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return fecha.slice(0, 10); // ISO slice
}

// ─── Constructor principal ────────────────────────────────────────────────────

export function buildTrgPayload(
  tramite: GestorTramite,
  formulario01: string,
  formulario12: string,
): TrgPayload {
  const { auto, titular } = tramite;
  const { apellido, nombre } = splitNombreApellido(titular.nombre);
  const cuitNum = cuitNumerico(titular.cuit);
  const dniNum  = dniDesdeCuit(titular.cuit);
  const { ticID, codigoPuntoVenta, elpFacNum } = parsearFactura(auto.facturaNro ?? '');

  const titularPayload: TrgTitular = {
    frmID:            formulario01,
    traTT:            'P',
    tdcID:            titular.idTipoPersona === 0 ? '0' : '9',
    traDocumento:     titular.idTipoPersona === 0 ? cuitNum : dniNum,
    traSexo:          '',
    emdID:            3,    // Argentina
    nacID:            200,  // Argentina
    traCuit:          cuitNum,
    traNombre:        nombre || apellido,
    traApellido:      nombre ? apellido : '',
    traPorcentaje:    100,
    traFecNac:        '',
    escID:            '',
    traNupcias:       '',
    tdcID_C:          '1',
    traDocumento_C:   '',
    traNombre_C:      '',
    traApellido_C:    '',
    traPersoneria_C:  '',
    traNumero_C:      '',
    traFecCre_C:      '',
    traEmail:         '',
    traOcupacion:     '',
    traTelefono:      '',
    traLugarNacimiento: '',
    traCalle:         '',
    traNumero:        '',
    traPiso:          '',
    traDpto:          '',
    traCP:            '',
    traLocalidad:     '',
    traBarrio:        '',
    zonID:            '01',
    traMunicipalidad: '',
    traCalle_R:       '',
    traNumero_R:      '',
    traPiso_R:        '',
    traDpto_R:        '',
    traCP_R:          '',
    traLocalidad_R:   '',
    traBarrio_R:      '',
    zonID_R:          '01',
    traMunicipalidad_R: '',
  };

  return {
    datosDelTramite: {
      ttrID:                  4,     // compraventa
      frmID_12:               formulario12,
      traAnio:                auto.ano ?? '',
      traTipoUso:             1,     // particular (constante)
      traCedulas:             0,     // sin cédulas azul adicionales
      traGestoria:            'S',
      traGuardaHabitual:      'N',
      traModoAdquisicion:     'P',   // compra
      traElementoProbatorio:  '',
      traEP_Opcional:         '',
      ticID,
      codigoPuntoVenta,
      elpFacNum,
      elpMoneda:              'P',   // pesos
      elpImporte:             auto.facturaMonto ?? '',
      traSociedadH:           'N',
      traCertificaFirma:      'S',
      traPrendaCond:          'N',
      regID_Traslado:         '',
      traLeyendaInscripcion:  'S',
      traFechaCompra:         normalizarFecha(auto.facturaFecha ?? ''),
      traMonto:               auto.facturaMonto ?? '',
      traObservaciones:       `${process.env.TRGS_ID_EMPRESA ?? '5452'} - NetDriver`,
      segundoElementoProb:    '',
      ticIDSegundo:           '',
      codigoPuntoVentaSegundo: '',
      elpFacNumSegundo:       '',
      elpMonedaSegundo:       '',
      elpImporteSegundo:      '',
      traFecComSegundo:       '',
    },

    datosTitulares: {
      trgArrayTitularesTramites: titularPayload,
    },

    datosVehiculo: {
      cerID:      auto.certificadoFabrica ?? '',
      cerNumeroCC: auto.codFabrica ?? '',
      cerTipo:    'F',
    },

    // Sin cédulas azul en este sistema simplificado
    datosCedulasAzul: {},

    // Sin apoderados por defecto (VE_apoderados se verifica en la ruta de envío)
    datosApoderados: {},
    datosTitularesDJApoderados: {},

    datosGuardaHabitual: {
      ghCalle:        '',
      ghNumero:       '',
      ghCP:           '1',
      ghLocalidad:    '',
      zonID:          '',
      ghMunicipalidad: '',
      ghBarrio:       '',
    },

    datosPrestamo: {
      tdcID:        '',
      ptrDocumento: '',
      ptrNombre:    '',
      ptrMonto:     '',
    },

    datosAutopartes: { formaPago: '' },
  };
}
