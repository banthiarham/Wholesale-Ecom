import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private addressesService: AddressesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user's addresses" })
  async findAll(@CurrentUser() user: any) {
    const addresses = await this.addressesService.findByUser(user.userId);
    return { addresses };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new address' })
  async create(
    @CurrentUser() user: any,
    @Body() body: { label?: string; street: string; city: string; state: string; zip: string; country?: string; isDefault?: boolean },
  ) {
    const address = await this.addressesService.create(user.userId, body);
    return { address };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an address' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() body: { label?: string; street?: string; city?: string; state?: string; zip?: string; country?: string; isDefault?: boolean },
  ) {
    const address = await this.addressesService.update(id, user.userId, body);
    return { address };
  }

  @Put(':id/default')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set address as default' })
  async setDefault(@Param('id') id: string, @CurrentUser() user: any) {
    const address = await this.addressesService.setDefault(id, user.userId);
    return { address };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an address' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    await this.addressesService.delete(id, user.userId);
    return { success: true };
  }
}