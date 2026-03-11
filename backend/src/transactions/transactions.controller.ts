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
  UseGuards,
  Req,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { TransactionsService } from './transactions.service';
import { UsersService } from '../users/users.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { AddPhotoDto } from './dto/add-photo.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(
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
    return user.branchId ?? undefined;
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
  findByNumber(@Param('number') number: string) {
    return this.transactionsService.findByNumber(number);
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionsService.findOne(id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post()
  create(@Body() dto: CreateTransactionDto, @Req() req: AuthedRequest) {
    return this.transactionsService.create(dto, 'pos', req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transactionsService.update(id, dto, 'pos', req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transactionsService.updateItem(id, itemId, dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/payments')
  addPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
    @Req() req: AuthedRequest,
  ) {
    return this.transactionsService.addPayment(id, dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/sms/pickup-ready')
  sendPickupReadySms(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.transactionsService.sendPickupReadySms(id, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post(':id/photos')
  addPhoto(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddPhotoDto,
  ) {
    return this.transactionsService.addPhoto(id, dto);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id/photos/:photoId')
  removePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId', ParseIntPipe) photoId: number,
  ) {
    return this.transactionsService.removePhoto(id, photoId);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Patch(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.transactionsService.restore(id, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.transactionsService.remove(id, req.user?.id);
  }
}
