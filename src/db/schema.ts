import { resolveDbDialect } from './dialect.ts';
import * as pgSchema from './schema.pg.ts';
import * as mysqlSchema from './schema.mysql.ts';

const activeSchema = (resolveDbDialect() === 'mysql' ? mysqlSchema : pgSchema) as unknown as typeof pgSchema;

export const {
  users,
  companySettings,
  expenses,
  expenseAuditLogs,
  payouts,
  usersRelations,
  payoutsRelations,
  expensesRelations,
  expenseAuditLogsRelations,
} = activeSchema;
