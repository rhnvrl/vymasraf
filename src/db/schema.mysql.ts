import { relations } from 'drizzle-orm';
import {
  boolean,
  double,
  int,
  longtext,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core';

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  uid: varchar('uid', { length: 191 }).notNull().unique(),
  email: varchar('email', { length: 191 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('calisan'), // 'admin' | 'ortak' | 'calisan'
  department: varchar('department', { length: 191 }).notNull().default('Genel'),
  phone: varchar('phone', { length: 64 }).notNull().default(''),
  iban: varchar('iban', { length: 64 }).notNull().default(''),
  passwordHash: varchar('password_hash', { length: 255 }),
  monthlyBudgetLimit: double('monthly_budget_limit').notNull().default(15000),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const companySettings = mysqlTable('company_settings', {
  id: int('id').autoincrement().primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull().default('Anadolu Kurumsal A.Ş.'),
  shortName: varchar('short_name', { length: 32 }).notNull().default('MasrafPro'),
  taxNumber: varchar('tax_number', { length: 64 }).notNull().default(''),
  taxOffice: varchar('tax_office', { length: 191 }).notNull().default(''),
  logoDataUrl: longtext('logo_data_url'),
  pwaIconDataUrl: longtext('pwa_icon_data_url'),
  monthlyCompanyBudget: double('monthly_company_budget').notNull().default(120000),
  requireReceiptAboveAmount: double('require_receipt_above_amount').notNull().default(500),
  setupCompleted: boolean('setup_completed').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const expenses = mysqlTable('expenses', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .references(() => users.id)
    .notNull(),
  merchant: varchar('merchant', { length: 255 }).notNull(),
  merchantTaxId: varchar('merchant_tax_id', { length: 64 }).notNull().default(''),
  receiptNumber: varchar('receipt_number', { length: 128 }).notNull().default(''),
  documentType: varchar('document_type', { length: 64 }).notNull().default('fis'),
  category: varchar('category', { length: 191 }).notNull(),
  accountCode: varchar('account_code', { length: 32 }).notNull().default('770'),
  costCenter: varchar('cost_center', { length: 191 }).notNull().default('Merkez'),
  paymentMethod: varchar('payment_method', { length: 64 }).notNull().default('kisisel_kart'),
  amount: double('amount').notNull(),
  vatRate: int('vat_rate').notNull().default(0),
  vatAmount: double('vat_amount').notNull().default(0),
  netAmount: double('net_amount').notNull().default(0),
  currency: varchar('currency', { length: 16 }).notNull().default('TRY'),
  expenseDate: varchar('expense_date', { length: 32 }).notNull(),
  description: text('description').notNull(),
  receiptImageDataUrl: longtext('receipt_image_data_url'),
  voiceNoteDataUrl: longtext('voice_note_data_url'),
  voiceTranscript: text('voice_transcript').notNull(),
  latitude: double('latitude'),
  longitude: double('longitude'),
  locationAccuracy: double('location_accuracy'),
  status: varchar('status', { length: 32 }).notNull().default('onaylandi'),
  rejectionReason: varchar('rejection_reason', { length: 500 }).notNull().default(''),
  reviewedByUserId: int('reviewed_by_user_id'),
  reviewedAt: timestamp('reviewed_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedByUserId: int('deleted_by_user_id'),
  deleteReason: varchar('delete_reason', { length: 500 }).notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenseAuditLogs = mysqlTable('expense_audit_logs', {
  id: int('id').autoincrement().primaryKey(),
  expenseId: int('expense_id').notNull(),
  action: varchar('action', { length: 64 }).notNull(),
  actorUserId: int('actor_user_id')
    .references(() => users.id)
    .notNull(),
  actorName: varchar('actor_name', { length: 255 }).notNull(),
  actorRole: varchar('actor_role', { length: 32 }).notNull(),
  ownerUserId: int('owner_user_id').notNull(),
  ownerName: varchar('owner_name', { length: 255 }).notNull(),
  merchant: varchar('merchant', { length: 255 }).notNull(),
  amount: double('amount').notNull(),
  expenseDate: varchar('expense_date', { length: 32 }).notNull(),
  reason: text('reason').notNull(),
  latitude: double('latitude'),
  longitude: double('longitude'),
  snapshotJson: longtext('snapshot_json').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payouts = mysqlTable('payouts', {
  id: int('id').autoincrement().primaryKey(),
  userId: int('user_id')
    .references(() => users.id)
    .notNull(),
  amount: double('amount').notNull(),
  payoutDate: varchar('payout_date', { length: 32 }).notNull(),
  paymentChannel: varchar('payment_channel', { length: 64 }).notNull().default('havale_eft'),
  referenceNo: varchar('reference_no', { length: 191 }).notNull().default(''),
  description: text('description').notNull(),
  createdByAdminId: int('created_by_admin_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  expenses: many(expenses),
  auditLogs: many(expenseAuditLogs),
  payouts: many(payouts),
}));

export const payoutsRelations = relations(payouts, ({ one }) => ({
  recipient: one(users, {
    fields: [payouts.userId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  author: one(users, {
    fields: [expenses.userId],
    references: [users.id],
  }),
}));

export const expenseAuditLogsRelations = relations(expenseAuditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [expenseAuditLogs.actorUserId],
    references: [users.id],
  }),
}));
