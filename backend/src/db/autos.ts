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

// UPSERT auto por nroChasis (clave candidata del vehículo). Devuelve el id resultante.
export async function dbUpsertAuto(
  data: Omit<GestorAuto, 'id'>
): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('facturaNro',         sql.VarChar,        data.facturaNro)
    .input('facturaFecha',       sql.Date,            data.facturaFecha ? new Date(data.facturaFecha) : null)
    .input('nroChasis',          sql.VarChar,        data.nroChasis)
    .input('marcaChasis',        sql.VarChar,        data.marcaChasis)
    .input('modelo',             sql.VarChar,        data.modelo)
    .input('nroMotor',           sql.VarChar,        data.nroMotor)
    .input('marcaMotor',         sql.VarChar,        data.marcaMotor)
    .input('ano',                sql.Int,             data.ano)
    .input('codFabrica',         sql.VarChar,        data.codFabrica)
    .input('facturaMonto',       sql.Decimal(18, 2), data.facturaMonto)
    .input('certificadoFabrica', sql.VarChar,        data.certificadoFabrica)
    .input('codigoClase',        sql.Int,             data.codigoClase)
    .query(`
      DECLARE @id INT;
      SELECT @id = id FROM gestor_autos WHERE nroChasis = @nroChasis;
      IF @id IS NULL BEGIN
        INSERT INTO gestor_autos
          (facturaNro, facturaFecha, nroChasis, marcaChasis, modelo, nroMotor,
           marcaMotor, ano, codFabrica, facturaMonto, certificadoFabrica, codigoClase)
        VALUES
          (@facturaNro, @facturaFecha, @nroChasis, @marcaChasis, @modelo, @nroMotor,
           @marcaMotor, @ano, @codFabrica, @facturaMonto, @certificadoFabrica, @codigoClase);
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE gestor_autos
        SET facturaNro = @facturaNro, facturaFecha = @facturaFecha,
            marcaChasis = @marcaChasis, modelo = @modelo,
            nroMotor = @nroMotor, marcaMotor = @marcaMotor, ano = @ano,
            codFabrica = @codFabrica, facturaMonto = @facturaMonto,
            certificadoFabrica = @certificadoFabrica, codigoClase = @codigoClase
        WHERE id = @id;
      END
      SELECT @id AS id;
    `);
  return (result.recordset[0] as { id: number }).id;
}
