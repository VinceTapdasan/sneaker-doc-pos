import { Controller, Get, Patch, Body, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DepositsService } from './deposits.service';
import { UsersService } from '../users/users.service';

@Controller('deposits')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'superadmin')
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly usersService: UsersService,
  ) {}

  // superadmin always sees all (or filtered by query branchId); everyone else scoped to their branch
  private async scopedBranchId(userId: string, queryBranchId?: string): Promise<number | undefined> {
    const user = await this.usersService.findById(userId);
    if (!user) return undefined;
    if (user.userType === 'superadmin') {
      return queryBranchId ? parseInt(queryBranchId, 10) : undefined;
    }
    return user.branchId ?? undefined;
  }

  @Get('audit')
  async findDepositAudit(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('branchId') branchId?: string,
    @Query('method') method?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.depositsService.findDepositAudit(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
      method || undefined,
    );
  }

  @Get()
  async findByMonth(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.depositsService.findByMonth(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
    );
  }

  @Patch()
  async upsert(
    @Body() body: { year: number; month: number; method: string; amount: string; branchId?: number; origin?: string },
    @Req() req: AuthedRequest,
  ) {
    // Require origin when depositing via bank_deposit
    if (body.method === 'bank_deposit' && !body.origin) {
      throw new BadRequestException('origin is required when method is bank_deposit');
    }

    const user = await this.usersService.findById(req.user.id);

    let effectiveBranchId: number | undefined;

    if (user?.userType === 'superadmin') {
      // Superadmin can deposit to any branch via body.branchId, or their own if set
      effectiveBranchId = body.branchId ?? user.branchId ?? undefined;
    } else {
      if (!user?.branchId) {
        throw new ForbiddenException('You must be assigned to a branch before recording deposits. Please complete onboarding first.');
      }
      if (body.branchId && body.branchId !== user.branchId) {
        throw new ForbiddenException('You can only record deposits for your own branch.');
      }
      effectiveBranchId = user.branchId;
    }

    // All deposits MUST be associated with a branch — no orphan deposits
    if (!effectiveBranchId) {
      throw new ForbiddenException('A branch must be selected to record deposits. Please complete onboarding or specify a branch.');
    }

    return this.depositsService.upsert(
      body.year,
      body.month,
      body.method,
      body.amount,
      effectiveBranchId,
      req.user?.id,
      body.origin,
    );
  }
}
