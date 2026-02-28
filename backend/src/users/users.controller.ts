import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import type { UserType } from '../db/constants';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new NotFoundException('User record not found');
    return user;
  }

  @Post('provision')
  async provision(@Request() req: { user: { id: string; email?: string } }) {
    return this.usersService.findOrCreate(req.user.id, req.user.email ?? '');
  }

  @Patch('me/onboard')
  async onboard(
    @Request() req: { user: { id: string } },
    @Body() body: { branchId: number },
  ) {
    return this.usersService.onboard(req.user.id, body.branchId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  findAll() {
    return this.usersService.findAll();
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  updateRole(@Param('id') id: string, @Body() body: { userType: UserType }) {
    return this.usersService.updateUserType(id, body.userType);
  }
}
