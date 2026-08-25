// Cliente SOAP del WS TRGS.
// Usa node-soap (CJS) importado con createRequire para compatibilidad ESM.
// Cuando USE_MOCKS !== 'false', todas las operaciones devuelven datos simulados.
// cerrar_sesion() siempre se llama, incluso si generar_tramite_01 falló.

// El cert de www.trgs.com.ar está emitido para *.suats.com.ar (mismatch de hostname).
// node-soap no propaga agentes personalizados al fetch del WSDL, así que se usa
// la variable de proceso — única forma confiable de bypass en Node.js.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import https from 'node:https';
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
  // eco() tiene input:null en el WSDL — se invoca por raw HTTP en ecoRaw()
  abrir_sesionAsync(a: {
    uswID: string; uswPassword: string; uswHash: string;
  }): Promise<[SoapRta<{ rspID: number; ingID: string; rspDescrip: string; sesID: string; ingFecVen: string }>]>;
  generar_tramite_01Async(a: {
    uswID: string; ingID: string; datos: unknown;
  }): Promise<[SoapRta<{ rspID: number; traID: string; rspDescrip: string }>]>;
  // F12=true → formulario 12; F12=false → formulario 01
  // nroTramite = traID numérico devuelto por generar_tramite_01
  obtener_formulariosAsync(a: {
    uswID: string; ingID: string; F12: boolean; nroForm: number; nroTramite: number;
  }): Promise<[SoapRta<{ codMensaje: string; Descripcion: string; formulario: unknown }>]>;
  cerrar_sesionAsync(a: { uswID: string; ingID: string }): Promise<unknown>;
  setSecurity(s: unknown): void;
  httpClient?: {
    request: (url: string, data: string, cb: unknown, headers: unknown, opts: Record<string, unknown>) => unknown;
  };
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
  const agent = new https.Agent({ rejectUnauthorized: false });

  const client = await soap.createClientAsync(wsdlUrl, {
    wsdl_options: { auth: `${httpUser}:${httpPass}`, rejectUnauthorized: false, agent },
  });
  client.setSecurity(new soap.BasicAuthSecurity(httpUser, httpPass));

  if (client.httpClient?.request) {
    const orig = client.httpClient.request.bind(client.httpClient);
    client.httpClient.request = (url, data, cb, headers, opts) =>
      orig(url, data, cb, headers, { agent, ...opts });
  }

  _cachedClient = client;
  _cachedUrl = wsdlUrl;
  return client;
}

// ─── Helpers de parsing ───────────────────────────────────────────────────────
// node-soap envuelve cada campo en { attributes: {...}, $value: valor } para
// bindings RPC+encoded. Esta función extrae el valor real de cualquier campo.

function unpack<T>(v: unknown): T {
  if (v !== null && typeof v === 'object' && '$value' in (v as Record<string, unknown>)) {
    return (v as Record<string, unknown>)['$value'] as T;
  }
  return v as T;
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

// ─── eco() — raw HTTP ────────────────────────────────────────────────────────
// eco() tiene input:null en el WSDL. node-soap lanza "invalid message definition
// for rpc style binding" al intentar serializar un input nulo. Se hace la llamada
// directamente con https para evitar la capa de serialización de node-soap.

function ecoRaw(): Promise<TrgEcoRespuesta> {
  const base = (process.env.TRGS_URL ?? 'https://www.trgs.com.ar:443/service/index.php?wsdl').replace('?wsdl', '');
  const httpUser = process.env.TRGS_HTTP_USER ?? '';
  const httpPass = process.env.TRGS_HTTP_PASS ?? '';
  const auth = Buffer.from(`${httpUser}:${httpPass}`).toString('base64');

  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:trgs">' +
    '<SOAP-ENV:Body><tns:eco/></SOAP-ENV:Body>' +
    '</SOAP-ENV:Envelope>';

  const url = new URL(base);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port:     Number(url.port) || 443,
        path:     url.pathname + url.search,
        method:   'POST',
        headers: {
          'Content-Type':   'text/xml; charset=utf-8',
          'SOAPAction':     '""',
          'Authorization':  `Basic ${auth}`,
          'Content-Length': Buffer.byteLength(envelope),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk: Buffer) => { body += chunk; });
        res.on('end', () => {
          const tag = (name: string) =>
            body.match(new RegExp(`<(?:[^:>]+:)?${name}[^>]*>(.*?)<\\/(?:[^:>]+:)?${name}>`, 's'))?.[1]?.trim() ?? '';
          resolve({
            trgDisponible:      parseInt(tag('trgDisponible')) || 0,
            trgVersionProtocol: tag('trgVersionProtocol'),
            trgVersionWS:       tag('trgVersionWS'),
            trgMessage:         tag('trgMessage'),
          });
        });
      }
    );
    req.on('error', reject);
    req.write(envelope);
    req.end();
  });
}

// ─── Operaciones ──────────────────────────────────────────────────────────────

export async function eco(): Promise<TrgEcoRespuesta> {
  if (USE_MOCKS) {
    await esperar(LATENCIA_MS);
    return { trgDisponible: 1, trgVersionProtocol: 'mock', trgVersionWS: 'mock', trgMessage: 'Servidor TRGS disponible (mock)' };
  }
  try {
    return await ecoRaw();
  } catch (err) {
    console.error('[trgsService.eco]', err);
    return { trgDisponible: -1, trgVersionProtocol: '', trgVersionWS: '', trgMessage: `Error de conexión: ${String(err)}` };
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
    const r = rta.return;
    return {
      rspID:    unpack<number>(r.rspID),
      rspDescrip: unpack<string>(r.rspDescrip),
      ingID:    String(unpack<string | number>(r.ingID)),
    };
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
    const result = await client.generar_tramite_01Async({ uswID: id, ingID, datos: payload });
    const [rta, rawResponse, , rawRequest] = result as [
      { return: Record<string, unknown> } | null,
      string | null,
      unknown,
      string | null
    ];

    // Siempre loguear el request enviado para facilitar diagnóstico
    console.log('[trgsService.generarTramite01] Request XML enviado:\n', String(rawRequest ?? '').slice(0, 2000));

    // xsi:nil="true" → el servidor recibió la llamada pero devolvió null (payload rechazado o tipo no serializado)
    if (rta === null || (rta as unknown) === null) {
      const faultStr = String(rawResponse ?? '');
      const faultMsg = faultStr.match(/<faultstring[^>]*>(.*?)<\/faultstring>/s)?.[1]?.trim()
        ?? faultStr.match(/<faultcode[^>]*>(.*?)<\/faultcode>/s)?.[1]?.trim()
        ?? (faultStr.includes('xsi:nil') ? 'Servidor devolvió nil (payload posiblemente mal serializado)' : 'Respuesta vacía del servidor');
      console.error('[trgsService.generarTramite01] Respuesta nil/fault. Response XML:\n', faultStr.slice(0, 1000));
      return { traID: '', rspID: -1, rspDescrip: `SOAP nil: ${faultMsg}` };
    }

    const r = rta.return;
    return {
      rspID:      unpack<number>(r.rspID),
      rspDescrip: unpack<string>(r.rspDescrip),
      traID:      String(unpack<string | number>(r.traID) ?? ''),
    };
  } catch (err) {
    console.error('[trgsService.generarTramite01]', err);
    return { traID: '', rspID: -1, rspDescrip: `Error de conexión: ${String(err)}` };
  }
}

// F12=true → formulario 12; F12=false → formulario 01 (o 01importado).
// nroTramite es el traID numérico devuelto por generar_tramite_01.
// nroForm es el número del formulario físico ingresado por el operador.
export async function obtenerFormularios(
  ingID: string,
  traID: string,
  tipo: GestorFormulario['tipo'],
  nroForm: string,
): Promise<GestorFormulario> {
  const id = uswID();

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
  const [rta] = await client.obtener_formulariosAsync({
    uswID:      id,
    ingID,
    F12:        tipo === 'F12',
    nroForm:    parseInt(nroForm) || 0,
    nroTramite: parseInt(traID)   || 0,
  });
  const r = rta.return;
  // trgFormularios: la estructura exacta depende del servidor; se intentan las claves conocidas
  const formularioObj = unpack<unknown>(r.formulario);
  let pdfBase64 = '';
  if (typeof formularioObj === 'string') {
    pdfBase64 = formularioObj;
  } else if (formularioObj && typeof formularioObj === 'object') {
    const f = formularioObj as Record<string, unknown>;
    pdfBase64 = String(unpack(f.formulario) ?? unpack(f.comprobante) ?? '');
  }

  return { id: 0, idTramite: 0, tipo, numero: nroForm, pdfBase64 };
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
