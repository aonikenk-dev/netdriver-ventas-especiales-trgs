// Cliente SOAP del WS TRGS.
// Usa node-soap (CJS) importado con createRequire para compatibilidad ESM.
// Cuando USE_MOCKS !== 'false', todas las operaciones devuelven datos simulados.
// cerrar_sesion() siempre se llama, incluso si generar_tramite_01 falló.

import { createRequire } from 'module';
import type {
  GestorFormulario,
  TrgEcoRespuesta,
  TrgSesionRespuesta,
  TrgTramiteRespuesta,
} from '../../../shared/types/index.js';
import type { TrgPayload } from './buildPayload.js';

// ─── CJS interop ─────────────────────────────────────────────────────────────

const _require = createRequire(import.meta.url);

interface SoapRta<T> { return: T }

type SoapClient = {
  ecoAsync(a: Record<string, never>): Promise<[SoapRta<{ respuestaID: number; rspID: number; rspDescrip: string }>]>;
  abrir_sesionAsync(a: {
    uswID: string; uswPassword: string; uswHash: string;
  }): Promise<[SoapRta<{ rspID: number; ingID: string; rspDescrip: string }>]>;
  generar_tramite_01Async(a: {
    uswID: string; ingID: string; datos: unknown;
  }): Promise<[SoapRta<{ rspID: number; traID: string; rspDescrip: string }>]>;
  obtener_formulariosAsync(a: {
    uswID: string; ingID: string; tipoForm: string; nroForm: string; traID: string;
  }): Promise<[SoapRta<{ formulario: { formulario: string; comprobante?: string } }>]>;
  cerrar_sesionAsync(a: { uswID: string; ingID: string }): Promise<unknown>;
  setSecurity(s: unknown): void;
};

let _cachedClient: SoapClient | null = null;
let _cachedUrl = '';

async function getSoapClient(): Promise<SoapClient> {
  const wsdlUrl = process.env.TRGS_URL ?? 'https://www.trgs.com.ar:443/service/index.php?wsdl';
  if (_cachedClient && _cachedUrl === wsdlUrl) return _cachedClient;

  const soap = _require('soap') as {
    createClientAsync(url: string, opts?: Record<string, unknown>): Promise<SoapClient>;
    BasicAuthSecurity: new (user: string, pass: string) => unknown;
  };

  const httpUser = process.env.TRGS_HTTP_USER ?? '';
  const httpPass = process.env.TRGS_HTTP_PASS ?? '';

  const client = await soap.createClientAsync(wsdlUrl, {
    // HTTP Basic Auth para descargar el WSDL desde el endpoint protegido
    wsdl_options: { auth: `${httpUser}:${httpPass}` },
  });
  // HTTP Basic Auth en cada llamada SOAP
  client.setSecurity(new soap.BasicAuthSecurity(httpUser, httpPass));

  _cachedClient = client;
  _cachedUrl = wsdlUrl;
  return client;
}

// ─── Constantes internas ──────────────────────────────────────────────────────

const USE_MOCKS = process.env.USE_MOCKS !== 'false';

function uswID(): string { return process.env.TRGS_USW_ID ?? '000005'; }

const LATENCIA_MS = 350;
const PROBABILIDAD_ERROR = 0.15;
const ERRORES_SIMULADOS = [
  'rspID -14: CUIT del titular no coincide con AFIP',
  'rspID -22: Codigo de fabrica inexistente en tabla TRGS',
  'rspID -7: Sesion vencida, reintentar abrir_sesion',
];

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function eco(): Promise<TrgEcoRespuesta> {
  if (USE_MOCKS) {
    await esperar(LATENCIA_MS);
    return { respuestaID: 1, rspID: 1, rspDescrip: 'Servidor TRGS disponible (mock)' };
  }
  try {
    const client = await getSoapClient();
    const [rta] = await client.ecoAsync({});
    return rta.return;
  } catch (err) {
    console.error('[trgsService.eco]', err);
    return { respuestaID: -1, rspID: -1, rspDescrip: `Error de conexión: ${String(err)}` };
  }
}

// Lee uswPassword y uswHash del entorno — no recibe parámetros externos.
export async function abrirSesion(): Promise<TrgSesionRespuesta> {
  const id = uswID();
  const uswPassword = process.env.TRGS_USW_PASSWORD ?? '';
  const uswHash     = process.env.TRGS_USW_HASH     ?? '';

  if (USE_MOCKS) {
    await esperar(LATENCIA_MS);
    return { ingID: `ING-${id}-${Date.now()}`, rspID: 1, rspDescrip: 'Sesion abierta (mock)' };
  }
  try {
    const client = await getSoapClient();
    const [rta] = await client.abrir_sesionAsync({ uswID: id, uswPassword, uswHash });
    return rta.return;
  } catch (err) {
    console.error('[trgsService.abrirSesion]', err);
    return { ingID: '', rspID: -1, rspDescrip: `Error de conexión: ${String(err)}` };
  }
}

export async function generarTramite01(
  ingID: string,
  payload: TrgPayload,
): Promise<TrgTramiteRespuesta> {
  const id = uswID();

  if (USE_MOCKS) {
    await esperar(LATENCIA_MS * 2);
    void ingID; void payload;
    const falla = Math.random() < PROBABILIDAD_ERROR;
    if (falla) {
      const motivo = ERRORES_SIMULADOS[Math.floor(Math.random() * ERRORES_SIMULADOS.length)];
      return { traID: '', rspID: -1, rspDescrip: motivo };
    }
    return {
      traID: `TRA-${Math.floor(100000 + Math.random() * 899999)}`,
      rspID: 1,
      rspDescrip: 'Tramite generado correctamente (mock)',
    };
  }
  try {
    const client = await getSoapClient();
    const [rta] = await client.generar_tramite_01Async({ uswID: id, ingID, datos: payload });
    return rta.return;
  } catch (err) {
    console.error('[trgsService.generarTramite01]', err);
    return { traID: '', rspID: -1, rspDescrip: `Error de conexión: ${String(err)}` };
  }
}

// Una llamada por tipo de formulario. tipoForm es '01' o '12'.
// nroForm es el número impreso en el formulario físico ingresado por el operador.
export async function obtenerFormularios(
  ingID: string,
  traID: string,
  tipo: GestorFormulario['tipo'],
  nroForm: string,
): Promise<GestorFormulario> {
  const id = uswID();
  const tipoForm = tipo === 'F12' ? '12' : '01';

  if (USE_MOCKS) {
    await esperar(LATENCIA_MS);
    return {
      id: 0,
      idTramite: 0,
      tipo,
      numero: nroForm || `${tipo}-${traID}`,
      pdfBase64: Buffer.from(`PDF MOCK ${tipo} ${traID}`).toString('base64'),
    };
  }
  const client = await getSoapClient();
  const [rta] = await client.obtener_formulariosAsync({ uswID: id, ingID, tipoForm, nroForm, traID });
  return {
    id: 0,
    idTramite: 0,
    tipo,
    numero: nroForm,
    pdfBase64: rta.return.formulario.formulario,
  };
}

// Siempre se llama, incluso si generar_tramite_01 falló.
// Los errores se logean pero no se propagan para no ocultar el error original.
export async function cerrarSesion(ingID: string): Promise<void> {
  const id = uswID();
  if (USE_MOCKS) {
    await esperar(LATENCIA_MS / 2);
    return;
  }
  try {
    const client = await getSoapClient();
    await client.cerrar_sesionAsync({ uswID: id, ingID });
  } catch (err) {
    console.error('[trgsService.cerrarSesion]', err);
  }
}
