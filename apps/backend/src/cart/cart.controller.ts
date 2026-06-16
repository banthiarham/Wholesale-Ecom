import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Req,
  Headers,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiHeader, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveCartItemDto } from './dto/remove-cart-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private getSessionId(req: any): string {
    return req.cookies?.cart_session || req.headers['x-session-id'] || null;
  }

  /**
   * Extract userId from JWT if authenticated, otherwise fall back to header/body.
   */
  private resolveUserId(req: any, dtoUserId?: string): string | undefined {
    // Priority: JWT auth user > header/body userId
    if (req.user?.id) return req.user.id;
    if (dtoUserId) return dtoUserId;
    return undefined;
  }

  /**
   * Extract the user's effective role from the JWT user object.
   */
  private resolveUserRole(req: any): string | undefined {
    if (!req.user) return undefined;
    return req.user.effectiveRole || req.user.roleRel?.name || req.user.role;
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get or create guest/user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved with totals' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest cart session identifier' })
  async getCart(@Req() req: any) {
    const sessionId = this.getSessionId(req);
    const userId = this.resolveUserId(req);
    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId || undefined,
    );
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Add a product to the cart (guest or authenticated)' })
  @ApiResponse({ status: 200, description: 'Item added to cart' })
  @ApiResponse({ status: 400, description: 'Invalid quantity, product not available, insufficient inventory, or rule violation' })
  @ApiBody({ type: AddCartItemDto })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest cart session identifier' })
  @ApiBearerAuth()
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: any,
  ) {
    const sessionId = dto.sessionId || this.getSessionId(req);
    const resolvedUserId = this.resolveUserId(req, dto.userId);
    const userRole = this.resolveUserRole(req);
    const cart = await this.cartService.addItem(
      dto.productId,
      dto.quantity,
      resolvedUserId,
      sessionId || undefined,
      (dto as any).packageGroupId,
      (dto as any).packageMetadata,
      userRole,
    );
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Put()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Update quantity of a cart item (guest or authenticated)' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({ status: 400, description: 'Invalid quantity, insufficient inventory, or rule violation' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest cart session identifier' })
  @ApiBearerAuth()
  async updateItem(@Body() dto: UpdateCartItemDto, @Req() req: any) {
    const userRole = this.resolveUserRole(req);
    const cart = await this.cartService.updateItem(dto.itemId, dto.quantity, undefined, userRole);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Remove an item from the cart (guest or authenticated)' })
  @ApiResponse({ status: 200, description: 'Item removed from cart' })
  @ApiBody({ type: RemoveCartItemDto })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest cart session identifier' })
  @ApiBearerAuth()
  async removeItem(@Body() dto: RemoveCartItemDto) {
    const cart = await this.cartService.removeItem(dto.itemId);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Post('coupon')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Validate a coupon against current cart subtotal' })
  @ApiResponse({ status: 200, description: 'Coupon validation result' })
  @ApiBody({ schema: { type: 'object', properties: { code: { type: 'string' } } } })
  async validateCoupon(
    @Body('code') code: string,
    @Req() req: any,
  ) {
    const sessionId = this.getSessionId(req);
    const userId = this.resolveUserId(req);
    const cart = await this.cartService.getOrCreateCart(
      userId,
      sessionId || undefined,
    );
    return this.cartService.validateCoupon(cart, code);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart items into authenticated user cart' })
  @ApiResponse({ status: 200, description: 'Carts merged successfully' })
  @ApiBody({ schema: { type: 'object', properties: { sessionId: { type: 'string' }, userId: { type: 'string' } } } })
  async mergeCart(
    @Body('sessionId') sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.cartService.mergeGuestCart(sessionId, userId);
    return { cart: result, message: 'Cart merged successfully' };
  }
}