import { getPool, sql } from './index.js';
import type { Remito, RemitoTramite } from '../../../shared/types/index.js';

// ---------------------------------------------------------------------------
// Listar todos los remitos con sus tramites
// ---------------------------------------------------------------------------
export async function dbListarRemitos(): Promise<Remito[]> {
  const pool = await getPool();

  const rResult = await pool.request().query(`
    SELECT r.id, r.numero, CONVERT(nvarchar(30), r.creadoEn, 126) AS creadoEn,
           r.pdfUrl, r.excelUrl
    FROM remitos r
    ORDER BY r.id DESC
  `);

  const rows = rResult.recordset as {
    id: number; numero: string; creadoEn: string; pdfUrl: string; excelUrl: string
  }[];

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tResult = await pool.request().query(`
    SELECT
      rt.idRemito,
      t.id, t.traID, t.formularioNro01, t.formularioNro12,
      a.nroChasis, a.marcaChasis, a.modelo, a.certificadoFabrica,
      p.nombre, p.cuit
    FROM remito_tramites rt
    INNER JOIN gestor_tramites t  ON rt.idTramite  = t.id
    INNER JOIN gestor_autos    a  ON t.idAuto      = a.id
    INNER JOIN gestor_personas p  ON t.idPersona   = p.id
    WHERE rt.idRemito IN (${ids.join(',')})
  `);

  const tramitesByRemito = new Map<number, RemitoTramite[]>();
  for (const r of tResult.recordset as Record<string, unknown>[]) {
    const rid = r.idRemito as number;
    const list = tramitesByRemito.get(rid) ?? [];
    list.push({
      id:                r.id as number,
      nroChasis:         r.nroChasis as string,
      marcaChasis:       r.marcaChasis as string,
      modelo:            r.modelo as string,
      titular:           r.nombre as string,
      cuit:              r.cuit as string,
      traID:             (r.traID as string | null) ?? null,
      certificadoFabrica: (r.certificadoFabrica as string | null) ?? null,
      formularioNro01:   (r.formularioNro01 as string | null) ?? null,
      formularioNro12:   (r.formularioNro12 as string | null) ?? null,
    });
    tramitesByRemito.set(rid, list);
  }

  return rows.map((r) => ({
    id:          r.id,
    numero:      r.numero,
    tramiteIds:  (tramitesByRemito.get(r.id) ?? []).map((t) => t.id),
    tramites:    tramitesByRemito.get(r.id) ?? [],
    creadoEn:    r.creadoEn,
    pdfUrl:      r.pdfUrl,
    excelUrl:    r.excelUrl,
  }));
}

// ---------------------------------------------------------------------------
// Crear remito con sus tramites
// ---------------------------------------------------------------------------
export async function dbCrearRemito(
  tramiteIds: number[],
  pdfUrl: string,
  excelUrl: string,
  tramitesSnapshot: RemitoTramite[]
): Promise<Remito> {
  const pool = await getPool();

  // Generar numero correlativo atomico
  const numResult = await pool.request().query(
    "SELECT ISNULL(MAX(id), 0) + 1 AS nextId FROM remitos"
  );
  const nextId = (numResult.recordset[0] as { nextId: number }).nextId;
  const numero = `RTO-${String(nextId).padStart(6, '0')}`;

  const insertResult = await pool.request()
    .input('numero',   sql.VarChar, numero)
    .input('pdfUrl',   sql.VarChar, pdfUrl)
    .input('excelUrl', sql.VarChar, excelUrl)
    .query(`
      INSERT INTO remitos (numero, creadoEn, pdfUrl, excelUrl)
      OUTPUT inserted.id, CONVERT(nvarchar(30), inserted.creadoEn, 126) AS creadoEn
      VALUES (@numero, GETDATE(), @pdfUrl, @excelUrl)
    `);

  const row = insertResult.recordset[0] as { id: number; creadoEn: string };

  // Insertar relaciones remito-tramite
  for (const idTramite of tramiteIds) {
    await pool.request()
      .input('idRemito',  sql.Int, row.id)
      .input('idTramite', sql.Int, idTramite)
      .query('INSERT INTO remito_tramites (idRemito, idTramite) VALUES (@idRemito, @idTramite)');
  }

  return {
    id:         row.id,
    numero,
    tramiteIds,
    tramites:   tramitesSnapshot,
    creadoEn:   row.creadoEn,
    pdfUrl,
    excelUrl,
  };
}
