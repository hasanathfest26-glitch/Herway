import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DiscoverPeopleQueryDto, UpsertBuddyProfileDto } from './dto/buddies.dto';
import { BuddiesService } from './buddies.service';

@Controller('buddies')
@UseGuards(JwtAuthGuard)
export class BuddiesController {
  constructor(private readonly buddiesService: BuddiesService) {}

  @Get('discover/travellers')
  discoverTravellers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DiscoverPeopleQueryDto,
  ) {
    return this.buddiesService.discoverNearbyTravellers(user.id, query);
  }

  @Get('discover/buddies')
  discoverBuddies(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DiscoverPeopleQueryDto,
  ) {
    return this.buddiesService.discoverNearbyBuddies(user.id, query);
  }

  @Put('profile')
  upsertProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertBuddyProfileDto) {
    return this.buddiesService.upsertBuddyProfile(user.id, dto);
  }

  @Get(':userId')
  getBuddy(@Param('userId') userId: string) {
    return this.buddiesService.getBuddyPublicProfile(userId);
  }
}
