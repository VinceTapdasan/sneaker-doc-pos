import { Controller, Get, Patch, Body, Request, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(SupabaseAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: { user: { id: string; email?: string } }) {
    return this.usersService.findOrCreate(req.user.id, req.user.email ?? '');
  }

  @Patch('me/onboard')
  async onboard(
    @Request() req: { user: { id: string } },
    @Body() body: { branchId: number },
  ) {
    return this.usersService.onboard(req.user.id, body.branchId);
  }
}
