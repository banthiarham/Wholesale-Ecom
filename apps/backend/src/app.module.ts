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
import { LoyaltyModule } from './loyalty/loyalty.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ReturnsModule } from './returns/returns.module';
import { AddressesModule } from './addresses/addresses.module';
import { PaymentGatewaysModule } from './payment-gateways/payment-gateways.module';
import { SettingsModule } from './settings/settings.module';
import { DeliveryPartnersModule } from './delivery-partners/delivery-partners.module';
import { RolesModule } from './roles/roles.module';
import { RolePricesModule } from './role-prices/role-prices.module';
import { RoleRequestsModule } from './role-requests/role-requests.module';
import { RulesModule } from './rules/rules.module';
import { WalletModule } from './wallet/wallet.module';
import { BannersModule } from './banners/banners.module';
import { HomeSectionsModule } from './home-sections/home-sections.module';
import { BulkOrdersModule } from './bulk-orders/bulk-orders.module';
import { PackagesModule } from './packages/packages.module';

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
    LoyaltyModule,
    NotificationsModule,
    AnalyticsModule,
    RecommendationsModule,
    WishlistModule,
    ReturnsModule,
    AddressesModule,
    PaymentGatewaysModule,
    SettingsModule,
    DeliveryPartnersModule,
    RolesModule,
    RolePricesModule,
    RoleRequestsModule,
    RulesModule,
    WalletModule,
    BannersModule,
    HomeSectionsModule,
    BulkOrdersModule,
    PackagesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}