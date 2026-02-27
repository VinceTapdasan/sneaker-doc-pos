import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { EmailModule } from './email/email.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { PromosModule } from './promos/promos.module';
import { ExpensesModule } from './expenses/expenses.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CustomersModule } from './customers/customers.module';
import { BranchesModule } from './branches/branches.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    SupabaseModule,
    AuthModule,
    AuditModule,
    EmailModule,
    UsersModule,
    ServicesModule,
    PromosModule,
    ExpensesModule,
    TransactionsModule,
    CustomersModule,
    BranchesModule,
  ],
})
export class AppModule {}
