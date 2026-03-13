import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  Req,
  UseGuards,
  NotFoundException,
  HttpCode,
  ParseIntPipe,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';
import type { UserType } from '../db/constants';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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
  async findAll(@Request() req: { user: { id: string } }) {
    const currentUser = await this.usersService.findById(req.user.id);
    if (!currentUser) return [];
    // superadmin always sees all branches; everyone else scoped to their branch
    const branchId =
      currentUser.userType === 'superadmin'
        ? undefined
        : currentUser.branchId ?? undefined;
    return this.usersService.findAll(branchId);
  }

  @Get('assignable')
  async findAssignable(@Request() req: { user: { id: string } }) {
    const currentUser = await this.usersService.findById(req.user.id);
    if (!currentUser) return [];
    // Non-superadmin with no branch → no access
    if (currentUser.userType !== 'superadmin' && !currentUser.branchId) return [];
    // Always filter by the user's own branchId if set — even superadmins
    // Superadmin without a branchId is the only case that sees all users across branches
    return this.usersService.findAssignable(currentUser.branchId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch(':id/profile')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  updateProfile(
    @Param('id') id: string,
    @Body() dto: UpdateUserProfileDto,
    @Req() req: AuthedRequest,
  ) {
    return this.usersService.updateProfile(id, dto, req.user?.id);
  }

  @Get(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  getDocuments(@Param('id') id: string) {
    return this.usersService.getDocuments(id);
  }

  @Post(':id/documents')
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  addDocument(
    @Param('id') id: string,
    @Body() body: { url: string; label?: string },
  ) {
    return this.usersService.addDocument(id, body.url, body.label);
  }

  @Delete(':id/documents/:docId')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles('admin', 'superadmin')
  removeDocument(
    @Param('id') id: string,
    @Param('docId', ParseIntPipe) docId: number,
  ) {
    return this.usersService.removeDocument(id, docId);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  updateRole(@Param('id') id: string, @Body() body: { userType: UserType }, @Req() req: AuthedRequest) {
    return this.usersService.updateUserType(id, body.userType, req.user?.id);
  }

  @Patch(':id/branch')
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  updateBranch(@Param('id') id: string, @Body() body: { branchId: number }, @Req() req: AuthedRequest) {
    return this.usersService.updateBranch(id, body.branchId, req.user?.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles('superadmin')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.usersService.remove(id, req.user?.id);
  }
}
