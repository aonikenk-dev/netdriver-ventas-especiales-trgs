// Construye el payload para generar_tramite_01 del WS SOAP de TRGS.

import type { GestorTramite } from '../../../shared/types/index.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TrgTitular {
  frmID:              string;
  traTT:              string;
  tdcID:              number;
  traDocumento:       number;
  traSexo:            string;
  emdID:              number;
  nacID:              number;
  traCuit:            number;
  traNombre:          string;
  traApellido:        string;
  traPorcentaje:      number;
  traFecNac:          string;
  escID:              string;
  traNupcias:         string;
  tdcID_C:            string;
  traDocumento_C:     string;
  traNombre_C:        string;
  traApellido_C:      string;
  traPersoneria_C:    string;
  traNumero_C:        string;
  traFecCre_C:        string;
  traEmail:           string;
  traOcupacion:       string;
  traTelefono:        string;
  traLugarNacimiento: string;
  traCalle:           string;
  traNumero:          string;
  traPiso:            string;
  traDpto:            string;
  traCP:              string;
  traLocalidad:       string;
  traBarrio:          string;
  zonID:              string;
  traMunicipalidad:   string;
  traCalle_R:         string;
  traNumero_R:        string;
  traPiso_R:          string;
  traDpto_R:          string;
  traCP_R:            string;
  traLocalidad_R:     string;
  traBarrio_R:        string;
  zonID_R:            string;
  traMunicipalidad_R: string;
}

export interface TrgPayload {
  datosDelTramite:           Record<string, unknown>;
  // SOAP: objeto con wrapper trgArrayTitularesTramites (no array JS)
  datosTitulares:            { trgArrayTitularesTramites: TrgTitular };
  datosVehiculo:             { cerID: string; cerNumeroCC: string; cerTipo: string };
  datosCedulasAzul:          Record<string, unknown>;
  datosApoderados:           Record<string, unknown>;
  datosTitularesDJApoderados: Record<string, unknown>;
  datosGuardaHabitual:       Record<string, unknown>;
  datosPrestamo:             Record<string, unknown>;
  datosAutopartes:           { formaPago: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cuitNumerico(cuit: string): number {
  return parseFloat(cuit.replace(/-/g, '')) || 0;
}

function dniDesdeCuit(cuit: string): number {
  const soloNums = cuit.replace(/-/g, '');
  if (soloNums.length >= 10) return parseInt(soloNums.slice(2, 10), 10) || 0;
  return cuitNumerico(cuit);
}

// Determina si el titular es persona jurídica chequeando el CUIT (30/33/34)
// además del idTipoPersona, porque la DB puede traer el valor incorrecto.
function esPersonaJuridica(cuit: string, idTipoPersona: number): boolean {
  if (idTipoPersona === 0) return true;
  const digits = cuit.replace(/-/g, '');
  return digits.startsWith('30') || digits.startsWith('33') || digits.startsWith('34');
}

// Para persona física: divide "APELLIDO NOMBRE" o "APELLIDO, NOMBRE".
// Para persona jurídica: razón social completa va en traApellido.
function resolverNombreApellido(
  nombreCompleto: string,
  esPJ: boolean,
): { nombre: string; apellido: string } {
  const limpio = nombreCompleto.trim().toUpperCase();
  if (esPJ) return { apellido: limpio, nombre: '' };
  if (limpio.includes(',')) {
    const [ap, nm] = limpio.split(',', 2);
    return { apellido: ap.trim(), nombre: nm.trim() };
  }
  const partes = limpio.split(/\s+/);
  if (partes.length === 1) return { apellido: limpio, nombre: '' };
  return { apellido: partes[0], nombre: partes.slice(1).join(' ') };
}

// Parsea facturaNro (ej. "A0065 - 00697780") en sus componentes para el WS.
function parsearFactura(facturaNro: string): {
  ticID: string; codigoPuntoVenta: string; elpFacNum: string;
} {
  const s = facturaNro.trim().toUpperCase().replace(/\s+/g, '');
  const match = s.match(/^([A-Z]?)(\d{1,4})[-]?(\d{4,8})$/);
  if (match) {
    const ticID = { A: '01', B: '06', C: '11', M: '51', X: '06' }[match[1]] ?? '06';
    return { ticID, codigoPuntoVenta: match[2].padStart(4, '0'), elpFacNum: match[3].padStart(8, '0') };
  }
  const match2 = s.match(/^([A-Z]?)(\d{4})(\d{8})$/);
  if (match2) {
    const ticID = { A: '01', B: '06', C: '11', M: '51', X: '06' }[match2[1]] ?? '06';
    return { ticID, codigoPuntoVenta: match2[2], elpFacNum: match2[3] };
  }
  return { ticID: '06', codigoPuntoVenta: '0001', elpFacNum: s.slice(-8).padStart(8, '0') };
}

function normalizarFecha(fecha: string): string {
  if (!fecha) return '';
  const dmY = fecha.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return fecha.slice(0, 10);
}

// ─── Constructor principal ────────────────────────────────────────────────────

export function buildTrgPayload(
  tramite: GestorTramite,
  formulario01: string,
  formulario12: string,
): TrgPayload {
  const { auto, titular } = tramite;
  const esPJ = esPersonaJuridica(titular.cuit, titular.idTipoPersona);
  const cuitNum = cuitNumerico(titular.cuit);
  const dniNum  = dniDesdeCuit(titular.cuit);
  const { apellido, nombre } = resolverNombreApellido(titular.nombre, esPJ);

  // traSexo: P = persona jurídica, F = mujer (CUIT 27x), M = varón (resto)
  const cuitDigits = titular.cuit.replace(/-/g, '');
  const sexo = esPJ ? 'P' : (cuitDigits.startsWith('27') ? 'F' : 'M');

  const { ticID, codigoPuntoVenta, elpFacNum } = parsearFactura(auto.facturaNro ?? '');

  const titularPayload: TrgTitular = {
    frmID:            formulario01,
    traTT:            'P',
    tdcID:            esPJ ? 0 : 9,
    traDocumento:     esPJ ? cuitNum : dniNum,
    traSexo:          sexo,
    emdID:            3,    // Argentina
    nacID:            200,  // Argentina
    traCuit:          cuitNum,
    traNombre:        nombre,
    traApellido:      apellido,
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
      traAnio:                parseInt(auto.ano ?? '0', 10) || '',
      traTipoUso:             1,     // particular
      traCedulas:             0,
      traGestoria:            'S',
      traGuardaHabitual:      'N',
      traModoAdquisicion:     'P',
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

    // SOAP requiere el wrapper trgArrayTitularesTramites, no un array JS directo
    datosTitulares: {
      trgArrayTitularesTramites: titularPayload,
    },

    datosVehiculo: {
      cerID:       auto.certificadoFabrica ?? '',
      cerNumeroCC: auto.nroChasis ?? '',
      // F = Fábrica/nacional (chasis empieza en '8'), I = Importado
      cerTipo: auto.codigoClase === 6801 ? 'F' : 'I',
    },

    datosCedulasAzul:           {},
    datosApoderados:            {},
    datosTitularesDJApoderados: {},

    datosGuardaHabitual: {
      ghCalle:         '',
      ghNumero:        '',
      ghCP:            '1',
      ghLocalidad:     '',
      zonID:           '',
      ghMunicipalidad: '',
      ghBarrio:        '',
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
