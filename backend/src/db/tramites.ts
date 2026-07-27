import { getPool, sql } from './index.js';
import type {
  CodigoClase, EstadoTramite, GestorFormulario, GestorTramite,
  TramiteListParams, TramiteListResult,
} from '../../../shared/types/index.js';

// ---------------------------------------------------------------------------
// Mapper fila SQL → GestorTramite
// ---------------------------------------------------------------------------
function rowToTramite(r: Record<string, unknown>, formularios: GestorFormulario[]): GestorTramite {
  return {
    id:              r.id as number,
    auto: {
      id:                 r.autoId as number,
      facturaNro:         (r.facturaNro as string) ?? '',
      facturaFecha:       (r.facturaFecha as string) ?? '',
      nroChasis:          r.nroChasis as string,
      marcaChasis:        (r.marcaChasis as string) ?? '',
      modelo:             (r.modelo as string) ?? '',
      nroMotor:           (r.nroMotor as string) ?? '',
      marcaMotor:         (r.marcaMotor as string) ?? '',
      ano:                (r.ano as number) ?? 0,
      codFabrica:         (r.codFabrica as string) ?? '',
      facturaMonto:       (r.facturaMonto as number) ?? 0,
      certificadoFabrica: (r.certificadoFabrica as string) ?? '',
      codigoClase:        r.codigoClase as CodigoClase,
    },
    titular: {
      id:             r.personaId as number,
      idGestor:       r.idGestor as number,
      nombre:         r.nombre as string,
      cuit:           r.cuit as string,
      idTipoPersona:  r.idTipoPersona as number,
    },
    estado:           r.estado as EstadoTramite,
    traID:            (r.traID as string | null) ?? null,
    errorDesc:        (r.errorDesc as string | null) ?? null,
    formularioNro01:  (r.formularioNro01 as string | null) ?? null,
    formularioNro12:  (r.formularioNro12 as string | null) ?? null,
    formularios,
    logs:             [],
    creadoEn:         r.creadoEn as string,
    enviadoARemito:   !!(r.enviadoARemito as number | boolean),
  };
}

const BASE_SELECT = `
  SELECT
    t.id, t.estado, t.traID, t.errorDesc,
    t.formularioNro01, t.formularioNro12,
    t.enviadoARemito,
    CONVERT(nvarchar(30), t.creadoEn, 126)       AS creadoEn,
    a.id                                          AS autoId,
    a.facturaNro,
    CONVERT(nvarchar(10), a.facturaFecha, 126)    AS facturaFecha,
    a.nroChasis, a.marcaChasis, a.modelo,
    a.nroMotor, a.marcaMotor, a.ano, a.codFabrica,
    CAST(a.facturaMonto AS float)                 AS facturaMonto,
    a.certificadoFabrica, a.codigoClase,
    p.id                                          AS personaId,
    p.idGestor, p.nombre, p.cuit, p.idTipoPersona
  FROM gestor_tramites t
  INNER JOIN gestor_autos   a ON t.idAuto    = a.id
  INNER JOIN gestor_personas p ON t.idPersona = p.id
`;

// Traer formularios para un conjunto de tramiteIds
async function fetchFormularios(ids: number[]): Promise<Map<number, GestorFormulario[]>> {
  const map = new Map<number, GestorFormulario[]>();
  if (ids.length === 0) return map;
  const pool = await getPool();
  // IDs son enteros generados internamente → interpolación segura
  const result = await pool.request().query(
    `SELECT id, idTramite, tipo, numero FROM gestor_formularios WHERE idTramite IN (${ids.join(',')})`
  );
  for (const f of result.recordset as Record<string, unknown>[]) {
    const tid = f.idTramite as number;
    const list = map.get(tid) ?? [];
    list.push({ id: f.id as number, idTramite: tid, tipo: f.tipo as GestorFormulario['tipo'], numero: f.numero as string });
    map.set(tid, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Listar tramites con filtros, orden y paginacion
// ---------------------------------------------------------------------------
export async function dbListarTramites(params: TramiteListParams): Promise<TramiteListResult> {
  const pool = await getPool();
  const {
    page = 1, pageSize = 10, search = '',
    estado = 'all', ni = 'all', enviadoARemito,
    sortBy = 'creadoEn', sortDir = 'desc',
  } = params;

  const sortCol: Record<string, string> = {
    chasis:   'a.nroChasis',
    titular:  'p.nombre',
    estado:   't.estado',
    creadoEn: 't.creadoEn',
  };
  const orderBy = `${sortCol[sortBy] ?? 't.creadoEn'} ${sortDir === 'asc' ? 'ASC' : 'DESC'}`;

  const where = `
    WHERE (@search = '' OR LOWER(a.nroChasis) LIKE '%' + @search + '%'
                        OR LOWER(p.nombre)    LIKE '%' + @search + '%'
                        OR LOWER(ISNULL(CAST(t.traID AS nvarchar), '')) LIKE '%' + @search + '%')
      AND (@estado IS NULL OR t.estado = @estado)
      AND (@codigoClase IS NULL OR a.codigoClase = @codigoClase)
      AND (@enviadoARemito IS NULL OR t.enviadoARemito = @enviadoARemito)
  `;

  const inputs = (req: ReturnType<typeof pool.request>) => req
    .input('search',          sql.NVarChar,  search.toLowerCase())
    .input('estado',          sql.VarChar,   estado === 'all' ? null : estado)
    .input('codigoClase',     sql.Int,       ni === 'all' ? null : Number(ni))
    .input('enviadoARemito',  sql.Bit,       enviadoARemito ?? null)
    .input('offset',          sql.Int,       (page - 1) * pageSize)
    .input('pageSize',        sql.Int,       pageSize);

  const [mainResult, countResult] = await Promise.all([
    inputs(pool.request()).query(
      `${BASE_SELECT} ${where} ORDER BY ${orderBy} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`
    ),
    inputs(pool.request()).query(
      `SELECT COUNT(*) AS total FROM gestor_tramites t
       INNER JOIN gestor_autos   a ON t.idAuto    = a.id
       INNER JOIN gestor_personas p ON t.idPersona = p.id ${where}`
    ),
  ]);

  const rows = mainResult.recordset as Record<string, unknown>[];
  const total = (countResult.recordset[0] as { total: number }).total;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fMap = await fetchFormularios(rows.map((r) => r.id as number));
  const tramites = rows.map((r) => rowToTramite(r, fMap.get(r.id as number) ?? []));

  return { tramites, total, page, pageSize, totalPages };
}

// ---------------------------------------------------------------------------
// Buscar un tramite por ID
// ---------------------------------------------------------------------------
export async function dbFindTramite(id: number): Promise<GestorTramite | undefined> {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`${BASE_SELECT} WHERE t.id = @id`);
  const rows = result.recordset as Record<string, unknown>[];
  if (rows.length === 0) return undefined;
  const fMap = await fetchFormularios([id]);
  return rowToTramite(rows[0], fMap.get(id) ?? []);
}

// ---------------------------------------------------------------------------
// Actualizar numeros de formulario
// ---------------------------------------------------------------------------
export async function dbUpdateFormulario(
  id: number,
  cambios: { formularioNro01?: string; formularioNro12?: string }
): Promise<GestorTramite> {
  const pool = await getPool();
  const sets: string[] = [];
  const req = pool.request().input('id', sql.Int, id);
  if (cambios.formularioNro01 !== undefined) {
    sets.push('formularioNro01 = @f01');
    req.input('f01', sql.VarChar, cambios.formularioNro01);
  }
  if (cambios.formularioNro12 !== undefined) {
    sets.push('formularioNro12 = @f12');
    req.input('f12', sql.VarChar, cambios.formularioNro12);
  }
  if (sets.length > 0) {
    await req.query(`UPDATE gestor_tramites SET ${sets.join(', ')} WHERE id = @id`);
  }
  return (await dbFindTramite(id))!;
}

// ---------------------------------------------------------------------------
// Marcar como enviado a remito
// ---------------------------------------------------------------------------
export async function dbEnviarARemito(id: number): Promise<GestorTramite> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE gestor_tramites SET enviadoARemito = 1 WHERE id = @id');
  return (await dbFindTramite(id))!;
}

// ---------------------------------------------------------------------------
// Actualizar estado durante/post envio SUATS
// ---------------------------------------------------------------------------
export async function dbSetEnviando(id: number): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, id)
    .query("UPDATE gestor_tramites SET estado = 'enviando' WHERE id = @id");
}

export async function dbSetOk(id: number, traID: string): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id',    sql.Int,     id)
    .input('traID', sql.VarChar, traID)
    .query("UPDATE gestor_tramites SET estado = 'ok', traID = @traID, errorDesc = NULL WHERE id = @id");
}

export async function dbSetError(id: number, errorDesc: string): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('id',        sql.Int,      id)
    .input('errorDesc', sql.NVarChar, errorDesc)
    .query("UPDATE gestor_tramites SET estado = 'error', traID = NULL, errorDesc = @errorDesc WHERE id = @id");
}

// ---------------------------------------------------------------------------
// Insertar tramite (desde importacion Excel)
// ---------------------------------------------------------------------------
export async function dbInsertTramite(idAuto: number, idPersona: number): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('idAuto',    sql.Int, idAuto)
    .input('idPersona', sql.Int, idPersona)
    .query(`
      INSERT INTO gestor_tramites (idAuto, idPersona, estado, creadoEn, enviadoARemito)
      OUTPUT inserted.id
      VALUES (@idAuto, @idPersona, 'pendiente', GETDATE(), 0)
    `);
  return (result.recordset[0] as { id: number }).id;
}

// ---------------------------------------------------------------------------
// Insertar formulario post-WS
// ---------------------------------------------------------------------------
export async function dbInsertFormulario(
  idTramite: number,
  tipo: string,
  numero: string,
  pdfBase64?: string
): Promise<void> {
  const pool = await getPool();
  await pool.request()
    .input('idTramite', sql.Int,       idTramite)
    .input('tipo',      sql.VarChar,   tipo)
    .input('numero',    sql.VarChar,   numero)
    .input('pdf',       sql.NVarChar,  pdfBase64 ?? null)
    .query(`
      INSERT INTO gestor_formularios (idTramite, tipo, numero, pdfBase64)
      VALUES (@idTramite, @tipo, @numero, @pdf)
    `);
}

// ---------------------------------------------------------------------------
// Obtener un formulario especifico
// ---------------------------------------------------------------------------
export async function dbGetFormulario(
  idTramite: number,
  tipo: string
): Promise<GestorFormulario | undefined> {
  const pool = await getPool();
  const result = await pool.request()
    .input('idTramite', sql.Int,     idTramite)
    .input('tipo',      sql.VarChar, tipo)
    .query('SELECT id, idTramite, tipo, numero, pdfBase64 FROM gestor_formularios WHERE idTramite = @idTramite AND tipo = @tipo');
  const rows = result.recordset as Record<string, unknown>[];
  if (rows.length === 0) return undefined;
  const r = rows[0];
  return {
    id:        r.id as number,
    idTramite: r.idTramite as number,
    tipo:      r.tipo as GestorFormulario['tipo'],
    numero:    r.numero as string,
    pdfBase64: r.pdfBase64 as string | undefined,
  };
}
