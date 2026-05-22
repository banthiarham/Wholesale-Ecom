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
      '# WholesaleX Pro — B2B Wholesale E-commerce API\n\n' +
      'This API powers the **WholesaleX Pro** platform, a full-stack B2B wholesale e-commerce solution built with **NestJS + Prisma + PostgreSQL**.\n\n' +
      '## Phase 1 Modules (Current)\n\n' +
      '- **Authentication** — JWT + Google OAuth, OTP verification, forgot/reset password\n' +
      '- **Users** — CRUD, role/status management, address book\n' +
      '- **Products** — Catalog with search, filters, tier pricing, reviews\n' +
      '- **Categories** — Hierarchical tree with product counts\n' +
      '- **Cart** — Guest session cart + authenticated user cart\n' +
      '- **Orders** — Full lifecycle: Pending → Confirmed → Processing → Shipped → Delivered\n' +
      '- **Payments** — COD payment records and verification\n' +
      '- **Reviews** — Submit, list, delete with auto-calculated product ratings\n\n' +
      '## Authentication\n\n' +
      '1. Register → `POST /auth/register`\n' +
      '2. Verify OTP → `POST /auth/verify-otp`\n' +
      '3. Login → `POST /auth/login` (returns JWT token)\n' +
      '4. Use token → `Authorization: Bearer <token>`\n\n' +
      '## Role-Based Access\n\n' +
      '| Role | Permissions |\n' +
      '|------|-------------|\n' +
      '| BUYER | Browse, cart, orders, reviews, addresses |\n' +
      '| VENDOR | Product CRUD (own), order status updates |\n' +
      '| ADMIN | Full access to all resources |\n\n' +
      '## Documentation\n\n' +
      '- **Project README:** See `README.md` in the repository root for full setup, architecture, and roadmap.\n' +
      '- **PRD / Plan:** See `plan.md/plan.md` for detailed requirements and development phases.\n' +
      '- **Docs Index:** See `docs/README.md` for quick navigation.',
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
