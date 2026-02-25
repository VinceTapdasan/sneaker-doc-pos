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
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findByDate(@Query('date') date: string) {
    return this.expensesService.findByDate(date);
  }

  @Get('summary')
  summary(@Query('date') date: string) {
    return this.expensesService.summary(date);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('monthly')
  findByMonth(@Query('year') year: string, @Query('month') month: string) {
    return this.expensesService.findByMonth(
      parseInt(year, 10),
      parseInt(month, 10),
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: any) {
    return this.expensesService.create(dto, 'pos', req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExpenseDto,
    @Req() req: any,
  ) {
    return this.expensesService.update(id, dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.expensesService.remove(id, req.user?.id);
  }
}
