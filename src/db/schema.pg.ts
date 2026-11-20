import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('calisan'), // 'admin' | 'ortak' | 'calisan'
  department: text('department').notNull().default('Genel'),
  phone: text('phone').notNull().default(''),
  iban: text('iban').notNull().default(''),
  passwordHash: text('password_hash'),
  monthlyBudgetLimit: doublePrecision('monthly_budget_limit').notNull().default(15000),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const companySettings = pgTable('company_settings', {
  id: serial('id').primaryKey(),
  companyName: text('company_name').notNull().default('Anadolu Kurumsal A.Ş.'),
  shortName: text('short_name').notNull().default('MasrafPro'),
  taxNumber: text('tax_number').notNull().default(''),
  taxOffice: text('tax_office').notNull().default(''),
  logoDataUrl: text('logo_data_url'),
  pwaIconDataUrl: text('pwa_icon_data_url'),
  monthlyCompanyBudget: doublePrecision('monthly_company_budget').notNull().default(120000),
  requireReceiptAboveAmount: doublePrecision('require_receipt_above_amount').notNull().default(500),
  setupCompleted: boolean('setup_completed').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  merchant: text('merchant').notNull(),
  merchantTaxId: text('merchant_tax_id').notNull().default(''),
  receiptNumber: text('receipt_number').notNull().default(''),
  documentType: text('document_type').notNull().default('fis'),
  category: text('category').notNull(),
  accountCode: text('account_code').notNull().default('770'),
  costCenter: text('cost_center').notNull().default('Merkez'),
  paymentMethod: text('payment_method').notNull().default('kisisel_kart'),
  amount: doublePrecision('amount').notNull(),
  vatRate: integer('vat_rate').notNull().default(0),
  vatAmount: doublePrecision('vat_amount').notNull().default(0),
  netAmount: doublePrecision('net_amount').notNull().default(0),
  currency: text('currency').notNull().default('TRY'),
  expenseDate: text('expense_date').notNull(),
  description: text('description').notNull().default(''),
  receiptImageDataUrl: text('receipt_image_data_url'),
  voiceNoteDataUrl: text('voice_note_data_url'),
  voiceTranscript: text('voice_transcript').notNull().default(''),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  locationAccuracy: doublePrecision('location_accuracy'),
  status: text('status').notNull().default('onaylandi'),
  rejectionReason: text('rejection_reason').notNull().default(''),
  reviewedByUserId: integer('reviewed_by_user_id'),
  reviewedAt: timestamp('reviewed_at'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  deletedAt: timestamp('deleted_at'),
  deletedByUserId: integer('deleted_by_user_id'),
  deleteReason: text('delete_reason').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
});

export const expenseAuditLogs = pgTable('expense_audit_logs', {
  id: serial('id').primaryKey(),
  expenseId: integer('expense_id').notNull(),
  action: text('action').notNull(),
  actorUserId: integer('actor_user_id')
    .references(() => users.id)
    .notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  ownerUserId: integer('owner_user_id').notNull(),
  ownerName: text('owner_name').notNull(),
  merchant: text('merchant').notNull(),
  amount: doublePrecision('amount').notNull(),
  expenseDate: text('expense_date').notNull(),
  reason: text('reason').notNull().default(''),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  snapshotJson: text('snapshot_json').notNull().default('{}'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id)
    .notNull(),
  amount: doublePrecision('amount').notNull(),
  payoutDate: text('payout_date').notNull(),
  paymentChannel: text('payment_channel').notNull().default('havale_eft'),
  referenceNo: text('reference_no').notNull().default(''),
  description: text('description').notNull().default(''),
  createdByAdminId: integer('created_by_admin_id')
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
