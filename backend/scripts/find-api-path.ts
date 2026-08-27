/**
 * Detecta el path y formato correcto de la API de TRGS.
 * Ejecutar: npx tsx scripts/find-api-path.ts
 */

import 'dotenv/config';
import https from 'node:https';

const HOST = 'servicehabitualistas.suats.com.ar';
const agent = new https.Agent({ rejectUnauthorized: false });

function req(opts: {
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ status: number; contentType: string; body: string }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    };
    if (opts.body) headers['Content-Length'] = String(Buffer.byteLength(opts.body));

    const r = https.request(
      { hostname: HOST, port: 443, path: opts.path, method: opts.method ?? 'GET', headers, agent },
      (res) => {
        let body = '';
        res.on('data', (c: Buffer) => { body += c; });
        res.on('end', () => resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          body: body.slice(0, 500),
        }));
      }
    );
    r.on('error', (e) => resolve({ status: -1, contentType: '', body: String(e) }));
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

(async () => {
  console.log(`\nProbando variantes en ${HOST}...\n`);

  // 1. GET /service/index.php/eco con Accept: application/json
  {
    const r = await req({ path: '/service/index.php/eco' });
    console.log(`[1] GET /service/index.php/eco`);
    console.log(`    status: ${r.status}  content-type: ${r.contentType}`);
    console.log(`    body: ${r.body.slice(0, 200)}\n`);
  }

  // 2. GET /service/index.php?action=eco
  {
    const r = await req({ path: '/service/index.php?action=eco' });
    console.log(`[2] GET /service/index.php?action=eco`);
    console.log(`    status: ${r.status}  content-type: ${r.contentType}`);
    console.log(`    body: ${r.body.slice(0, 200)}\n`);
  }

  // 3. POST /service/index.php/abrir-sesion con JSON
  const uswID = parseInt(process.env.TRGS_USW_ID ?? '5', 10);
  const body = JSON.stringify({ uswID, uswPassword: process.env.TRGS_USW_PASSWORD ?? '' });
  {
    const r = await req({ method: 'POST', path: '/service/index.php/abrir-sesion', body });
    console.log(`[3] POST /service/index.php/abrir-sesion`);
    console.log(`    status: ${r.status}  content-type: ${r.contentType}`);
    console.log(`    body: ${r.body.slice(0, 300)}\n`);
  }

  // 4. POST /service/index.php con JSON + header X-Action
  {
    const r = await req({ method: 'POST', path: '/service/index.php', body, headers: { 'X-Action': 'abrir-sesion' } });
    console.log(`[4] POST /service/index.php (header X-Action: abrir-sesion)`);
    console.log(`    status: ${r.status}  content-type: ${r.contentType}`);
    console.log(`    body: ${r.body.slice(0, 300)}\n`);
  }

  // 5. GET /service/index.php/eco sin Accept JSON (para ver qué devuelve de base)
  {
    const r = await req({ path: '/service/index.php/eco', headers: { Accept: '*/*', 'Content-Type': 'text/plain' } });
    console.log(`[5] GET /service/index.php/eco (Accept: */*)`);
    console.log(`    status: ${r.status}  content-type: ${r.contentType}`);
    console.log(`    body: ${r.body.slice(0, 300)}\n`);
  }
})();
