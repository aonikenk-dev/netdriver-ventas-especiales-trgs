import { getPool, sql } from './index.js';
import type { GestorAuto } from '../../../shared/types/index.js';

// Devuelve los nroChasis del input que ya existen en gestor_autos.
export async function dbGetChasisExistentes(nrosChasis: string[]): Promise<string[]> {
  if (nrosChasis.length === 0) return [];
  const pool = await getPool();
  const req = pool.request();
  const placeholders = nrosChasis.map((c, i) => {
    req.input(`c${i}`, sql.VarChar, c);
    return `@c${i}`;
  });
  const result = await req.query(
    `SELECT nroChasis FROM gestor_autos WHERE nroChasis IN (${placeholders.join(',')})`
  );
  return (result.recordset as { nroChasis: string }[]).map((r) => r.nroChasis);
}

// Actualizar campos de un auto existente (por id_auto).
export async function dbUpdateAuto(
  id: number,
  data: {
    nroChasis?: string; facturaNro?: string; facturaFecha?: string; marcaChasis?: string;
    modelo?: string; nroMotor?: string; marcaMotor?: string;
    ano?: string; codFabrica?: string; facturaMonto?: string; certificadoFabrica?: string;
  }
): Promise<void> {
  const pool = await getPool();
  const sets: string[] = [];
  const req = pool.request().input('id', sql.Int, id);

  if (data.nroChasis       !== undefined) { sets.push('nroChasis = @nroChasis');             req.input('nroChasis',       sql.NVarChar, data.nroChasis); }
  if (data.facturaNro      !== undefined) { sets.push('facturaNro = @facturaNro');           req.input('facturaNro',      sql.NVarChar, data.facturaNro); }
  if (data.facturaFecha    !== undefined) { sets.push('facturaFecha = @facturaFecha');       req.input('facturaFecha',    sql.DateTime, data.facturaFecha ? new Date(data.facturaFecha) : null); }
  if (data.marcaChasis     !== undefined) { sets.push('marcaChasis = @marcaChasis');         req.input('marcaChasis',     sql.NVarChar, data.marcaChasis); }
  if (data.modelo          !== undefined) { sets.push('modelo = @modelo');                   req.input('modelo',          sql.NVarChar, data.modelo); }
  if (data.nroMotor        !== undefined) { sets.push('nroMotor = @nroMotor');               req.input('nroMotor',        sql.NVarChar, data.nroMotor); }
  if (data.marcaMotor      !== undefined) { sets.push('marcaMotor = @marcaMotor');           req.input('marcaMotor',      sql.NVarChar, data.marcaMotor); }
  if (data.ano             !== undefined) { sets.push('ano = @ano');                         req.input('ano',             sql.NVarChar, data.ano); }
  if (data.codFabrica      !== undefined) { sets.push('codFabrica = @codFabrica');           req.input('codFabrica',      sql.NVarChar, data.codFabrica); }
  if (data.facturaMonto    !== undefined) { sets.push('facturaMonto = @facturaMonto');       req.input('facturaMonto',    sql.NVarChar, data.facturaMonto); }
  if (data.certificadoFabrica !== undefined) { sets.push('certificadoFabrica = @certificadoFabrica'); req.input('certificadoFabrica', sql.NVarChar, data.certificadoFabrica); }

  if (sets.length > 0) {
    await req.query(`UPDATE gestor_autos SET ${sets.join(', ')} WHERE id_auto = @id`);
  }
}

// UPSERT auto por nroChasis (clave candidata del vehículo). Devuelve el id_auto resultante.
// codigoClase NO se almacena en gestor_autos — vive en gestor_tramites.CodigoClase.
export async function dbUpsertAuto(
  data: Omit<GestorAuto, 'id'>
): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('facturaNro',         sql.NVarChar,  data.facturaNro)
    .input('facturaFecha',       sql.DateTime,  data.facturaFecha ? new Date(data.facturaFecha) : null)
    .input('nroChasis',          sql.NVarChar,  data.nroChasis)
    .input('marcaChasis',        sql.NVarChar,  data.marcaChasis)
    .input('modelo',             sql.NVarChar,  data.modelo)
    .input('nroMotor',           sql.NVarChar,  data.nroMotor)
    .input('marcaMotor',         sql.NVarChar,  data.marcaMotor)
    .input('ano',                sql.NVarChar,  data.ano)
    .input('codFabrica',         sql.NVarChar,  data.codFabrica)
    .input('facturaMonto',       sql.NVarChar,  data.facturaMonto)
    .input('certificadoFabrica', sql.NVarChar,  data.certificadoFabrica)
    .query(`
      DECLARE @id INT;
      SELECT @id = id_auto FROM gestor_autos WHERE nroChasis = @nroChasis;
      IF @id IS NULL BEGIN
        INSERT INTO gestor_autos
          (facturaNro, facturaFecha, nroChasis, marcaChasis, modelo, nroMotor,
           marcaMotor, ano, codFabrica, facturaMonto, certificadoFabrica)
        VALUES
          (@facturaNro, @facturaFecha, @nroChasis, @marcaChasis, @modelo, @nroMotor,
           @marcaMotor, @ano, @codFabrica, @facturaMonto, @certificadoFabrica);
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE gestor_autos
        SET facturaNro = @facturaNro, facturaFecha = @facturaFecha,
            marcaChasis = @marcaChasis, modelo = @modelo,
            nroMotor = @nroMotor, marcaMotor = @marcaMotor, ano = @ano,
            codFabrica = @codFabrica, facturaMonto = @facturaMonto,
            certificadoFabrica = @certificadoFabrica
        WHERE id_auto = @id;
      END
      SELECT @id AS id;
    `);
  return (result.recordset[0] as { id: number }).id;
}
