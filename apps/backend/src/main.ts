import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3001',
      process.env.ADMIN_URL || 'http://localhost:3002',
    ],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('WholesaleX Pro API')
    .setDescription(
      'B2B Wholesale E-commerce Platform API — Phase 1\n\n' +
      'This API powers the WholesaleX Pro platform, a B2B wholesale e-commerce solution with tier pricing, guest/user carts, order management, and COD payments.\n\n' +
      '**Phase 1 Modules:** Authentication, Users, Products, Categories, Cart, Orders, Payments, Reviews\n\n' +
      '**Features:**\n' +
      '- JWT + Google OAuth authentication\n' +
      '- Role-based access control (Buyer, Vendor, Distributor, Admin)\n' +
      '- Product catalog with search, filters, and tier pricing\n' +
      '- Guest & user cart management\n' +
      '- Order lifecycle (Pending → Confirmed → Processing → Shipped → Delivered)\n' +
      '- COD payment flow\n' +
      '- Product reviews with auto-calculated ratings\n\n' +
      '**Project Plan:** See plan.md for full requirements, database schema, and development roadmap.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
