import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { ReportsService } from './reports.service';
import { UsersService } from '../users/users.service';

@Controller('reports')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService,
  ) {}

  // superadmin sees all (optionally filtered by query branchId); admin scoped to own branch
  private async scopedBranchId(userId: string, queryBranchId?: string): Promise<number | undefined> {
    const user = await this.usersService.findById(userId);
    if (!user) return undefined;
    if (user.userType === 'superadmin') {
      return queryBranchId ? parseInt(queryBranchId, 10) : undefined;
    }
    return user.branchId ?? undefined;
  }

  @Get('summary')
  async getSummary(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.reportsService.getSummary(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
    );
  }
}
