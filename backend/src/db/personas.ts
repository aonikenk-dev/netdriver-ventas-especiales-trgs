import { getPool, sql } from './index.js';
import type { GestorPersona } from '../../../shared/types/index.js';

// UPSERT persona por (cuit, idGestor). Devuelve el id resultante.
export async function dbUpsertPersona(
  data: Omit<GestorPersona, 'id'>
): Promise<number> {
  const pool = await getPool();
  const result = await pool.request()
    .input('idGestor',      sql.Int,       data.idGestor)
    .input('nombre',        sql.NVarChar,  data.nombre)
    .input('cuit',          sql.VarChar,   data.cuit)
    .input('idTipoPersona', sql.Int,       data.idTipoPersona)
    .query(`
      DECLARE @id INT;
      SELECT @id = id FROM gestor_personas WHERE cuit = @cuit AND idGestor = @idGestor;
      IF @id IS NULL BEGIN
        INSERT INTO gestor_personas (idGestor, nombre, cuit, idTipoPersona)
        VALUES (@idGestor, @nombre, @cuit, @idTipoPersona);
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE gestor_personas
        SET nombre = @nombre, idTipoPersona = @idTipoPersona
        WHERE id = @id;
      END
      SELECT @id AS id;
    `);
  return (result.recordset[0] as { id: number }).id;
}
