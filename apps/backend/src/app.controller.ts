import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiInfo() {
    return {
      name: 'WholesaleX Pro API',
      version: '1.0',
      status: 'running',
      documentation: '/api/docs',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/users',
        products: '/api/v1/products',
        categories: '/api/v1/categories',
        cart: '/api/v1/cart',
        orders: '/api/v1/orders',
        payments: '/api/v1/payments',
        reviews: '/api/v1/reviews',
        pricing: '/api/v1/pricing',
        inventory: '/api/v1/inventory',
        rfqs: '/api/v1/rfqs',
        vendor: '/api/v1/vendor',
        catalogs: '/api/v1/catalogs',
      },
    };
  }
}
