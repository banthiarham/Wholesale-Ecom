# WholesaleX Pro - Authentication Backend

## Setup

### 1. Install dependencies
```bash
cd apps/backend
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your database and OAuth credentials
```

### 3. Setup database
```bash
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
```

### 4. Run the server
```bash
npm run start:dev
```

Server runs at `http://localhost:3000/api/v1`  
Swagger docs at `http://localhost:3000/api/docs`

## Auth Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new account |
| POST | `/api/v1/auth/login` | Login with email/password |
| GET | `/api/v1/auth/google` | Google OAuth login |
| GET | `/api/v1/auth/google/callback` | Google OAuth callback |
| POST | `/api/v1/auth/verify-otp` | Verify email OTP |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |
| GET | `/api/v1/auth/me` | Get current user (requires Bearer token) |

## Role-Based Access

Roles: `BUYER`, `VENDOR`, `DISTRIBUTOR`, `ADMIN`

Use `@Roles(UserRole.ADMIN)` and `@UseGuards(JwtAuthGuard, RolesGuard)` to protect admin-only routes.
