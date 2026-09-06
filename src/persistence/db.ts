import pg from 'pg';
import { dbConfig } from './config.js';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: dbConfig.connectionString });
  }
  return pool;
}
