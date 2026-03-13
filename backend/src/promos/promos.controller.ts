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
import { PromosService } from './promos.service';
import { CreatePromoDto } from './dto/create-promo.dto';
import { UpdatePromoDto } from './dto/update-promo.dto';

@Controller('promos')
@UseGuards(SupabaseAuthGuard)
export class PromosController {
  constructor(private readonly promosService: PromosService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.promosService.findAll(active === '1' || active === 'true');
  }

  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.promosService.findByCode(code);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.promosService.findOne(id);
  }

  // Admin-only mutations
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Post()
  create(@Body() dto: CreatePromoDto, @Req() req: AuthedRequest) {
    return this.promosService.create(dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromoDto,
    @Req() req: AuthedRequest,
  ) {
    return this.promosService.update(id, dto, req.user?.id);
  }

  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.promosService.remove(id, req.user?.id);
  }
}
