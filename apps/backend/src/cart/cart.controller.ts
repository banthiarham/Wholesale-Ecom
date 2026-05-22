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
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  private getSessionId(req: any): string {
    return req.cookies?.cart_session || req.headers['x-session-id'] || null;
  }

  @Get()
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
  async addItem(
    @Body() body: { productId: string; quantity: number; sessionId?: string; userId?: string },
    @Req() req: any,
  ) {
    const sessionId = body.sessionId || this.getSessionId(req);
    const cart = await this.cartService.addItem(
      body.productId,
      body.quantity,
      body.userId || undefined,
      sessionId || undefined,
    );
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Put()
  async updateItem(
    @Body() body: { itemId: string; quantity: number },
  ) {
    const cart = await this.cartService.updateItem(body.itemId, body.quantity);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }

  @Delete()
  async removeItem(
    @Body() body: { itemId: string },
  ) {
    const cart = await this.cartService.removeItem(body.itemId);
    const totals = this.cartService.calculateTotals(cart);
    return { cart, totals };
  }
}
