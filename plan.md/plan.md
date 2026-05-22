# PRD - Project Requirements Document

## 1. SYSTEM FLOW OVERVIEW

- **User Layer**
- **Authentication System**
- **Dashboard System**
- **Product Catalog**
- **Tier Pricing**
- **Loyalty Program**
- **Digital Catalogs**
- **Reviews & Ratings**
- **Cart & RFQ**
- **Orders**
- **Payments**
- **Delivery Tracking**
- **AI Recommendations**

---

## 2. RECOMMENDED REPOSITORY STRUCTURE

```
WholesaleX-Pro/
├── apps/
│   ├── frontend/
│   ├── admin-dashboard/
│   └── backend/
│       └── src/
│           └── modules/
│               ├── auth/
│               ├── users/
│               ├── products/
│               ├── catalogs/
│               ├── pricing/
│               ├── loyalty/
│               ├── reviews/
│               ├── cart/
│               ├── rfq/
│               ├── orders/
│               ├── payments/
│               ├── logistics/
│               ├── inventory/
│               ├── analytics/
│               ├── notifications/
│               └── vendors/
├── database/
├── queues/
├── workers/
├── events/
├── integrations/
├── shared/
│   ├── types/
│   ├── constants/
│   └── utils/
├── config/
└── docs/
    ├── PRD.md
    ├── TRD.md
    ├── API_FLOW.md
    ├── DATABASE_SCHEMA.md
    └── README.md
```

---

## 3. USER FLOW ARCHITECTURE

### A. Authentication Flow

1. User Visits Website
2. Authentication Page
   - Login
   - Register
   - OTP Verification
   - Google Login (use API)
   - Forgot Password
3. Role Assignment
   - Buyer
   - Vendor
   - Distributor
   - Admin
4. Dashboard Access

### B. Dashboard Flow

- Revenue Overview
- Orders Summary
- Loyalty Status
- Inventory Alerts
- Recommended Products
- RFQ Requests
- Analytics Widgets

### C. Product Catalog Flow

- **Product Catalog**
  - Categories
    - Electronics
    - Fashion
    - Industrial
    - Grocery
  - Product Search
    - Smart Search
    - Voice Search
    - AI Search
  - Product Filters
    - Price
    - MOQ
    - Vendor
    - Ratings
    - Availability
  - Product Cards
    - Product Image
    - SKU
    - MOQ
    - Tier Pricing
    - Rating
    - Stock Status
  - Product Details Page
    - Product Description
    - Technical Specifications
    - Product Images/Videos
    - 360 Viewer
    - Reviews & Ratings
    - Related Products
    - Vendor Information
    - Bulk Pricing Table
    - Delivery Estimates
    - Add to Cart / RFQ

### D. Tier Pricing Flow

- **Tier Pricing Engine**
  - Quantity Discounts
  - Seasonal Discounts
  - Coupon Discounts
  - Contract Pricing
  - Dynamic Pricing

### E. Loyalty Program Flow

- **Loyalty Program**
  - Reward Points
  - Cashback
  - Referral Program
  - Tier Upgrade System
  - Reward Redemption
  - Exclusive Discounts
  - Early Sale Access
  - Wallet Cashback
  - Achievement Badges

### F. Digital Catalog Flow

- **Digital Catalogs**
  - Interactive Catalogs
  - PDF Catalog Downloads
  - Vendor Catalogs
  - Seasonal Catalogs
  - Product Collections
  - Video Catalogs
  - Multi-language Catalogs
  - QR Catalog Sharing

### G. Reviews & Ratings Flow

- **Reviews Module**
  - Star Ratings
  - Buyer Reviews
  - Verified Purchase Badge
  - Image Reviews
  - Video Reviews
  - Helpful Votes
  - Product Q&A
  - AI Spam Detection

### H. Cart & RFQ Flow

- **Cart & RFQ System**
  - Add to Cart
  - Bulk Orders
  - CSV Upload Orders
  - Saved Order Templates
  - Request For Quote
  - Vendor Negotiation
  - Checkout

### I. Payment Flow

- **Payment System**
  - Razorpay
  - CC Avenue
  - PayU
  - Payment Verification
  - Invoice Generation
  - Refund Management
  - Fraud Detection

### J. Logistics Flow

- **Delivery & Logistics**
  - Warehouse Allocation
  - Shipping Partner APIs
  - Live Tracking
  - Delivery ETA
  - Shipping Notifications
  - Delivery Confirmation

---

## 4. DATABASE MODULE RELATION FLOW

- **Users** <-> Orders, Loyalty, Reviews, Wallet, RFQ
- **Products** <-> Categories, Pricing, Inventory, Reviews, Catalogs, Vendors
- **Orders** <-> Payments, Logistics, Invoices, Analytics

---

## 5. BACKEND SERVICE FLOW

```
Frontend Request
    |
    v
API Gateway
    |
    +-- Auth Service
    +-- Product Service
    +-- Pricing Service
    +-- Loyalty Service
    +-- RFQ Service
    +-- Payment Service
    +-- Logistics Service
    +-- Review Service
    +-- Analytics Service
```

---

## 6. AI-FRIENDLY DEVELOPMENT RULES

**Keep Every Module Independent**

Each module should contain:

```
/module-name
  controller
  service
  routes
  model
  repository
  validators
  dto
  events
  tests
```

---

## 7. DEVELOPMENT PRIORITY ORDER

### Phase 1 - Core Commerce

1. Authentication
2. Users
3. Products
4. Categories
5. Cart
6. Orders
7. Payments

### Phase 2 - Wholesale Features

8. Tier Pricing
9. RFQ
10. Bulk Orders
11. Vendor System
12. Inventory

### Phase 3 - Engagement Features

13. Loyalty
14. Reviews
15. Digital Catalogs
16. Notifications
