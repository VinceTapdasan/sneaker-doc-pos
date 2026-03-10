import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { AuditService } from './audit.service';
import { UsersService } from '../users/users.service';

@Controller('audit')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('limit') limit?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('performedBy') performedBy?: string,
  ) {
    const currentUser = await this.usersService.findById(req.user.id);
    // superadmin sees all; admin sees only their branch
    const branchId =
      currentUser?.userType === 'superadmin'
        ? undefined
        : currentUser?.branchId ?? undefined;

    return this.auditService.findAll({
      limit: limit ? parseInt(limit, 10) : 200,
      month: month ? parseInt(month, 10) : undefined,
      year: year ? parseInt(year, 10) : undefined,
      performedBy,
      branchId,
    });
  }
}
