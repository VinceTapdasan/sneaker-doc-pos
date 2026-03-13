import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { DbModule } from '../db/db.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  // AuthModule re-exports SupabaseModule, so SupabaseService is available here
  imports: [DbModule, AuthModule, UsersModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
