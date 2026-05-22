import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Req,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiHeader } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { RemoveCartItemDto } from './dto/remove-cart-item.dto';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private getSessionId(req: any): string {
    return req.cookies?.cart_session || req.headers['x-session-id'] || null;
  }

  @Get()
  @ApiOperation({ summary: 'Get or create guest/user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved with totals' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Guest cart session identifier' })
  @ApiHeader({ name: 'x-user-id', required: false, description: 'User ID for authenticated cart' })
  async getCart(@Req() req: any, @Headers('x-user-id') userId?: string) {
    const sessionId = this.getSessionId(req);
    const cart = await this.cartService.getOrCreateCart(
      userId || undefined,
      sessionId || undefined,
    );
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Post()
  @ApiOperation({ summary: 'Add a product to the cart' })
  @ApiResponse({ status: 200, description: 'Item added to cart' })
  @ApiResponse({ status: 400, description: 'Invalid quantity, product not available, or insufficient inventory' })
  @ApiBody({ type: AddCartItemDto })
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: any,
  ) {
    const sessionId = dto.sessionId || this.getSessionId(req);
    const cart = await this.cartService.addItem(
      dto.productId,
      dto.quantity,
      dto.userId || undefined,
      sessionId || undefined,
    );
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Put()
  @ApiOperation({ summary: 'Update quantity of a cart item' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({ status: 400, description: 'Invalid quantity or insufficient inventory' })
  @ApiBody({ type: UpdateCartItemDto })
  async updateItem(@Body() dto: UpdateCartItemDto) {
    const cart = await this.cartService.updateItem(dto.itemId, dto.quantity);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Delete()
  @ApiOperation({ summary: 'Remove an item from the cart' })
  @ApiResponse({ status: 200, description: 'Item removed from cart' })
  @ApiBody({ type: RemoveCartItemDto })
  async removeItem(@Body() dto: RemoveCartItemDto) {
    const cart = await this.cartService.removeItem(dto.itemId);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }
}
