import { Module } from '@nestjs/common';
import { SafeHavensController } from './safe-havens.controller';
import { SafeHavensService } from './safe-havens.service';

@Module({
  controllers: [SafeHavensController],
  providers: [SafeHavensService],
  exports: [SafeHavensService],
})
export class SafeHavensModule {}
