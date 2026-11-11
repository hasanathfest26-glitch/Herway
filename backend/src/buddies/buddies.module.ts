import { Module } from '@nestjs/common';
import { BuddiesController } from './buddies.controller';
import { BuddiesService } from './buddies.service';

@Module({
  controllers: [BuddiesController],
  providers: [BuddiesService],
  exports: [BuddiesService],
})
export class BuddiesModule {}
