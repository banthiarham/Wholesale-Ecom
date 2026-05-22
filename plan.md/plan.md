# WholesaleX Pro — Project Plan & Requirements

> **Live API Documentation:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger/OpenAPI)

---

## 1. Project Overview

**WholesaleX Pro** is a B2B wholesale e-commerce platform built for manufacturers, distributors, and bulk buyers. It supports tier pricing, guest carts, order management, loyalty programs, and digital catalogs.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), Tailwind CSS, React |
| Backend | NestJS 10, Prisma ORM, PostgreSQL |
| Auth | JWT (localStorage) + Google OAuth 2.0 |
| API Docs | Swagger / OpenAPI 3.0 |

---

## 2. Phase 1 — Core Commerce (Current)

Phase 1 delivers the minimum viable B2B commerce experience.

### 2.1 Completed Modules

| Module | Status | Key Features |
|--------|--------|--------------|
| **Authentication** | Complete | Register, Login, OTP verification, Google OAuth, Forgot/Reset password, JWT Bearer tokens |
| **Users** | Complete | CRUD, role/status management, address book |
| **Products** | Complete | Catalog listing, detail page, search, filters, tier pricing, reviews embed |
| **Categories** | Complete | Hierarchical tree, product counts, handle-based routing |
| **Cart** | Complete | Guest session cart, user cart, add/update/remove, inventory/MOQ validation |
| **Orders** | Complete | Place from cart, status lifecycle, cancel, admin/vendor status updates |
| **Payments** | Complete | COD payment creation and verification |
| **Reviews** | Complete | Submit, list, delete, auto-update product rating |

### 2.2 Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Hero, category cards, quick links |
| Products | `/products` | Grid with search, filters, tier pricing badges |
| Product Detail | `/products/[handle]` | Images, tier table, reviews, quantity selector, Add to Cart |
| Category | `/categories/[handle]` | Category info + filtered product grid |
| Cart | `/cart` | Guest/user cart, quantity update, remove, totals |
| Checkout | `/checkout` | Shipping address, order summary, COD placement |
| Orders | `/orders` | List with status badges |
| Order Detail | `/orders/[id]` | Items, shipping, payment, cancel button |
| Login | `/login` | Email/password + Google Sign In |
| Register | `/register` | First/last name, email, phone, role, password |
| Verify OTP | `/verify-otp` | Email verification after registration |
| Forgot Password | `/forgot-password` | Email reset link request |
| Reset Password | `/reset-password` | New password with token |
| Auth Callback | `/auth/callback` | Google OAuth token capture |

### 2.3 API Endpoints (Swagger)

All endpoints are documented at `http://localhost:3000/api/docs` with:
- Request/response schemas
- Authentication requirements
- Query parameters and path variables
- Role-based access notes

**Base URL:** `http://localhost:3000/api/v1`

---

## 3. Database Schema

### 3.1 Core Models

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

LoyaltyTransaction
  ├── id, accountId, type, points, amount?, description?
```

### 3.2 Enums

- `UserRole`: BUYER, VENDOR, DISTRIBUTOR, ADMIN
- `UserStatus`: ACTIVE, INACTIVE, PENDING_VERIFICATION, SUSPENDED
- `AccountType`: LOCAL, GOOGLE
- `ProductStatus`: DRAFT, PUBLISHED, ARCHIVED
- `OrderStatus`: PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, REFUNDED
- `PaymentStatus`: PENDING, AUTHORIZED, CAPTURED, FAILED, REFUNDED, CANCELLED

---

## 4. Authentication & Authorization

### 4.1 Auth Flow

1. **Registration** → `POST /auth/register` → Email OTP sent
2. **Verify OTP** → `POST /auth/verify-otp` → Account activated
3. **Login** → `POST /auth/login` → JWT `access_token` returned
4. **Google OAuth** → `GET /auth/google` → Callback to `/auth/callback?token=...`
5. **Token Usage** → `Authorization: Bearer <token>` header on protected routes

### 4.2 Role Permissions

| Role | Permissions |
|------|-------------|
| BUYER | Browse, cart, orders, reviews, addresses |
| VENDOR | Product CRUD (own), order status updates |
| DISTRIBUTOR | (Phase 2) |
| ADMIN | Full access to all resources |

---

## 5. Feature Specifications

### 5.1 Tier Pricing

Products have quantity-based price breaks:
- `minQty` to `maxQty` → specific price
- `maxQty: null` → open-ended upper tier
- Frontend automatically highlights the applicable tier based on selected quantity

### 5.2 Guest Cart

- Unauthenticated users receive a `cart_session` cookie/UUID
- Cart persists across page reloads via `x-session-id` header or cookie
- On login, guest cart can be merged (Phase 2 enhancement)

### 5.3 Order Lifecycle

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
   ↓
CANCELLED (buyer or admin)
```

### 5.4 Reviews

- Authenticated buyers can submit one review per product
- Rating auto-averages update `product.rating` and `product.reviewCount`
- Reviews include star rating, title, body, and optional images (Phase 2)

---

## 6. Development Roadmap

### Phase 1 — Core Commerce ✅
Authentication, Users, Products, Categories, Cart, Orders, Payments, Reviews

### Phase 2 — Wholesale Features
- Tier Pricing engine enhancements (contract pricing, seasonal discounts)
- RFQ (Request for Quote) system
- Bulk order CSV upload
- Vendor dashboard and inventory management
- Digital catalogs and PDF generation

### Phase 3 — Engagement & Growth
- Loyalty program (points, tiers, cashback)
- Notifications (email, SMS, push)
- Analytics dashboard
- AI product recommendations
- Multi-language support

---

## 7. Environment Setup

### Backend `.env`

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
# 1. PostgreSQL must be running (Windows Service: postgresql-x64-18)
# 2. Backend
cd apps/backend
npx prisma migrate dev
npm run db:seed
npm run start:dev      # http://localhost:3000

# 3. Frontend
cd ../..
npm run dev            # http://localhost:3001
```

### API Docs

```
http://localhost:3000/api/docs
```

---

## 8. Repository Structure

```
WholesaleX-Pro/
├── apps/
│   └── backend/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/
│       └── src/
│           ├── auth/
│           ├── users/
│           ├── products/
│           ├── categories/
│           ├── cart/
│           ├── orders/
│           ├── payments/
│           ├── reviews/
│           ├── prisma/
│           ├── common/
│           │   ├── decorators/
│           │   └── guards/
│           ├── main.ts
│           └── app.module.ts
├── src/
│   └── app/
│       ├── page.tsx
│       ├── products/
│       ├── categories/
│       ├── cart/
│       ├── checkout/
│       ├── orders/
│       ├── login/
│       ├── register/
│       ├── forgot-password/
│       ├── reset-password/
│       ├── verify-otp/
│       └── auth/callback/
├── next.config.mjs
├── tailwind.config.ts
└── plan.md
```

---

## 9. Seeded Test Data

After running `npm run db:seed`:

| Entity | Details |
|--------|---------|
| Admin | `admin@wholesalex.com` / `Admin@123` |
| Categories | Electronics (2 products), Fashion (1), Industrial (1) |
| Products | 4 products with tier pricing, SKUs, vendor names |

---

## 10. Notes & Decisions

- **Guest cart:** Backend supports `sessionId`, but frontend currently does not generate/persist one. This is the highest-priority Phase 1 gap.
- **Payments:** COD-only in Phase 1. Online gateways (Razorpay, PayU) are Phase 2.
- **Images:** Products use placeholder thumbnails. Full image upload is Phase 2.
- **Middleware:** No Next.js middleware for auth redirect; pages handle auth checks client-side.
