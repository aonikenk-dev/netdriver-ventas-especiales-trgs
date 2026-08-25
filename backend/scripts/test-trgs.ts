/**
 * Script de diagnóstico para el WS TRGS.
 * Ejecutar desde la carpeta backend/:
 *
 *   npx tsx scripts/test-trgs.ts
 *
 * Carga el .env automáticamente y ejecuta tres pruebas en orden:
 *   1. Descarga del WSDL (TLS + HTTP Basic Auth)
 *   2. eco()            (disponibilidad del servidor TRGS)
 *   3. abrir_sesion()   (validez de las credenciales SOAP)
 */

import 'dotenv/config';

// El cert de www.trgs.com.ar está emitido para *.suats.com.ar (mismatch de hostname).
// Se deshabilita la verificación TLS a nivel de proceso — único mecanismo confiable
// cuando node-soap no propaga el agente personalizado al fetch del WSDL.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const _require = createRequire(import.meta.url);

// ── helpers ──────────────────────────────────────────────────────────────────

const OK   = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[33m→\x1b[0m';

function log(icon: string, label: string, detail?: unknown) {
  const d = detail !== undefined ? `  ${JSON.stringify(detail, null, 2)}` : '';
  console.log(`${icon} ${label}${d}`);
}

// ── configuración desde .env ──────────────────────────────────────────────────

const WSDL_URL   = process.env.TRGS_URL ?? 'https://www.trgs.com.ar:443/service/index.php?wsdl';
const HTTP_USER  = process.env.TRGS_HTTP_USER  ?? '';
const HTTP_PASS  = process.env.TRGS_HTTP_PASS  ?? '';
const USW_ID     = process.env.TRGS_USW_ID     ?? '000005';
const USW_PASS   = process.env.TRGS_USW_PASSWORD ?? '';
const USW_HASH   = process.env.TRGS_USW_HASH   ?? '';

console.log('\n── Configuración leída del .env ─────────────────────────────');
console.log(`${INFO} WSDL URL:      ${WSDL_URL}`);
console.log(`${INFO} HTTP_USER:     ${HTTP_USER || '(vacío)'}`);
console.log(`${INFO} HTTP_PASS:     ${HTTP_PASS ? '***' : '(vacío)'}`);
console.log(`${INFO} USW_ID:        ${USW_ID}`);
console.log(`${INFO} USW_PASSWORD:  ${USW_PASS ? '***' : '(vacío)'}`);
console.log(`${INFO} USW_HASH:      ${USW_HASH ? '***' : '(vacío)'}`);
console.log('');

// ── agente HTTPS sin verificación de hostname ─────────────────────────────────
// El cert de www.trgs.com.ar está emitido para *.suats.com.ar (mismatch conocido).

const agent = new https.Agent({ rejectUnauthorized: false });

type SoapClient = {
  abrir_sesionAsync(a: {
    uswID: string; uswPassword: string; uswHash: string;
  }): Promise<[{ return: { rspID: number; ingID: string; rspDescrip: string } }]>;
  cerrar_sesionAsync(a: { uswID: string; ingID: string }): Promise<unknown>;
  setSecurity(s: unknown): void;
  httpClient?: {
    request: (url: string, data: string, cb: unknown, headers: unknown, opts: Record<string, unknown>) => unknown;
  };
};

// ── prueba 1: descarga del WSDL ───────────────────────────────────────────────

async function testWsdl(): Promise<SoapClient | null> {
  console.log('── Prueba 1: Descarga del WSDL ──────────────────────────────');
  try {
    const soap = _require('soap') as {
      createClientAsync(url: string, opts: Record<string, unknown>): Promise<SoapClient>;
      BasicAuthSecurity: new (u: string, p: string) => unknown;
    };

    const client = await soap.createClientAsync(WSDL_URL, {
      wsdl_options: {
        auth:                `${HTTP_USER}:${HTTP_PASS}`,
        rejectUnauthorized:  false,
        agent,
      },
    });
    client.setSecurity(new soap.BasicAuthSecurity(HTTP_USER, HTTP_PASS));

    // Inyectar agente en llamadas SOAP
    if (client.httpClient?.request) {
      const orig = client.httpClient.request.bind(client.httpClient);
      client.httpClient.request = (url, data, cb, headers, opts) =>
        orig(url, data, cb, headers, { agent, ...opts });
    }

    log(OK, 'WSDL descargado correctamente');
    return client;
  } catch (err) {
    log(FAIL, 'No se pudo descargar el WSDL', (err as Error).message);
    console.log('');
    console.log('  Posibles causas:');
    console.log('  · El servidor no es alcanzable (red / firewall)');
    console.log('  · HTTP Basic Auth incorrecto (TRGS_HTTP_USER / TRGS_HTTP_PASS)');
    console.log('  · Error TLS distinto al del hostname mismatch');
    return null;
  }
}

// ── eco() via raw HTTPS ───────────────────────────────────────────────────────
// eco() tiene input:null en el WSDL — node-soap no puede serializar el request.
// Se llama directamente con https para evitar la capa de serialización.

function ecoRaw(wsdlUrl: string): Promise<{ trgDisponible: number; trgVersionProtocol: string; trgVersionWS: string; trgMessage: string }> {
  const base = wsdlUrl.replace('?wsdl', '');
  const auth = Buffer.from(`${HTTP_USER}:${HTTP_PASS}`).toString('base64');
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
          console.log('  Raw response HTTP status:', res.statusCode);
          if (!body.includes('trgDisponible')) {
            console.log('  Raw response body (primeros 500 chars):', body.slice(0, 500));
          }
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

// ── prueba 2: eco() ───────────────────────────────────────────────────────────

async function testEco(_client: SoapClient): Promise<boolean> {
  console.log('\n── Prueba 2: eco() (raw HTTPS) ──────────────────────────────');
  try {
    const r = await ecoRaw(WSDL_URL);
    if (r.trgDisponible === 1) {
      log(OK, `Servidor TRGS disponible — versión WS: ${r.trgVersionWS}  mensaje: "${r.trgMessage}"`);
      return true;
    } else {
      log(FAIL, `eco() respondió trgDisponible=${r.trgDisponible}  mensaje="${r.trgMessage}"`);
      return false;
    }
  } catch (err) {
    log(FAIL, 'eco() lanzó excepción', (err as Error).message);
    return false;
  }
}

// ── prueba 3: abrir_sesion() ──────────────────────────────────────────────────

async function testAbrirSesion(client: SoapClient): Promise<void> {
  console.log('\n── Prueba 3: abrir_sesion() ─────────────────────────────────');

  if (!USW_PASS || !USW_HASH) {
    log(FAIL, 'TRGS_USW_PASSWORD o TRGS_USW_HASH están vacíos en el .env — abortando prueba');
    return;
  }

  let ingID = '';
  try {
    const result = await client.abrir_sesionAsync({
      uswID:       USW_ID,
      uswPassword: USW_PASS,
      uswHash:     USW_HASH,
    });
    // Volcar estructura completa para entender el formato de respuesta de node-soap
    console.log('  Respuesta raw:', JSON.stringify(result, null, 2));

    const [rta] = result;
    const r = rta.return;

    // node-soap a veces envuelve primitivos en objetos con clave '$value' o '_'
    const extractVal = (v: unknown): string | number => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        return (obj['$value'] ?? obj['_'] ?? JSON.stringify(v)) as string | number;
      }
      return v as string | number;
    };

    const rspID   = Number(extractVal(r.rspID));
    const ingIDVal = String(extractVal(r.ingID));

    if (rspID === 1) {
      ingID = ingIDVal;
      log(OK, `Sesión abierta — ingID="${ingID}"`);
    } else {
      log(FAIL, `abrir_sesion() rechazada — rspID=${rspID}  rspDescrip="${extractVal(r.rspDescrip)}"`);
      console.log('');
      console.log('  Posibles causas:');
      console.log('  · TRGS_USW_PASSWORD incorrecto');
      console.log('  · TRGS_USW_HASH incorrecto o expirado');
      console.log('  · TRGS_USW_ID no registrado en el servidor');
    }
  } catch (err) {
    log(FAIL, 'abrir_sesion() lanzó excepción', (err as Error).message);
    return;
  }

  // cerrar_sesion siempre, incluso si hubo error
  if (ingID) {
    try {
      await client.cerrar_sesionAsync({ uswID: USW_ID, ingID });
      log(OK, 'cerrar_sesion() completado');
    } catch {
      log(FAIL, 'cerrar_sesion() falló (no crítico)');
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

(async () => {
  const client = await testWsdl();
  if (!client) {
    console.log('\nDetenido en prueba 1. Corrija el problema antes de continuar.\n');
    process.exit(1);
  }

  const ecoOk = await testEco(client);
  if (!ecoOk) {
    console.log('\nDetenido en prueba 2. El servidor no responde correctamente.\n');
    process.exit(1);
  }

  await testAbrirSesion(client);

  console.log('\n─────────────────────────────────────────────────────────────\n');
  process.exit(0);
})();
