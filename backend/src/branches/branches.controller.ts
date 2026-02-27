import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Controller('branches')
@UseGuards(SupabaseAuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return active === '1'
      ? this.branchesService.findActive()
      : this.branchesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateBranchDto> & { isActive?: boolean },
  ) {
    return this.branchesService.update(id, dto);
  }
}
