import { Module } from '@nestjs/common';
import { HomeSectionsController } from './home-sections.controller';
import { HomeSectionsService } from './home-sections.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [HomeSectionsController],
  providers: [HomeSectionsService],
  exports: [HomeSectionsService],
})
export class HomeSectionsModule {}