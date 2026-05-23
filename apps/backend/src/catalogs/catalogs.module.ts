import { Module } from '@nestjs/common';
import { CatalogsController } from './catalogs.controller';
import { CatalogsService } from './catalogs.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  controllers: [CatalogsController],
  providers: [CatalogsService, PdfGeneratorService],
  exports: [CatalogsService, PdfGeneratorService],
})
export class CatalogsModule {}
