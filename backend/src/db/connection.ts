/**
 * Configuración de conexión a base de datos MySQL
 */

import mysql from 'mysql2/promise';
import { Pool } from 'mysql2/promise';

let pool: Pool;

export async function initializeDatabase(): Promise<Pool> {
  const config: any = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    database: process.env.DB_NAME || 'telemedicina_tfg',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };

  // Solo agregar password si está definida y no vacía
  if (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim()) {
    config.password = process.env.DB_PASSWORD;
  }

  pool = mysql.createPool(config);

  // Test connection
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Query helper con soporte a parámetros
 */
export async function query<T>(sql: string, values: any[] = []): Promise<T[]> {
  const connection = await getDatabase().getConnection();
  try {
    const [results] = await connection.execute(sql, values);
    return results as T[];
  } finally {
    connection.release();
  }
}

/**
 * Query única
 */
export async function queryOne<T>(sql: string, values: any[] = []): Promise<T | null> {
  const results = await query<T>(sql, values);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute query (para INSERT, UPDATE, DELETE)
 */
export async function execute(sql: string, values: any[] = []): Promise<any> {
  const connection = await getDatabase().getConnection();
  try {
    const [result] = await connection.execute(sql, values);
    return result;
  } finally {
    connection.release();
  }
}
