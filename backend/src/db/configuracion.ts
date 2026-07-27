import { getPool, sql } from './index.js';

const DEFAULTS: Record<string, string> = {
  PDF_DIR: process.env.PDF_DIR ?? '',
};

// Caché en memoria — se invalida al guardar
let cache: Record<string, string> | null = null;

export async function dbGetConfiguracion(): Promise<Record<string, string>> {
  if (cache) return cache;
  const pool = await getPool();
  const result = await pool.request().query('SELECT clave, valor FROM configuracion');
  const config: Record<string, string> = { ...DEFAULTS };
  for (const row of result.recordset as { clave: string; valor: string }[]) {
    config[row.clave] = row.valor ?? '';
  }
  cache = config;
  return config;
}

export async function dbGetValor(clave: string): Promise<string> {
  const config = await dbGetConfiguracion();
  return config[clave] ?? DEFAULTS[clave] ?? '';
}

export async function dbSetConfiguracion(cambios: Record<string, string>): Promise<Record<string, string>> {
  const pool = await getPool();
  for (const [clave, valor] of Object.entries(cambios)) {
    await pool.request()
      .input('clave', sql.VarChar,   clave)
      .input('valor', sql.NVarChar,  valor)
      .query(`
        MERGE configuracion AS target
        USING (VALUES (@clave, @valor)) AS source (clave, valor)
          ON target.clave = source.clave
        WHEN MATCHED     THEN UPDATE SET valor = source.valor
        WHEN NOT MATCHED THEN INSERT (clave, valor) VALUES (source.clave, source.valor);
      `);
  }
  cache = null; // invalidar caché
  return dbGetConfiguracion();
}
