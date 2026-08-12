import { getPool, sql } from './index.js';
import type { Remito, RemitoTramite } from '../../../shared/types/index.js';

// ---------------------------------------------------------------------------
// Query reutilizable: tramites de un remito → RemitoTramite[]
// ---------------------------------------------------------------------------
async function queryTramitesDeRemito(idRemito: number): Promise<RemitoTramite[]> {
  const pool = await getPool();
  const result = await pool.request()
    .input('idRemito', sql.Int, idRemito)
    .query(`
      SELECT
        t.id_tramite                                                    AS id,
        t.traID, t.formularioNro01, t.formularioNro12,
        a.nroChasis, a.marcaChasis, a.modelo, a.certificadoFabrica,
        ISNULL(p.Apellido, '') + ISNULL(', ' + NULLIF(p.Nombre, ''), '') AS nombre,
        ISNULL(p.tipocuit, '') + ISNULL(p.nrocuit, '')                   AS cuit
      FROM remito_tramites rt
      INNER JOIN gestor_tramites t  ON rt.idTramite = t.id_tramite
      INNER JOIN gestor_autos    a  ON t.id_auto    = a.id_auto
      INNER JOIN gestor_personas p  ON t.id_persona = p.id_persona
      WHERE rt.idRemito = @idRemito
    `);
  return (result.recordset as Record<string, unknown>[]).map((r) => ({
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
  }));
}

// ---------------------------------------------------------------------------
// Listar todos los remitos con sus tramites
// ---------------------------------------------------------------------------
export async function dbListarRemitos(): Promise<Remito[]> {
  const pool = await getPool();

  const rResult = await pool.request().query(`
    SELECT r.id, r.nroRemito, r.estado,
           CONVERT(nvarchar(30), r.creadoEn, 126) AS creadoEn,
           ISNULL(r.pdfUrl, '')    AS pdfUrl,
           ISNULL(r.excelUrl, '') AS excelUrl
    FROM remitos r
    ORDER BY r.nroRemito DESC
  `);

  const rows = rResult.recordset as {
    id: number; nroRemito: number; estado: string; creadoEn: string; pdfUrl: string; excelUrl: string
  }[];

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const tResult = await pool.request().query(`
    SELECT
      rt.idRemito,
      t.id_tramite                                                    AS id,
      t.traID, t.formularioNro01, t.formularioNro12,
      a.nroChasis, a.marcaChasis, a.modelo, a.certificadoFabrica,
      ISNULL(p.Apellido, '') + ISNULL(', ' + NULLIF(p.Nombre, ''), '') AS nombre,
      ISNULL(p.tipocuit, '') + ISNULL(p.nrocuit, '')                   AS cuit
    FROM remito_tramites rt
    INNER JOIN gestor_tramites t  ON rt.idTramite = t.id_tramite
    INNER JOIN gestor_autos    a  ON t.id_auto    = a.id_auto
    INNER JOIN gestor_personas p  ON t.id_persona = p.id_persona
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
    id:         r.id,
    nroRemito:  r.nroRemito,
    estado:     r.estado as 'abierto' | 'cerrado',
    tramiteIds: (tramitesByRemito.get(r.id) ?? []).map((t) => t.id),
    tramites:   tramitesByRemito.get(r.id) ?? [],
    creadoEn:   r.creadoEn,
    pdfUrl:     r.pdfUrl,
    excelUrl:   r.excelUrl,
  }));
}

// ---------------------------------------------------------------------------
// Obtener el remito actualmente abierto (o null)
// ---------------------------------------------------------------------------
export async function dbGetRemitoAbierto(): Promise<Remito | null> {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 1 r.id, r.nroRemito, r.estado,
           CONVERT(nvarchar(30), r.creadoEn, 126) AS creadoEn,
           ISNULL(r.pdfUrl, '')    AS pdfUrl,
           ISNULL(r.excelUrl, '') AS excelUrl
    FROM remitos r
    WHERE r.estado = 'abierto'
  `);
  if (result.recordset.length === 0) return null;
  const r = result.recordset[0] as { id: number; nroRemito: number; estado: string; creadoEn: string; pdfUrl: string; excelUrl: string };
  const tramites = await queryTramitesDeRemito(r.id);
  return {
    id: r.id, nroRemito: r.nroRemito, estado: 'abierto',
    tramiteIds: tramites.map((t) => t.id),
    tramites, creadoEn: r.creadoEn, pdfUrl: r.pdfUrl, excelUrl: r.excelUrl,
  };
}

// ---------------------------------------------------------------------------
// Obtener datos básicos de un remito (sin tramites)
// ---------------------------------------------------------------------------
export async function dbGetRemitoBasic(id: number): Promise<{ id: number; nroRemito: number; estado: 'abierto' | 'cerrado'; pdfUrl: string; excelUrl: string; creadoEn: string } | null> {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT r.id, r.nroRemito, r.estado,
             CONVERT(nvarchar(30), r.creadoEn, 126) AS creadoEn,
             ISNULL(r.pdfUrl, '')    AS pdfUrl,
             ISNULL(r.excelUrl, '') AS excelUrl
      FROM remitos r WHERE r.id = @id
    `);
  if (result.recordset.length === 0) return null;
  const r = result.recordset[0] as { id: number; nroRemito: number; estado: string; creadoEn: string; pdfUrl: string; excelUrl: string };
  return { ...r, estado: r.estado as 'abierto' | 'cerrado' };
}

// ---------------------------------------------------------------------------
// Tramites de un remito para generación de PDF
// ---------------------------------------------------------------------------
export async function dbGetRemitoTramites(idRemito: number): Promise<RemitoTramite[]> {
  return queryTramitesDeRemito(idRemito);
}

// ---------------------------------------------------------------------------
// Crear remito vacío abierto; cierra el activo anterior si existe
// ---------------------------------------------------------------------------
export async function dbCrearRemitoVacio(): Promise<{ remito: Remito; cerradoId: number | null }> {
  const pool = await getPool();

  // Cerrar el remito abierto actual
  const previo = await dbGetRemitoAbierto();
  if (previo) {
    await pool.request()
      .input('id', sql.Int, previo.id)
      .query("UPDATE remitos SET estado = 'cerrado' WHERE id = @id");
  }

  // Siguiente número correlativo (MAX garantiza correlatividad; no usa IDENTITY)
  const nroResult = await pool.request().query("SELECT ISNULL(MAX(nroRemito), 0) + 1 AS nextNro FROM remitos");
  const nroRemito = (nroResult.recordset[0] as { nextNro: number }).nextNro;

  const insertResult = await pool.request()
    .input('nroRemito', sql.Int, nroRemito)
    .query(`
      INSERT INTO remitos (nroRemito, creadoEn, estado)
      OUTPUT inserted.id, CONVERT(nvarchar(30), inserted.creadoEn, 126) AS creadoEn
      VALUES (@nroRemito, GETDATE(), 'abierto')
    `);
  const row = insertResult.recordset[0] as { id: number; creadoEn: string };

  const remito: Remito = {
    id: row.id, nroRemito, estado: 'abierto',
    tramiteIds: [], tramites: [],
    creadoEn: row.creadoEn, pdfUrl: '', excelUrl: '',
  };
  return { remito, cerradoId: previo?.id ?? null };
}

// ---------------------------------------------------------------------------
// Finalizar (cerrar) un remito: actualiza estado + URLs del PDF/Excel
// ---------------------------------------------------------------------------
export async function dbFinalizarRemito(id: number, pdfUrl: string, excelUrl: string): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id',      sql.Int,     id)
    .input('pdfUrl',  sql.VarChar, pdfUrl)
    .input('excelUrl',sql.VarChar, excelUrl)
    .query("UPDATE remitos SET estado = 'cerrado', pdfUrl = @pdfUrl, excelUrl = @excelUrl WHERE id = @id");
}

// ---------------------------------------------------------------------------
// Reabrir un remito cerrado; cierra el activo anterior si existe
// ---------------------------------------------------------------------------
export async function dbAbrirRemito(id: number): Promise<{ cerradoId: number | null }> {
  const pool = await getPool();

  const previo = await dbGetRemitoAbierto();
  if (previo && previo.id !== id) {
    await pool.request()
      .input('idCerrar', sql.Int, previo.id)
      .query("UPDATE remitos SET estado = 'cerrado' WHERE id = @idCerrar");
  }

  await pool.request()
    .input('id', sql.Int, id)
    .query("UPDATE remitos SET estado = 'abierto' WHERE id = @id");

  return { cerradoId: (previo && previo.id !== id) ? previo.id : null };
}

// ---------------------------------------------------------------------------
// Agregar un tramite al remito abierto y guardar el Titulo en gestor_tramites
// ---------------------------------------------------------------------------
export async function dbAddTramiteToRemito(idRemito: number, idTramite: number, nroRemito: number): Promise<void> {
  const pool = await getPool();
  const titulo = `RTO-${nroRemito}`;
  await pool.request()
    .input('idRemito',  sql.Int,     idRemito)
    .input('idTramite', sql.Int,     idTramite)
    .input('titulo',    sql.NVarChar, titulo)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM remito_tramites WHERE idRemito = @idRemito AND idTramite = @idTramite
      )
        INSERT INTO remito_tramites (idRemito, idTramite) VALUES (@idRemito, @idTramite);
      UPDATE gestor_tramites SET Titulo = @titulo WHERE id_tramite = @idTramite;
    `);
}
