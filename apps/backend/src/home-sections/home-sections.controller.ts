import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { HomeSectionsService } from './home-sections.service';
import { CreateHomeSectionDto } from './dto/create-home-section.dto';
import { UpdateHomeSectionDto } from './dto/update-home-section.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('home-sections')
export class HomeSectionsController {
  constructor(private readonly homeSectionsService: HomeSectionsService) {}

  @Get()
  findActive() {
    return this.homeSectionsService.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  findAll() {
    return this.homeSectionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.homeSectionsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateHomeSectionDto) {
    return this.homeSectionsService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateHomeSectionDto) {
    return this.homeSectionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.homeSectionsService.remove(id);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  reorder(@Body() body: { ids: string[] }) {
    return this.homeSectionsService.reorder(body.ids);
  }
}