-- transaction_photos: transaction-level photo dump (before/after), replaces per-item photos
CREATE TABLE IF NOT EXISTS "transaction_photos" (
  "id" serial PRIMARY KEY NOT NULL,
  "transaction_id" integer NOT NULL,
  "type" varchar(20) NOT NULL,
  "url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "transaction_photos_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE cascade ON UPDATE no action
);
