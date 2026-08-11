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
