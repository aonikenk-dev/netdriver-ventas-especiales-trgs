import { getPool, sql } from './index.js';
import type { GestorPersona } from '../../../shared/types/index.js';

// Parte el nombre combinado "APELLIDO, NOMBRE" en sus dos campos del esquema real.
function splitNombre(nombre: string): { apellido: string; nombrePart: string } {
  const idx = nombre.indexOf(',');
  if (idx === -1) return { apellido: nombre.trim(), nombrePart: '' };
  return { apellido: nombre.substring(0, idx).trim(), nombrePart: nombre.substring(idx + 1).trim() };
}

// Parte el CUIT "XXYYYYYYYYYZ" en tipocuit (2 chars) + nrocuit (resto).
function splitCuit(cuit: string): { tipocuit: string; nrocuit: string } {
  const clean = cuit.replace(/[^0-9]/g, '');
  return { tipocuit: clean.substring(0, 2), nrocuit: clean.substring(2) };
}

// Actualizar nombre y/o cuit de una persona existente (por id_persona).
export async function dbUpdatePersona(
  id: number,
  data: { nombre?: string; cuit?: string }
): Promise<void> {
  const pool = await getPool();
  const sets: string[] = [];
  const req = pool.request().input('id', sql.Int, id);

  if (data.nombre !== undefined) {
    const { apellido, nombrePart } = splitNombre(data.nombre);
    sets.push('Apellido = @apellido', 'Nombre = @nombre');
    req.input('apellido', sql.NVarChar, apellido);
    req.input('nombre',   sql.NVarChar, nombrePart);
  }
  if (data.cuit !== undefined) {
    const { tipocuit, nrocuit } = splitCuit(data.cuit);
    sets.push('tipocuit = @tipocuit', 'nrocuit = @nrocuit');
    req.input('tipocuit', sql.NVarChar, tipocuit);
    req.input('nrocuit',  sql.NVarChar, nrocuit);
  }

  if (sets.length > 0) {
    await req.query(`UPDATE gestor_personas SET ${sets.join(', ')} WHERE id_persona = @id`);
  }
}

// UPSERT persona por (tipocuit + nrocuit + id_gestor). Devuelve el id_persona resultante.
export async function dbUpsertPersona(
  data: Omit<GestorPersona, 'id'>
): Promise<number> {
  const pool = await getPool();
  const { apellido, nombrePart } = splitNombre(data.nombre);
  const { tipocuit, nrocuit } = splitCuit(data.cuit);

  const result = await pool.request()
    .input('idGestor',      sql.Int,      data.idGestor)
    .input('apellido',      sql.NVarChar, apellido)
    .input('nombre',        sql.NVarChar, nombrePart)
    .input('tipocuit',      sql.NVarChar, tipocuit)
    .input('nrocuit',       sql.NVarChar, nrocuit)
    .input('idTipoPersona', sql.Int,      data.idTipoPersona)
    .query(`
      DECLARE @id INT;
      SELECT @id = id_persona
      FROM gestor_personas
      WHERE tipocuit = @tipocuit AND nrocuit = @nrocuit AND id_gestor = @idGestor;

      IF @id IS NULL BEGIN
        INSERT INTO gestor_personas (id_gestor, Apellido, Nombre, tipocuit, nrocuit, id_tipo_persona)
        VALUES (@idGestor, @apellido, @nombre, @tipocuit, @nrocuit, @idTipoPersona);
        SET @id = SCOPE_IDENTITY();
      END ELSE BEGIN
        UPDATE gestor_personas
        SET Apellido = @apellido, Nombre = @nombre, id_tipo_persona = @idTipoPersona
        WHERE id_persona = @id;
      END
      SELECT @id AS id;
    `);
  return (result.recordset[0] as { id: number }).id;
}
