import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { UsersService } from '../users/users.service';
import type { UserType } from '../db/constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: { id: string } }>();
    if (!request.user) throw new ForbiddenException('Unauthorized');

    const dbUser = await this.usersService.findById(request.user.id);
    if (!dbUser) throw new ForbiddenException('User not found');

    // superadmin passes all role checks
    if (dbUser.userType === 'superadmin') return true;

    if (!requiredRoles.includes(dbUser.userType as UserType)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
