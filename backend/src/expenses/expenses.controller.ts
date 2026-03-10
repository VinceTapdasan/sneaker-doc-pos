import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { ExpensesService } from './expenses.service';
import { UsersService } from '../users/users.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly usersService: UsersService,
  ) {}

  // superadmin always sees all; everyone else is scoped to their branch
  private scopedBranchId(dbUser: Record<string, unknown> | null | undefined): number | undefined {
    if (!dbUser) return undefined;
    if (dbUser['userType'] === 'superadmin') return undefined;
    return (dbUser['branchId'] as number | null | undefined) ?? undefined;
  }

  // Requires auth — financial data must not be public
  @UseGuards(SupabaseAuthGuard)
  @Get()
  async findByDate(@Query('date') date: string, @Req() req: AuthedRequest) {
    const dbUser = await this.usersService.findById(req.user.id) as { userType: string; branchId?: number | null } | null;
    const isStaff = dbUser?.userType === 'staff';
    const branchId = this.scopedBranchId(dbUser);
    return this.expensesService.findByDate(date, isStaff ? req.user.id : undefined, isStaff ? undefined : branchId);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('summary')
  async summary(@Query('date') date: string, @Req() req: AuthedRequest) {
    const dbUser = await this.usersService.findById(req.user.id) as { userType: string; branchId?: number | null } | null;
    const isStaff = dbUser?.userType === 'staff';
    const branchId = this.scopedBranchId(dbUser);
    return this.expensesService.summary(date, isStaff ? req.user.id : undefined, isStaff ? undefined : branchId);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Get('monthly')
  async findByMonth(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const dbUser = await this.usersService.findById(req.user.id);
    const branchId = this.scopedBranchId(dbUser);
    return this.expensesService.findByMonth(
      parseInt(year, 10),
      parseInt(month, 10),
      branchId,
    );
  }

  // Any authenticated user can log an expense (staff via POS)
  @UseGuards(SupabaseAuthGuard)
  @Post()
  async create(@Body() dto: CreateExpenseDto, @Req() req: AuthedRequest) {
    const dbUser = await this.usersService.findById(req.user.id);
    const branchId = dbUser?.branchId ?? undefined;
    return this.expensesService.create(dto, 'pos', req.user?.id, branchId);
  }

  // Admin-only: edit or delete existing expenses
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
    @Req() req: AuthedRequest,
  ) {
    const dbUser = await this.usersService.findById(req.user.id);
    const branchId = dbUser?.branchId ?? undefined;
    return this.expensesService.update(id, dto, req.user?.id, branchId);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const dbUser = await this.usersService.findById(req.user.id);
    const branchId = dbUser?.branchId ?? undefined;
    return this.expensesService.remove(id, req.user?.id, branchId);
  }
}
