import sql from 'mssql';

const config: sql.config = {
  server:   process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 1433),
  database: process.env.DB_NAME     ?? 'netdriver_trgs',
  user:     process.env.DB_USER     ?? 'sa',
  password: process.env.DB_PASSWORD ?? '',
  options: {
    encrypt: false,              // true para Azure SQL
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
  }
  return pool;
}

export { sql };
