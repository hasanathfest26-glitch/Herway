import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReviewVerificationDto, SubmitVerificationDto } from './dto/verification.dto';
import { VerificationService } from './verification.service';

@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('apply')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'selfie', maxCount: 1 },
      { name: 'idDocument', maxCount: 1 },
    ]),
  )
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitVerificationDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
    @UploadedFiles()
    files?: {
      selfie?: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>;
      idDocument?: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>;
    },
  ) {
    return this.verificationService.apply(user.id, dto, files, idempotencyKey);
  }

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationService.listMine(user.id);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  pending() {
    return this.verificationService.listPendingForAdmin();
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  adminAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.verificationService.listAllForAdmin({
      status,
      search,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  review(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.review(admin.id, id, dto);
  }
}
