import { Module } from '@nestjs/common';
import { RoleRequestsController } from './role-requests.controller';
import { RoleRequestsService } from './role-requests.service';

@Module({
  controllers: [RoleRequestsController],
  providers: [RoleRequestsService],
  exports: [RoleRequestsService],
})
export class RoleRequestsModule {}