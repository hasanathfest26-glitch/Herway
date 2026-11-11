import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateLocationShareDto,
  PingLocationDto,
  UpdateShareStateDto,
} from './dto/locations.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post('shares')
  @UseGuards(JwtAuthGuard)
  createShare(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationShareDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.locationsService.createShare(user.id, dto, idempotencyKey);
  }

  @Get('shares')
  @UseGuards(JwtAuthGuard)
  listShares(@CurrentUser() user: AuthenticatedUser) {
    return this.locationsService.listShares(user.id);
  }

  @Post('ping')
  @UseGuards(JwtAuthGuard)
  ping(@CurrentUser() user: AuthenticatedUser, @Body() dto: PingLocationDto) {
    return this.locationsService.pingLocation(user.id, dto);
  }

  @Patch('shares/:id/state')
  @UseGuards(JwtAuthGuard)
  updateState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateShareStateDto,
  ) {
    return this.locationsService.updateShareState(user.id, id, dto);
  }

  @Get('public/:token')
  publicLookup(@Param('token') token: string) {
    return this.locationsService.getPublicShareByToken(token);
  }
}
