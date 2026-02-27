-- Create branches table
CREATE TABLE IF NOT EXISTS "branches" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) UNIQUE NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add branch_id to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "branch_id" integer REFERENCES "branches"("id") ON DELETE SET NULL;

-- Add branch_id to transactions
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "branch_id" integer REFERENCES "branches"("id") ON DELETE SET NULL;

-- Add branch_id and audit_type to audit_log
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "branch_id" integer REFERENCES "branches"("id") ON DELETE SET NULL;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "audit_type" varchar(100);
