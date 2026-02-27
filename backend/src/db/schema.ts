import {
  pgTable,
  serial,
  uuid,
  text,
  varchar,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// branches
// ---------------------------------------------------------------------------
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'primary' | 'add_on'
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// promos
// ---------------------------------------------------------------------------
export const promos = pgTable('promos', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 100 }).unique().notNull(),
  percent: numeric('percent', { precision: 5, scale: 2 }).notNull(),
  dateFrom: date('date_from'),
  dateTo: date('date_to'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 10 }).unique().notNull(), // zero-padded e.g. "0001"
  customerName: varchar('customer_name', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | in_progress | done | claimed | cancelled
  note: varchar('note', { length: 1000 }),
  pickupDate: date('pickup_date'),
  newPickupDate: date('new_pickup_date'),
  total: numeric('total', { precision: 10, scale: 2 }).default('0').notNull(),
  paid: numeric('paid', { precision: 10, scale: 2 }).default('0').notNull(),
  promoId: integer('promo_id').references(() => promos.id, {
    onDelete: 'set null',
  }),
  branchId: integer('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }), // auto-set when status transitions to 'claimed'
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// transaction_items
// ---------------------------------------------------------------------------
export const transactionItems = pgTable('transaction_items', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull(),
  shoeDescription: varchar('shoe_description', { length: 255 }),
  serviceId: integer('service_id').references(() => services.id, {
    onDelete: 'set null',
  }),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | in_progress | done | claimed | cancelled
  beforeImageUrl: text('before_image_url'),
  afterImageUrl: text('after_image_url'),
  price: numeric('price', { precision: 10, scale: 2 }), // snapshot of service price at time of intake
  addonServiceIds: jsonb('addon_service_ids').$type<number[]>(), // snapshot of add-on service IDs at time of intake
});

// ---------------------------------------------------------------------------
// claim_payments
// ---------------------------------------------------------------------------
export const claimPayments = pgTable('claim_payments', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull(),
  method: varchar('method', { length: 50 }).notNull(), // cash | gcash | card | bank_deposit
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// expenses
// ---------------------------------------------------------------------------
export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  dateKey: date('date_key').notNull(),
  category: varchar('category', { length: 100 }),
  note: varchar('note', { length: 500 }),
  source: varchar('source', { length: 20 }).default('pos').notNull(), // pos | admin
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 50 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// users (mirrors auth.users for role management)
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches auth.users.id
  email: varchar('email', { length: 255 }).notNull(),
  userType: varchar('user_type', { length: 20 }).default('staff').notNull(), // admin | staff | superadmin
  branchId: integer('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// audit_log
// ---------------------------------------------------------------------------
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  action: varchar('action', { length: 100 }).notNull(), // create | update | delete | status_change | payment_add
  auditType: varchar('audit_type', { length: 100 }), // see AUDIT_TYPE constants
  entityType: varchar('entity_type', { length: 50 }).notNull(), // transaction | service | promo | expense
  entityId: varchar('entity_id', { length: 50 }),
  source: varchar('source', { length: 50 }), // pos | admin
  performedBy: uuid('performed_by'), // references auth.users (no FK constraint — Supabase auth schema)
  branchId: integer('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  details: jsonb('details'),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    promo: one(promos, {
      fields: [transactions.promoId],
      references: [promos.id],
    }),
    items: many(transactionItems),
    payments: many(claimPayments),
  }),
);

export const transactionItemsRelations = relations(
  transactionItems,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionItems.transactionId],
      references: [transactions.id],
    }),
    service: one(services, {
      fields: [transactionItems.serviceId],
      references: [services.id],
    }),
  }),
);

export const claimPaymentsRelations = relations(claimPayments, ({ one }) => ({
  transaction: one(transactions, {
    fields: [claimPayments.transactionId],
    references: [transactions.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  transactionItems: many(transactionItems),
}));

export const promosRelations = relations(promos, ({ many }) => ({
  transactions: many(transactions),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ one }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
}));
