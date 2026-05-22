# WholesaleX Pro — B2B Wholesale E-commerce Platform

> **Live API Docs:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger/OpenAPI)
> **Frontend:** [http://localhost:3001](http://localhost:3001)
> **Backend:** [http://localhost:3000/api/v1](http://localhost:3000/api/v1)

---

## Overview

**WholesaleX Pro** is a full-stack B2B wholesale e-commerce platform designed for manufacturers, distributors, and bulk buyers. It features tier pricing, guest/user cart management, order lifecycle tracking, COD payments, product reviews, and role-based access control.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Backend** | NestJS 10, Prisma ORM, PostgreSQL |
| **Authentication** | JWT (localStorage) + Google OAuth 2.0 |
| **API Docs** | Swagger / OpenAPI 3.0 (auto-generated from decorators) |
| **Database** | PostgreSQL 18 |
| **Validation** | class-validator + class-transformer |

---

## Phase 1 — Core Commerce (Completed)

### Backend Modules (NestJS)

| Module | Endpoints | Auth | Key Features |
|--------|-----------|------|--------------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/google`, `POST /auth/verify-otp`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me` | Mixed | JWT + Google OAuth, OTP verification, password reset |
| **Users** | `POST /users`, `GET /users`, `GET /users/me`, `GET /users/:id`, `PATCH /users/me`, `PATCH /users/:id/role`, `PATCH /users/:id/status`, `DELETE /users/:id`, `GET /users/me/addresses`, `POST /users/me/addresses`, `PATCH /users/me/addresses/:id`, `DELETE /users/me/addresses/:id` | JWT + Roles | CRUD, role management, address book |
| **Products** | `GET /products`, `GET /products/:handle`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id` | Mixed | Search, filters, tier pricing, reviews embed |
| **Categories** | `GET /categories`, `GET /categories/:handle`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` | Mixed | Hierarchical tree, product counts |
| **Cart** | `GET /cart`, `POST /cart`, `PUT /cart`, `DELETE /cart` | Guest + JWT | Session-based guest cart, user cart, MOQ/inventory validation |
| **Orders** | `POST /orders`, `GET /orders`, `GET /orders/:id`, `PUT /orders/:id/status`, `PUT /orders/:id/cancel` | JWT | Place from cart, status lifecycle, cancel |
| **Payments** | `POST /payments`, `POST /payments/:orderId/verify` | JWT | COD payment records |
| **Reviews** | `GET /reviews`, `GET /reviews/:id`, `POST /reviews`, `DELETE /reviews/:id` | Mixed | Submit, list, delete, auto-rating update |

### Frontend Pages (Next.js)

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | Hero banner, category cards, quick links |
| **Products** | `/products` | Product grid with search, filters, MOQ badges |
| **Product Detail** | `/products/[handle]` | Tier pricing table, reviews, quantity selector, Add to Cart |
| **Category** | `/categories/[handle]` | Category header + filtered product grid |
| **Cart** | `/cart` | Guest/user cart, quantity update, remove, subtotal |
| **Checkout** | `/checkout` | Shipping address form, order summary, COD placement |
| **Orders** | `/orders` | Order list with status badges |
| **Order Detail** | `/orders/[id]` | Items list, shipping info, payment status, cancel |
| **Login** | `/login` | Email/password + Google Sign In |
| **Register** | `/register` | First/last name, email, phone, role selector, password |
| **Verify OTP** | `/verify-otp` | Email verification after registration |
| **Forgot Password** | `/forgot-password` | Request password reset link |
| **Reset Password** | `/reset-password` | Set new password with token |
| **Auth Callback** | `/auth/callback` | Captures Google OAuth token |

---

## Database Schema

### Core Models

```
User
  ├── id, email, password, firstName, lastName, phone, avatar
  ├── role (BUYER | VENDOR | DISTRIBUTOR | ADMIN)
  ├── status (ACTIVE | INACTIVE | PENDING_VERIFICATION | SUSPENDED)
  ├── accountType (LOCAL | GOOGLE), googleId
  ├── companyName, companyAddress, taxId
  └── Relations: OTP[], PasswordReset[], Cart?, Order[], Review[], LoyaltyAccount?, Address[]

Category
  ├── id, name, handle, description, image, isActive, rank, parentId?
  └── Relations: children[], products[]

Product
  ├── id, title, handle, description, sku, moq, unitPrice, compareAtPrice
  ├── status (DRAFT | PUBLISHED | ARCHIVED), inventoryQuantity
  ├── images[], thumbnail, vendorName, vendorId, rating, reviewCount, tags[]
  └── Relations: category?, tierPrices[], cartItems[], orderItems[], reviews[]

TierPrice
  ├── id, productId, minQty, maxQty?, price

Cart
  ├── id, userId?, sessionId?
  └── Relations: items[]

CartItem
  ├── id, cartId, productId, quantity, unitPrice

Order
  ├── id, orderNumber, userId, status, totalAmount, currency
  ├── shippingAddress, billingAddress, notes
  └── Relations: items[], payment?

OrderItem
  ├── id, orderId, productId, quantity, unitPrice, totalPrice

Payment
  ├── id, orderId, provider, providerRef?, amount, currency, status

Review
  ├── id, productId, userId, rating, title?, body?, isVerified, helpful, images[]

Address
  ├── id, label?, street, city, state, zip, country, isDefault

LoyaltyAccount
  ├── id, userId, points, tier, lifetimePoints, walletBalance
  └── Relations: transactions[]
```

### Enums

- **UserRole:** BUYER, VENDOR, DISTRIBUTOR, ADMIN
- **UserStatus:** ACTIVE, INACTIVE, PENDING_VERIFICATION, SUSPENDED
- **AccountType:** LOCAL, GOOGLE
- **ProductStatus:** DRAFT, PUBLISHED, ARCHIVED
- **OrderStatus:** PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
- **PaymentStatus:** PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED, CANCELLED

---

## Authentication & Authorization

### Auth Flow

1. **Registration** → `POST /auth/register` → Email OTP sent
2. **Verify OTP** → `POST /auth/verify-otp` → Account activated
3. **Login** → `POST /auth/login` → JWT `access_token` returned
4. **Google OAuth** → `GET /auth/google` → Callback to `/auth/callback?token=...`
5. **Token Usage** → `Authorization: Bearer <token>` on protected routes

### Role Permissions

| Role | Permissions |
|------|-------------|
| BUYER | Browse products, manage cart, place orders, write reviews, manage addresses |
| VENDOR | CRUD own products, update order status |
| DISTRIBUTOR | (Reserved for Phase 2) |
| ADMIN | Full access to all resources and user management |

---

## Key Features

### Tier Pricing
- Products have quantity-based price breaks (e.g., 10-49 units at 2400, 50-99 at 2200, 100+ at 2000)
- Frontend automatically highlights applicable tier based on selected quantity

### Guest Cart
- Unauthenticated users get a `cart_session` cookie/UUID
- Cart persists via `x-session-id` header or cookie
- On login, guest cart merges (Phase 2 enhancement)

### Order Lifecycle
```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   ↓
CANCELLED (buyer or admin)
```

### Reviews
- One review per product per authenticated buyer
- Auto-updates `product.rating` and `product.reviewCount` on create/delete

---

## Environment Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (running locally on port 5432)
- Git

### Backend `.env` (`apps/backend/.env`)

```env
DATABASE_URL="postgresql://postgres:Deepanshu@localhost:5432/wholesalex?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRATION="7d"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3000/api/v1/auth/google/callback"
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:3001"
ADMIN_URL="http://localhost:3002"
```

### Running Locally

```bash
# 1. Ensure PostgreSQL is running

# 2. Setup database
cd apps/backend
npx prisma migrate dev
npm run db:seed

# 3. Start backend (port 3000)
npm run start:dev

# 4. Start frontend (port 3001)
cd ../..
npm run dev
```

### Access Points

- **Frontend:** http://localhost:3001
- **API Base:** http://localhost:3000/api/v1
- **Swagger Docs:** http://localhost:3000/api/docs

---

## Seeded Test Data

After running `npm run db:seed`:

| Entity | Details |
|--------|---------|
| Admin | `admin@wholesalex.com` / `Admin@123` |
| Categories | Electronics (2 products), Fashion (1), Industrial (1) |
| Products | 4 products with tier pricing, SKUs, vendor names, ratings |

---

## Development Roadmap

### Phase 1 — Core Commerce (Complete)
Authentication, Users, Products, Categories, Cart, Orders, Payments, Reviews

### Phase 2 — Wholesale Features
- Contract / seasonal pricing
- RFQ (Request for Quote)
- Bulk CSV order upload
- Vendor dashboard
- Inventory management
- Digital catalogs

### Phase 3 — Engagement & Growth
- Loyalty program (points, tiers, cashback)
- Notifications (email, SMS, push)
- Analytics dashboard
- AI recommendations
- Multi-language support

---

## Project Structure

```
WholesaleX-Pro/
├── apps/
│   └── backend/
│       ├── prisma/
│       │   ├── schema.prisma       # Full database schema
│       │   ├── seed.ts             # Sample data seeder
│       │   └── migrations/         # Prisma migrations
│       └── src/
│           ├── auth/               # Auth module (JWT + OAuth)
│           ├── users/              # Users module (CRUD + addresses)
│           ├── products/           # Products module (catalog + tier pricing)
│           ├── categories/         # Categories module (tree structure)
│           ├── cart/               # Cart module (guest + user)
│           ├── orders/             # Orders module (lifecycle)
│           ├── payments/           # Payments module (COD)
│           ├── reviews/            # Reviews module (ratings)
│           ├── prisma/             # Prisma service
│           ├── common/             # Guards, decorators, DTOs
│           ├── main.ts             # App bootstrap + Swagger setup
│           └── app.module.ts       # Root module
├── src/
│   └── app/
│       ├── page.tsx                # Home page
│       ├── products/               # Product list + detail
│       ├── categories/             # Category pages
│       ├── cart/                   # Cart page
│       ├── checkout/               # Checkout page
│       ├── orders/                 # Orders list + detail
│       ├── login/                  # Login page
│       ├── register/               # Registration page
│       ├── forgot-password/        # Password reset request
│       ├── reset-password/         # New password form
│       ├── verify-otp/             # OTP verification
│       └── auth/callback/          # Google OAuth callback
├── plan.md/plan.md                 # Full PRD document
├── docs/README.md                  # Documentation index
├── next.config.mjs                 # Next.js config (API proxy)
└── README.md                       # This file
```

---

## API Documentation

All API endpoints are fully documented with Swagger/OpenAPI decorators. Each endpoint includes:
- Operation summary and description
- Request/response schemas
- Authentication requirements (Bearer token)
- Query parameters and path variables
- Role-based access control notes
- HTTP status codes and error responses

**Visit:** http://localhost:3000/api/docs

---

## Notes

- **Guest cart gap:** Backend supports `sessionId`, but frontend does not currently generate/persist one. This is the highest-priority Phase 1 gap.
- **Payments:** COD-only in Phase 1. Online gateways (Razorpay, PayU) are Phase 2.
- **Images:** Products currently use placeholder thumbnails. Full image upload is Phase 2.
- **Middleware:** No Next.js middleware for auth redirect; pages handle auth checks client-side.

---

## License

UNLICENSED — Private project
