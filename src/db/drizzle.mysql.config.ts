import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const host = process.env.MYSQL_HOST || process.env.SQL_HOST || '127.0.0.1';
const port = Number(process.env.MYSQL_PORT || 3306);
const user = process.env.MYSQL_USER || process.env.SQL_ADMIN_USER || process.env.SQL_USER || 'root';
const password = process.env.MYSQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || '';
const database = process.env.MYSQL_DATABASE || process.env.SQL_DB_NAME || 'masrafpro';

export default defineConfig({
  schema: './src/db/schema.mysql.ts',
  out: './drizzle-mysql',
  dialect: 'mysql',
  dbCredentials: {
    host,
    port,
    user,
    password,
    database,
  },
  verbose: true,
});
