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
  Headers,
  UseGuards,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { TransactionsService } from './transactions.service';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AddPhotoDto } from './dto/add-photo.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly config: ConfigService,
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  // superadmin always sees all (optionally filtered by query branchId); everyone else scoped to their branch
  private async scopedBranchId(userId: string, queryBranchId?: string): Promise<number | undefined> {
    const user = await this.usersService.findById(userId);
    if (!user) return undefined;
    if (user.userType === 'superadmin') {
      return queryBranchId ? parseInt(queryBranchId, 10) : undefined;
    }
    // Non-superadmin must be assigned to a branch — null branchId means incomplete onboarding
    if (user.branchId == null) {
      throw new ForbiddenException('Your account is not yet assigned to a branch. Please contact your administrator.');
    }
    return user.branchId;
  }

  // Verify the calling user has branch-level access to a specific transaction.
  // Superadmin bypasses; everyone else must belong to the transaction's branch.
  private async verifyBranchAccess(userId: string, txnBranchId: number | null): Promise<void> {
    const branch = await this.scopedBranchId(userId);
    if (branch === undefined) return; // superadmin — no restriction
    if (txnBranchId !== null && txnBranchId !== branch) {
      throw new ForbiddenException('You do not have access to this transaction.');
    }
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.transactionsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      status: status || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      branchId: branch,
    });
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('recent')
  async findRecent(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    const branch = await this.scopedBranchId(req.user.id);
    return this.transactionsService.findRecent(
      limit ? parseInt(limit, 10) : 10,
      branch,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('upcoming')
  async findUpcoming(@Req() req: AuthedRequest) {
    const branch = await this.scopedBranchId(req.user.id);
    return this.transactionsService.findUpcoming(branch);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('upcoming/monthly')
  async findUpcomingByMonth(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id);
    return this.transactionsService.findUpcomingByMonth(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('today-collections')
  async todayCollections(@Req() req: AuthedRequest) {
    const branch = await this.scopedBranchId(req.user.id);
    return this.transactionsService.todayCollections(branch);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('dashboard')
  async dashboardSummary(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.transactionsService.dashboardSummary(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('collections/history')
  async collectionsHistory(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('method') method: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.transactionsService.collectionsHistory(
      parseInt(year, 10),
      parseInt(month, 10),
      method,
      branch,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('collections/summary')
  async collectionsSummary(
    @Req() req: AuthedRequest,
    @Query('year') year: string,
    @Query('month') month: string,
    @Query('branchId') branchId?: string,
  ) {
    const branch = await this.scopedBranchId(req.user.id, branchId);
    return this.transactionsService.collectionsSummary(
      parseInt(year, 10),
      parseInt(month, 10),
      branch,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('number/:number')
  async findByNumber(@Param('number') number: string, @Req() req: AuthedRequest) {
    const txn = await this.transactionsService.findByNumber(number);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return txn;
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Get('deleted')
  async findDeleted(@Req() req: AuthedRequest) {
    const branch = await this.scopedBranchId(req.user.id);
    return this.transactionsService.findDeleted(branch);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return txn;
  }

  @UseGuards(SupabaseAuthGuard)
  @Post()
  async create(@Body() dto: CreateTransactionDto, @Req() req: AuthedRequest) {
    // Require branch assignment before creating transactions
    const user = await this.usersService.findById(req.user.id);
    if (!user?.branchId) {
      throw new ForbiddenException('You must be assigned to a branch before creating transactions. Please complete onboarding first.');
    }
    return this.transactionsService.create(dto, 'pos', req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.update(id, dto, 'pos', req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':id/items/:itemId')
  async updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.updateItem(id, itemId, dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/payments')
  async addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.addPayment(id, dto, req.user?.id);
  }

  /**
   * Superadmin-only: correct an existing payment's method (and optionally reference number).
   * Amount is never changed. Safe for cash/gcash/card changes — reports update automatically.
   * Changes involving bank_deposit require manual deposit record reconciliation (surfaced
   * in the response via `bankDepositWarning` flag).
   */
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('superadmin')
  @Patch(':id/payments/:paymentId/method')
  async updatePaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Body() dto: UpdatePaymentMethodDto,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    const result = await this.transactionsService.updatePaymentMethod(id, paymentId, dto, req.user?.id);
    // Surface the bank_deposit warning to the caller so the frontend can show it
    const bankDepositWarning =
      (txn.payments?.find((p) => p.id === paymentId)?.method === 'bank_deposit') ||
      dto.method === 'bank_deposit';
    return { ...result, bankDepositWarning };
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/sms/pickup-ready')
  async sendPickupReadySms(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.sendPickupReadySms(id, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/photos')
  async addPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPhotoDto,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.addPhoto(id, dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id/photos/:photoId')
  async removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
    @Req() req: AuthedRequest,
  ) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.removePhoto(id, photoId);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Patch(':id/restore')
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    // Restore loads from deleted set — verify branch via scopedBranchId
    const branch = await this.scopedBranchId(req.user.id);
    // Branch check is done inside service (restore fetches by id + deletedAt IS NOT NULL)
    return this.transactionsService.restore(id, req.user?.id, branch);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    const txn = await this.transactionsService.findOne(id);
    await this.verifyBranchAccess(req.user.id, txn.branchId);
    return this.transactionsService.remove(id, req.user?.id);
  }

  // Called by Cloud Scheduler — no Supabase auth, uses CRON_SECRET header
  @Post('purge-deleted')
  async purgeDeleted(@Headers('x-cron-secret') cronSecret: string) {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || cronSecret !== expected) {
      throw new UnauthorizedException('Invalid cron secret');
    }
    return this.transactionsService.purgeOldDeleted();
  }
}
