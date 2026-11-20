import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2';
import { Pool as PgPool } from 'pg';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { resolveDbDialect } from './dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as mysqlSchema from './schema.mysql.ts';

export const dbDialect = resolveDbDialect();

declare global {
  var _postgresPool: PgPool | undefined;
  var _mysqlPool: mysql.Pool | undefined;
}

function createPgDb(): NodePgDatabase<typeof pgSchema> {
  if (!global._postgresPool) {
    global._postgresPool = new PgPool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL pool client:', err);
    });
  }
  return drizzlePg(global._postgresPool, { schema: pgSchema });
}

function createMysqlDb(): NodePgDatabase<typeof pgSchema> {
  if (!global._mysqlPool) {
    const uri = process.env.MYSQL_URL;
    global._mysqlPool = uri
      ? mysql.createPool({
          uri,
          connectionLimit: 10,
          waitForConnections: true,
          charset: 'utf8mb4',
        })
      : mysql.createPool({
          host: process.env.MYSQL_HOST || process.env.SQL_HOST || '127.0.0.1',
          port: Number(process.env.MYSQL_PORT || 3306),
          user: process.env.MYSQL_USER || process.env.SQL_USER || 'root',
          password: process.env.MYSQL_PASSWORD || process.env.SQL_PASSWORD || '',
          database: process.env.MYSQL_DATABASE || process.env.SQL_DB_NAME || 'masrafpro',
          connectionLimit: 10,
          waitForConnections: true,
          charset: 'utf8mb4',
        });
  }
  return drizzleMysql(global._mysqlPool, {
    schema: mysqlSchema,
    mode: 'default',
  }) as unknown as NodePgDatabase<typeof pgSchema>;
}

export const db: NodePgDatabase<typeof pgSchema> =
  dbDialect === 'mysql' ? createMysqlDb() : createPgDb();

export async function insertAndFetchById<TTable extends { id: any }>(
  table: TTable,
  values: Record<string, unknown>
): Promise<any> {
  if (dbDialect === 'mysql') {
    const result = (await db.insert(table as any).values(values as any)) as unknown as
      | [{ insertId?: number }, unknown]
      | { insertId?: number };
    const insertId = Number(
      Array.isArray(result) ? result[0]?.insertId : (result as { insertId?: number })?.insertId
    );
    const rows = await db
      .select()
      .from(table as any)
      .where(eq(table.id, insertId))
      .limit(1);
    return rows[0];
  }

  const rows = await (db.insert(table as any).values(values as any) as any).returning();
  return rows[0];
}
