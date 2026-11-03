import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersBulkService } from './users-bulk.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersBulkService],
  exports: [UsersService],
})
export class UsersModule {}
