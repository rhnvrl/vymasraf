export type DbDialect = 'mysql' | 'postgresql';

export function resolveDbDialect(): DbDialect {
  const explicit = (process.env.DB_DIALECT || '').trim().toLowerCase();
  if (explicit === 'mysql' || explicit === 'mariadb') return 'mysql';
  if (explicit === 'postgres' || explicit === 'postgresql' || explicit === 'pg') return 'postgresql';
  if (process.env.MYSQL_HOST || process.env.MYSQL_DATABASE || process.env.MYSQL_URL) return 'mysql';
  return 'postgresql';
}
