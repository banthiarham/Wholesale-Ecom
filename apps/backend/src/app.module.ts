import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PricingModule } from './pricing/pricing.module';
import { InventoryModule } from './inventory/inventory.module';
import { RfqsModule } from './rfqs/rfqs.module';
import { VendorModule } from './vendor/vendor.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReturnsModule } from './returns/returns.module';
import { AddressesModule } from './addresses/addresses.module';
import { SettingsModule } from './settings/settings.module';
import { DeliveryPartnersModule } from './delivery-partners/delivery-partners.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    PricingModule,
    InventoryModule,
    RfqsModule,
    VendorModule,
    CatalogsModule,
    LoyaltyModule,
    NotificationsModule,
    AnalyticsModule,
    RecommendationsModule,
    WishlistModule,
    ReturnsModule,
    AddressesModule,
    SettingsModule,
    DeliveryPartnersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
