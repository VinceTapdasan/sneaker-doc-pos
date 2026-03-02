import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';

@Module({
  imports: [DbModule, AuthModule, UsersModule],
  controllers: [DepositsController],
  providers: [DepositsService],
})
export class DepositsModule {}
