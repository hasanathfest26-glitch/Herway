import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, DocumentsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
