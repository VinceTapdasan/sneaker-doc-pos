import { Controller, Post, Body, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/auth.guard';
import type { AuthedRequest } from '../auth/auth.types';
import { UploadsService } from './uploads.service';
import { UsersService } from '../users/users.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('presigned-url')
  async createPresignedUrl(@Body() dto: PresignedUrlDto, @Req() req: AuthedRequest) {
    // Verify user has branch-level access to the transaction they're uploading for
    const user = await this.usersService.findById(req.user.id);
    if (user && user.userType !== 'superadmin') {
      const txnBranchId = await this.uploadsService.getTransactionBranchId(dto.txnId);
      if (txnBranchId !== null && user.branchId !== null && txnBranchId !== user.branchId) {
        throw new ForbiddenException('You do not have access to upload files for this transaction.');
      }
    }
    return this.uploadsService.createPresignedUrl(dto);
  }
}
