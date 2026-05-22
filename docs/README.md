# WholesaleX Pro — Documentation Index

## Quick Links

| Resource | Location | Description |
|----------|----------|-------------|
| **Main README** | [`../README.md`](../README.md) | Full project overview, tech stack, setup guide |
| **API Docs (Swagger)** | http://localhost:3000/api/docs | Interactive API documentation with all endpoints |
| **PRD / Plan** | [`../plan.md/plan.md`](../plan.md/plan.md) | Product Requirements Document with full system flow |

---

## Documentation Sections

### 1. API Reference

The Swagger UI at `http://localhost:3000/api/docs` provides:
- **Authentication** — JWT + Google OAuth endpoints
- **Users** — User CRUD, role management, address book
- **Products** — Catalog listing, search, filters, tier pricing
- **Categories** — Hierarchical category tree
- **Cart** — Guest and authenticated cart operations
- **Orders** — Order placement, status tracking, cancellation
- **Payments** — COD payment records
- **Reviews** — Product reviews with auto-calculated ratings

Each endpoint includes:
- Operation summaries and descriptions
- Request/response DTO schemas
- Query parameters and path variables
- Authentication requirements (`ApiBearerAuth`)
- Role-based access notes
- HTTP status codes

### 2. Database Schema

See `apps/backend/prisma/schema.prisma` for the complete Prisma schema definition.

**Key Models:**
- `User` — accounts, roles, statuses, OAuth linkage
- `Product` — catalog items with tier pricing
- `Category` — hierarchical product categories
- `Cart` / `CartItem` — guest and user shopping carts
- `Order` / `OrderItem` — order lifecycle management
- `Payment` — transaction records
- `Review` — product ratings and feedback
- `Address` — user shipping/billing addresses
- `LoyaltyAccount` / `LoyaltyTransaction` — points and rewards

### 3. Authentication Flow

1. `POST /auth/register` — create account
2. `POST /auth/verify-otp` — verify email with OTP
3. `POST /auth/login` — obtain JWT token
4. `GET /auth/google` — initiate Google OAuth
5. `GET /auth/me` — get current user (protected)

Token usage: `Authorization: Bearer <token>`

### 4. Role-Based Access

| Role | Capabilities |
|------|--------------|
| BUYER | Browse, cart, orders, reviews, addresses |
| VENDOR | Product CRUD (own), order status updates |
| ADMIN | Full system access |

---

## Development Phases

### Phase 1 — Core Commerce (Complete)
Auth, Users, Products, Categories, Cart, Orders, Payments, Reviews

### Phase 2 — Wholesale Features
Tier pricing engine, RFQ, bulk orders, vendor dashboard, inventory, digital catalogs

### Phase 3 — Engagement
Loyalty program, notifications, analytics, AI recommendations, multi-language

---

## Setup Commands

```bash
# Database
cd apps/backend
npx prisma migrate dev
npm run db:seed

# Backend
npm run start:dev

# Frontend
cd ../..
npm run dev
```

---

## Environment Variables

See [`apps/backend/.env.example`](../apps/backend/.env.example) for required backend environment variables.
