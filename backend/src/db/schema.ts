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
  bigint,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// branches
// ---------------------------------------------------------------------------
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  streetName: varchar('street_name', { length: 500 }),
  barangay: varchar('barangay', { length: 255 }),
  city: varchar('city', { length: 255 }),
  province: varchar('province', { length: 255 }),
  country: varchar('country', { length: 100 }),
  phone: varchar('phone', { length: 50 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
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
  price: bigint('price', { mode: 'number' }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
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
  createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
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
  total: bigint('total', { mode: 'number' }).default(0).notNull(),
  paid: bigint('paid', { mode: 'number' }).default(0).notNull(),
  promoId: integer('promo_id').references(() => promos.id, {
    onDelete: 'set null',
  }),
  branchId: integer('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  staffId: uuid('staff_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }), // auto-set when status transitions to 'claimed'
  deletedAt: timestamp('deleted_at', { withTimezone: true }), // soft delete — null = active
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
  price: bigint('price', { mode: 'number' }), // snapshot of service price at time of intake
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
  amount: bigint('amount', { mode: 'number' }).notNull(),
  referenceNumber: varchar('reference_number', { length: 100 }),
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
  method: varchar('method', { length: 50 }), // cash | gcash | card | bank_deposit
  source: varchar('source', { length: 20 }).default('pos').notNull(), // pos | admin
  amount: bigint('amount', { mode: 'number' }).notNull(),
  staffId: uuid('staff_id').references(() => users.id, { onDelete: 'set null' }), // null = admin expense
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
  streetName: varchar('street_name', { length: 500 }),
  barangay: varchar('barangay', { length: 255 }),
  city: varchar('city', { length: 255 }),
  province: varchar('province', { length: 255 }),
  country: varchar('country', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// deposits (tracks manual bank deposit amounts per method per month)
// ---------------------------------------------------------------------------
export const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  year: integer('year').notNull(),
  month: integer('month').notNull(), // 1-12; 0 = annual (unused in practice)
  method: varchar('method', { length: 50 }).notNull(), // cash | gcash | card | bank_deposit
  amount: bigint('amount', { mode: 'number' }).default(0).notNull(),
  origin: varchar('origin', { length: 50 }).default('gcash'), // source of bank_deposit funds
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// users (mirrors auth.users for role management)
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches auth.users.id
  email: varchar('email', { length: 255 }).notNull(),
  nickname: varchar('nickname', { length: 100 }),
  fullName: varchar('full_name', { length: 255 }),
  contactNumber: varchar('contact_number', { length: 50 }),
  birthday: date('birthday'),
  address: varchar('address', { length: 500 }),
  emergencyContactName: varchar('emergency_contact_name', { length: 255 }),
  emergencyContactNumber: varchar('emergency_contact_number', { length: 50 }),
  userType: varchar('user_type', { length: 20 }).default('staff').notNull(), // admin | staff | superadmin
  branchId: integer('branch_id').references(() => branches.id, {
    onDelete: 'set null',
  }),
  isActive: boolean('is_active').default(true).notNull(),
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
// transaction_photos (transaction-level photo dump — before/after)
// ---------------------------------------------------------------------------
export const transactionPhotos = pgTable('transaction_photos', {
  id: serial('id').primaryKey(),
  transactionId: integer('transaction_id')
    .references(() => transactions.id, { onDelete: 'cascade' })
    .notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'before' | 'after'
  url: text('url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// staff_documents
// ---------------------------------------------------------------------------
export const staffDocuments = pgTable('staff_documents', {
  id: serial('id').primaryKey(),
  staffId: uuid('staff_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  url: varchar('url', { length: 1000 }).notNull(),
  label: varchar('label', { length: 255 }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
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
    photos: many(transactionPhotos),
  }),
);

export const transactionPhotosRelations = relations(transactionPhotos, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionPhotos.transactionId],
    references: [transactions.id],
  }),
}));

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
