/**
 * Script de diagnóstico para el WS TRGS (SOAP).
 * Ejecutar desde la carpeta backend/:
 *
 *   npx tsx scripts/test-trgs.ts
 *
 * Carga el .env automáticamente y ejecuta tres pruebas en orden:
 *   1. Descarga del WSDL (TLS + autenticación)
 *   2. eco()             (disponibilidad del servidor)
 *   3. abrir_sesion()   (validez de las credenciales SOAP)
 */

import 'dotenv/config';

// El cert está emitido para *.suats.com.ar — servicehabitualistas.suats.com.ar coincide.
// Se mantiene el bypass por si el entorno de testing usa cert diferente.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import https from 'node:https';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

// ── helpers ──────────────────────────────────────────────────────────────────

const OK   = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[33m→\x1b[0m';

function log(icon: string, label: string, detail?: unknown) {
  const d = detail !== undefined ? `  ${JSON.stringify(detail, null, 2)}` : '';
  console.log(`${icon} ${label}${d}`);
}

// ── configuración ─────────────────────────────────────────────────────────────

const WSDL_URL  = process.env.TRGS_URL ?? 'https://servicehabitualistas.suats.com.ar/service/index.php?wsdl';
const HTTP_USER = process.env.TRGS_HTTP_USER  ?? '';
const HTTP_PASS = process.env.TRGS_HTTP_PASS  ?? '';
const USW_ID    = process.env.TRGS_USW_ID     ?? '000005';
const USW_PASS  = process.env.TRGS_USW_PASSWORD ?? '';
const USW_HASH  = process.env.TRGS_USW_HASH   ?? '';

console.log('\n── Configuración leída del .env ─────────────────────────────');
console.log(`${INFO} WSDL URL:      ${WSDL_URL}`);
console.log(`${INFO} HTTP_USER:     ${HTTP_USER || '(vacío)'}`);
console.log(`${INFO} HTTP_PASS:     ${HTTP_PASS ? '***' : '(vacío)'}`);
console.log(`${INFO} USW_ID:        ${USW_ID}`);
console.log(`${INFO} USW_PASSWORD:  ${USW_PASS ? '***' : '(vacío)'}`);
console.log(`${INFO} USW_HASH:      ${USW_HASH ? '***' : '(vacío)'}`);
console.log('');

const agent = new https.Agent({ rejectUnauthorized: false });

type SoapClient = {
  abrir_sesionAsync(a: {
    uswID: string; uswPassword: string; uswHash: string;
  }): Promise<[{ return: Record<string, unknown> }]>;
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
      wsdl_options: { rejectUnauthorized: false, agent },
    });

    if (HTTP_USER && HTTP_PASS) {
      client.setSecurity(new soap.BasicAuthSecurity(HTTP_USER, HTTP_PASS));
    }

    if (client.httpClient?.request) {
      const orig = client.httpClient.request.bind(client.httpClient);
      client.httpClient.request = (url, data, cb, headers, opts) =>
        orig(url, data, cb, headers, { agent, ...opts });
    }

    log(OK, 'WSDL descargado correctamente');
    return client;
  } catch (err) {
    log(FAIL, 'No se pudo descargar el WSDL', (err as Error).message);
    return null;
  }
}

// ── prueba 2: eco() via raw HTTPS ─────────────────────────────────────────────

function ecoRaw(): Promise<{ trgDisponible: number; trgVersionWS: string; trgMessage: string }> {
  const base = WSDL_URL.replace('?wsdl', '');
  const envelope =
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:trgs">' +
    '<SOAP-ENV:Body><tns:eco/></SOAP-ENV:Body>' +
    '</SOAP-ENV:Envelope>';
  const headers: Record<string, string | number> = {
    'Content-Type':   'text/xml; charset=utf-8',
    'SOAPAction':     '""',
    'Content-Length': Buffer.byteLength(envelope),
  };
  if (HTTP_USER && HTTP_PASS) {
    headers['Authorization'] = `Basic ${Buffer.from(`${HTTP_USER}:${HTTP_PASS}`).toString('base64')}`;
  }
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: url.hostname, port: Number(url.port) || 443, path: url.pathname, method: 'POST', headers, agent },
      (res) => {
        let body = '';
        res.on('data', (c: Buffer) => { body += c; });
        res.on('end', () => {
          const tag = (name: string) =>
            body.match(new RegExp(`<(?:[^:>]+:)?${name}[^>]*>(.*?)<\\/(?:[^:>]+:)?${name}>`, 's'))?.[1]?.trim() ?? '';
          resolve({ trgDisponible: parseInt(tag('trgDisponible')) || 0, trgVersionWS: tag('trgVersionWS'), trgMessage: tag('trgMessage') });
        });
      }
    );
    req.on('error', reject);
    req.write(envelope);
    req.end();
  });
}

async function testEco(): Promise<boolean> {
  console.log('\n── Prueba 2: eco() (raw HTTPS) ──────────────────────────────');
  try {
    const r = await ecoRaw();
    if (r.trgDisponible === 1) {
      log(OK, `Servidor disponible — v${r.trgVersionWS}  mensaje: "${r.trgMessage}"`);
      return true;
    }
    log(FAIL, `trgDisponible=${r.trgDisponible}  mensaje="${r.trgMessage}"`);
    return false;
  } catch (err) {
    log(FAIL, 'eco() lanzó excepción', (err as Error).message);
    return false;
  }
}

// ── prueba 3: abrir_sesion() ──────────────────────────────────────────────────

function unpack(v: unknown): unknown {
  if (v !== null && typeof v === 'object' && '$value' in (v as Record<string, unknown>))
    return (v as Record<string, unknown>)['$value'];
  return v;
}

async function testAbrirSesion(client: SoapClient): Promise<void> {
  console.log('\n── Prueba 3: abrir_sesion() ─────────────────────────────────');
  if (!USW_PASS && !USW_HASH) {
    log(FAIL, 'TRGS_USW_PASSWORD y TRGS_USW_HASH están vacíos — abortando');
    return;
  }

  let ingID = '';
  try {
    const [rta] = await client.abrir_sesionAsync({ uswID: USW_ID, uswPassword: USW_PASS, uswHash: USW_HASH });
    const r = rta.return;
    const rspID = Number(unpack(r.rspID));
    ingID = String(unpack(r.ingID) ?? '');

    if (rspID === 1) {
      log(OK, `Sesión abierta — ingID="${ingID}"`);
    } else {
      log(FAIL, `rspID=${rspID}  rspDescrip="${unpack(r.rspDescrip)}"`);
    }
  } catch (err) {
    log(FAIL, 'abrir_sesion() lanzó excepción', (err as Error).message);
    return;
  }

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
  if (!client) { process.exit(1); }

  const ecoOk = await testEco();
  if (!ecoOk) { process.exit(1); }

  await testAbrirSesion(client);

  console.log('\n─────────────────────────────────────────────────────────────\n');
  process.exit(0);
})();
