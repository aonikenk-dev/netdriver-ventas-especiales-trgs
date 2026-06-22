// Conexion a SQL Server existente.
// PROTOTIPO: no se conecta a una base real todavia. Cuando se complete
// el sistema, reemplazar getPool() por una conexion mssql real usando
// las variables DB_* de backend/.env.

export function isMockDb(): boolean {
  return true;
}

export async function getPool(): Promise<never> {
  throw new Error(
    'DB real no implementada todavia: este prototipo usa src/mocks/data.ts como almacen en memoria.'
  );
}
