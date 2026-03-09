-- deposits: add origin field to track where bank deposits came from (default gcash)
ALTER TABLE "deposits" ADD COLUMN IF NOT EXISTS "origin" varchar(50) DEFAULT 'gcash';
