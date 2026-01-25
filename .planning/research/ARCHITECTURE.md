# Architecture Research: B2B Dealer Order Management System

**Domain:** B2B Dealer Order Management
**Researched:** 2026-01-25
**Project Scale:** ~500 products, ~700 dealers, 20-30 orders/day
**Tech Stack:** Node.js backend, React Native mobile, React web

## Executive Summary

For a B2B dealer order management system at this scale (20-30 orders/day, 700 dealers), a **modular monolith architecture** is strongly recommended over microservices. This provides faster time-to-market, lower operational complexity, and easier debugging while maintaining clear module boundaries for future scalability. The architecture should use REST APIs for simplicity, PostgreSQL for transactional data integrity, and JWT-based authentication for dealers.

**Confidence:** HIGH (based on multiple authoritative sources and consistent 2026 industry recommendations)

---

## Recommended Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                       │
│  ┌──────────────────────┐   ┌──────────────────────┐       │
│  │   React Web Admin    │   │  React Native Mobile │       │
│  │   (Dealer Portal)    │   │   (Dealer Orders)    │       │
│  └──────────┬───────────┘   └──────────┬───────────┘       │
└─────────────┼──────────────────────────┼───────────────────┘
              │                          │
              │    REST API (JSON)       │
              └──────────┬───────────────┘
                         │
┌────────────────────────┼────────────────────────────────────┐
│                  Node.js Backend                             │
│                 (Modular Monolith)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              API Layer (Express.js)                   │  │
│  │  - Authentication Middleware (JWT)                    │  │
│  │  - Request Validation                                 │  │
│  │  - Error Handling                                     │  │
│  └───────────────┬──────────────────────────────────────┘  │
│                  │                                          │
│  ┌───────────────┴──────────────────────────────────────┐  │
│  │            Business Logic Modules                     │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │  │
│  │  │  Auth    │ │ Products │ │ Dealers  │ │ Orders  │ │  │
│  │  │  Module  │ │  Module  │ │  Module  │ │ Module  │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │ Pricing  │ │  Files   │ │  Notif   │             │  │
│  │  │  Module  │ │  Module  │ │  Module  │             │  │
│  │  └──────────┘ └──────────┘ └──────────┘             │  │
│  └───────────────┬──────────────────────────────────────┘  │
│                  │                                          │
│  ┌───────────────┴──────────────────────────────────────┐  │
│  │              Data Access Layer                        │  │
│  │  - Repository Pattern                                 │  │
│  │  - Database Queries                                   │  │
│  └───────────────┬──────────────────────────────────────┘  │
└──────────────────┼──────────────────────────────────────────┘
                   │
┌──────────────────┼──────────────────────────────────────────┐
│               External Services                              │
│  ┌──────────────┴───────┐  ┌────────────┐  ┌────────────┐  │
│  │    PostgreSQL DB     │  │    FCM     │  │  Cloudinary│  │
│  │  (Primary Storage)   │  │ (Push Notif)│  │  (Images) │  │
│  └──────────────────────┘  └────────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Why Modular Monolith?

**Industry consensus for 2026:** Start with a modular monolith for systems at this scale. According to recent surveys, 42% of organizations that initially adopted microservices have consolidated back to larger deployable units due to operational complexity.

**Benefits for this project:**
- **Faster development:** 2-3x faster to market than microservices for small teams
- **Lower operational cost:** Single deployment, simpler infrastructure
- **Easier debugging:** End-to-end tracing without distributed system complexity
- **Natural evolution path:** Clear module boundaries make future extraction to microservices straightforward if needed

**When to reconsider:** If order volume exceeds 500/day or team grows beyond 10 developers working independently.

---

## Component Boundaries

### Module Structure

Each module follows the same internal structure:

```
src/modules/
├── auth/
│   ├── controllers/     # HTTP request handlers
│   ├── services/        # Business logic
│   ├── repositories/    # Data access
│   ├── validators/      # Input validation
│   └── index.ts        # Module exports
├── products/
├── dealers/
├── orders/
├── pricing/
├── files/
└── notifications/
```

### Module Responsibilities

| Module | Responsibility | Exposed Interface | Dependencies |
|--------|---------------|-------------------|--------------|
| **Auth** | JWT token generation/validation, dealer login, session management | `login()`, `validateToken()`, `refreshToken()` | None |
| **Dealers** | Dealer registration, profile management, group assignment | `getDealer()`, `updateDealer()`, `getDealerGroup()` | Auth |
| **Products** | Product CRUD, catalog browsing, search | `getProducts()`, `getProductById()`, `searchProducts()` | Files |
| **Pricing** | Calculate dealer-specific prices based on group discounts | `getPrice()`, `calculateOrderTotal()` | Dealers, Products |
| **Orders** | Order creation, state management, order history | `createOrder()`, `updateOrderState()`, `getOrders()` | Dealers, Products, Pricing, Notifications |
| **Files** | Image/file upload, storage, retrieval | `uploadFile()`, `getFileUrl()`, `deleteFile()` | None |
| **Notifications** | Push notifications via FCM | `sendNotification()`, `sendBulkNotifications()` | Dealers |

### Inter-Module Communication

**Event-Driven Pattern (Recommended):**
- Modules communicate via internal event emitter for loose coupling
- Example: Order module emits `order.statusChanged` event, Notification module subscribes

```typescript
// In Order Service
eventBus.emit('order.statusChanged', {
  orderId: '123',
  dealerId: '456',
  newStatus: 'Shipped',
  oldStatus: 'Preparing'
});

// In Notification Service
eventBus.on('order.statusChanged', async (event) => {
  await sendPushNotification(event.dealerId, event.newStatus);
});
```

**Direct Function Calls (When Synchronous Required):**
- For operations requiring immediate response (e.g., pricing calculation during order creation)
- Always go through service layer, never direct repository access

---

## Data Model

### Core Entities and Relationships

```
┌──────────────┐         ┌──────────────┐
│   Dealers    │─────────│ DealerGroups │
│              │ N     1 │              │
│ id           │         │ id           │
│ name         │         │ name         │
│ email        │         │ discount_%   │
│ phone        │         │              │
│ group_id     │         └──────────────┘
│ fcm_token    │
│ created_at   │
└──────┬───────┘
       │
       │ 1
       │
       │ N
┌──────┴───────┐         ┌──────────────┐
│   Orders     │─────────│  OrderItems  │
│              │ 1     N │              │
│ id           │         │ id           │
│ dealer_id    │         │ order_id     │
│ total_amount │         │ product_id   │
│ status       │         │ quantity     │
│ created_at   │         │ unit_price   │
│ updated_at   │         │ discount_%   │
└──────────────┘         │ subtotal     │
                         └───────┬──────┘
                                 │
                                 │ N
                                 │
                                 │ 1
                         ┌───────┴──────┐
                         │   Products   │
                         │              │
                         │ id           │
                         │ name         │
                         │ description  │
                         │ base_price   │
                         │ image_url    │
                         │ stock_qty    │
                         │ created_at   │
                         └──────────────┘
```

### Database Schema Patterns

**Normalization vs Denormalization:**
- **Normalize transactional data** (Dealers, Orders, OrderItems) up to 3NF for data integrity
- **Denormalize for read performance** where appropriate:
  - Store `total_amount` in Orders table (calculated field)
  - Store `unit_price` and `discount_%` in OrderItems (snapshot at order time)
  - This prevents recalculation and preserves historical pricing

**Dealer Group Pricing Model:**

```sql
CREATE TABLE dealer_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dealers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  dealer_group_id INTEGER REFERENCES dealer_groups(id),
  fcm_token VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500),
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  dealer_id INTEGER REFERENCES dealers(id) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  total_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_state_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by VARCHAR(100),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

**Indexing Strategy:**

```sql
-- Authentication lookups
CREATE INDEX idx_dealers_email ON dealers(email);

-- Order queries by dealer
CREATE INDEX idx_orders_dealer_id ON orders(dealer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items lookup
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Product search
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_is_active ON products(is_active);
```

---

## API Design

### REST vs GraphQL Decision

**Recommendation: REST API**

**Rationale:**
- **93% of teams continue using REST in 2026** for good reason: simplicity, standardization, mature ecosystem
- **2-3x faster to implement** than GraphQL for small teams
- **Easier caching** with standard HTTP caching mechanisms
- **Lower learning curve** for frontend developers
- **Predictable performance** - no N+1 query problems to debug

**When GraphQL makes sense:**
- Complex UI requirements pulling from multiple entities
- Mobile bandwidth optimization critical
- Frequent schema changes

**For this project:** REST is ideal because data structures are stable (products, dealers, orders), queries are relatively simple, and team velocity is more important than query flexibility.

### API Structure

**Base URL:** `/api/v1`

**Versioning:** Include version in URL path for clear breaking change management

**Key Endpoints:**

```
Authentication:
POST   /api/v1/auth/login                    # Dealer login
POST   /api/v1/auth/refresh                  # Refresh JWT token
POST   /api/v1/auth/logout                   # Invalidate token

Dealers:
GET    /api/v1/dealers/me                    # Current dealer profile
PUT    /api/v1/dealers/me                    # Update profile
GET    /api/v1/dealers/me/group              # Get dealer group info

Products:
GET    /api/v1/products                      # List products (with pagination)
GET    /api/v1/products/:id                  # Get product details
GET    /api/v1/products/search?q=keyword     # Search products

Orders:
GET    /api/v1/orders                        # List dealer's orders
GET    /api/v1/orders/:id                    # Get order details
POST   /api/v1/orders                        # Create new order
GET    /api/v1/orders/:id/history            # Order state history

Pricing:
POST   /api/v1/pricing/calculate             # Calculate prices for cart

Files:
POST   /api/v1/files/upload                  # Upload image/file
GET    /api/v1/files/:id                     # Get file URL

Notifications:
POST   /api/v1/notifications/register-token  # Register FCM token
```

### API Response Format

**Success Response:**

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Product Name",
    "price": 100.00
  },
  "meta": {
    "timestamp": "2026-01-25T10:00:00Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-01-25T10:00:00Z"
  }
}
```

**Pagination:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

### API Best Practices

1. **Use nouns, not verbs** in endpoints (`/products`, not `/getProducts`)
2. **Use HTTP methods semantically** (GET for reads, POST for creates, PUT for updates, DELETE for deletes)
3. **Return proper HTTP status codes** (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Internal Server Error)
4. **Accept and return JSON** with `Content-Type: application/json`
5. **Implement pagination** for list endpoints (default: 20 items per page)
6. **Filter and search** via query parameters (`?status=Pending&page=2`)
7. **Rate limiting** to prevent abuse (e.g., 100 requests per minute per dealer)

---

## Authentication Flow

### JWT-Based Authentication

**Why JWT for B2B Dealer Portal:**
- **Stateless:** No server-side session storage, scales horizontally
- **Performance:** No database lookup for every request
- **Multi-device support:** Dealers can use web and mobile simultaneously
- **Standard:** Works seamlessly with React and React Native

### Authentication Architecture

```
┌─────────────┐                                    ┌─────────────┐
│   Client    │                                    │   Backend   │
│ (Mobile/Web)│                                    │  (Node.js)  │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. POST /api/v1/auth/login                      │
       │    { email, password }                          │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                              2. Validate dealer │
       │                              3. Generate JWT    │
       │                                                  │
       │ 4. Return tokens                                │
       │    { accessToken, refreshToken }                │
       │<────────────────────────────────────────────────┤
       │                                                  │
       │ 5. Store tokens (secure storage)                │
       │                                                  │
       │ 6. API Request with token                       │
       │    Headers: Authorization: Bearer <accessToken> │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                              7. Verify JWT      │
       │                              8. Extract dealer  │
       │                              9. Process request │
       │                                                  │
       │ 10. Return response                             │
       │<────────────────────────────────────────────────┤
```

### Token Structure

**Access Token (JWT):**
- **Expiration:** 15 minutes (security best practice)
- **Storage:** React Native - secure storage, Web - httpOnly cookie
- **Payload:**

```json
{
  "sub": "dealer_id_123",
  "email": "dealer@example.com",
  "dealerGroupId": "group_5",
  "iat": 1706180400,
  "exp": 1706181300
}
```

**Refresh Token:**
- **Expiration:** 7 days
- **Storage:** Same as access token
- **Purpose:** Renew access token without re-login

### Security Best Practices

1. **Short-lived access tokens** (15 minutes) to limit damage if compromised
2. **HTTP-only cookies** for web (prevents XSS attacks)
3. **Secure storage** on mobile (React Native Keychain/Encrypted Storage)
4. **Token rotation** - issue new refresh token on each refresh
5. **Logout invalidation** - maintain refresh token blacklist in Redis
6. **HTTPS only** in production
7. **Password hashing** with bcrypt (minimum 10 rounds)

### Implementation Example

```typescript
// Auth Service
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

class AuthService {
  async login(email: string, password: string) {
    // 1. Find dealer
    const dealer = await dealerRepository.findByEmail(email);
    if (!dealer) throw new UnauthorizedError('Invalid credentials');

    // 2. Verify password
    const isValid = await bcrypt.compare(password, dealer.password_hash);
    if (!isValid) throw new UnauthorizedError('Invalid credentials');

    // 3. Generate tokens
    const accessToken = jwt.sign(
      {
        sub: dealer.id,
        email: dealer.email,
        dealerGroupId: dealer.dealer_group_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { sub: dealer.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  async validateToken(token: string) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
}
```

---

## Order State Machine

### State Transition Flow

```
┌─────────┐
│ Pending │ ← Initial state when dealer creates order
└────┬────┘
     │
     │ Admin approves
     ▼
┌──────────┐
│ Approved │
└────┬─────┘
     │
     │ Warehouse starts preparation
     ▼
┌───────────┐
│ Preparing │
└────┬──────┘
     │
     │ Order shipped
     ▼
┌─────────┐
│ Shipped │
└────┬────┘
     │
     │ Dealer confirms delivery
     ▼
┌───────────┐
│ Delivered │ ← Terminal state
└───────────┘

     (Any state)
         │
         │ Admin cancels
         ▼
┌───────────┐
│ Cancelled │ ← Terminal state
└───────────┘
```

### Valid Transitions

| From State | To State | Triggered By | Notification Sent |
|-----------|----------|--------------|-------------------|
| Pending | Approved | Admin approval | Yes - "Order approved" |
| Pending | Cancelled | Admin rejection | Yes - "Order cancelled" |
| Approved | Preparing | Warehouse start | Yes - "Order being prepared" |
| Approved | Cancelled | Admin cancellation | Yes - "Order cancelled" |
| Preparing | Shipped | Shipping dispatch | Yes - "Order shipped" |
| Preparing | Cancelled | Admin cancellation | Yes - "Order cancelled" |
| Shipped | Delivered | Dealer confirmation or Auto (after 7 days) | Yes - "Order delivered" |

### State Machine Best Practices

**1. Define transitions explicitly**
- Prevents invalid state changes (e.g., Delivered → Pending)
- Enforces business rules in code

**2. Use meaningful state names**
- "Approved" not "State2"
- Reflects business process, not technical implementation

**3. Maintain state history**
- `order_state_history` table tracks all transitions
- Useful for auditing and customer service

**4. Idempotent transitions**
- Calling transition multiple times has same effect
- Prevents duplicate notifications

### Implementation

```typescript
// Order State Machine
class OrderStateMachine {
  private validTransitions = {
    'Pending': ['Approved', 'Cancelled'],
    'Approved': ['Preparing', 'Cancelled'],
    'Preparing': ['Shipped', 'Cancelled'],
    'Shipped': ['Delivered'],
    'Delivered': [],
    'Cancelled': []
  };

  async transitionState(
    orderId: string,
    toStatus: OrderStatus,
    changedBy: string,
    notes?: string
  ) {
    const order = await orderRepository.findById(orderId);

    // 1. Validate transition
    if (!this.isValidTransition(order.status, toStatus)) {
      throw new ValidationError(
        `Cannot transition from ${order.status} to ${toStatus}`
      );
    }

    // 2. Update order status
    await orderRepository.updateStatus(orderId, toStatus);

    // 3. Record in history
    await orderStateHistoryRepository.create({
      orderId,
      fromStatus: order.status,
      toStatus,
      changedBy,
      notes
    });

    // 4. Emit event for notifications
    eventBus.emit('order.statusChanged', {
      orderId,
      dealerId: order.dealer_id,
      oldStatus: order.status,
      newStatus: toStatus
    });
  }

  private isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    return this.validTransitions[from]?.includes(to) ?? false;
  }
}
```

---

## File/Image Handling Architecture

### Upload Strategy

**Recommended: Cloud Storage (Cloudinary or AWS S3)**

**Why not local filesystem:**
- Limited disk space
- No automatic backups
- Doesn't scale horizontally
- No CDN integration

**Why Cloudinary:**
- Automatic image optimization
- On-the-fly transformations (resize, crop)
- CDN delivery (fast globally)
- Free tier: 25 GB storage, 25 GB bandwidth

### Upload Flow

```
┌─────────────┐                                    ┌─────────────┐
│   Client    │                                    │   Backend   │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. Select image                                 │
       │ 2. POST /api/v1/files/upload                    │
       │    (multipart/form-data)                        │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                              3. Validate file   │
       │                              4. Upload to Cloud │
       │                                                  │
       │ 5. Return file URL                              │
       │    { url: "https://cdn.../image.jpg" }          │
       │<────────────────────────────────────────────────┤
       │                                                  │
       │ 6. Use URL in product/order data                │
```

### Implementation

```typescript
// Using Multer + Cloudinary
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Only accept images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'));
    }
    cb(null, true);
  }
});

// File upload controller
class FileController {
  async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      throw new ValidationError('No file provided');
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload_stream(
      {
        folder: 'dealer-products',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) throw error;
        return result;
      }
    );

    req.file.stream.pipe(result);

    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
}
```

### Security Considerations

1. **Validate file type** - check magic numbers, not just MIME type
2. **Limit file size** - 5MB max for images
3. **Scan for malware** if handling user uploads
4. **Generate unique filenames** to prevent overwrites
5. **Restrict access** - only authenticated dealers can upload

---

## Code Sharing Strategy (React Native + React Web)

### What to Share

**SHARE (High ROI):**
- **Business logic** - API calls, data transformations
- **Type definitions** - TypeScript interfaces for API responses
- **State management** - Redux/Zustand stores
- **Utilities** - date formatting, price formatting, validation
- **API client** - Axios instance with interceptors
- **Constants** - API URLs, config values

**DON'T SHARE (Platform-specific):**
- **UI components** - Different design patterns (mobile vs web)
- **Navigation** - React Navigation vs React Router
- **Storage** - AsyncStorage vs LocalStorage
- **Push notifications** - Platform-specific implementations

### Monorepo Structure

**Recommended: Shared package approach**

```
bayi-yönetimi/
├── packages/
│   ├── shared/              # Shared business logic
│   │   ├── src/
│   │   │   ├── api/         # API client & endpoints
│   │   │   ├── types/       # TypeScript types
│   │   │   ├── utils/       # Helper functions
│   │   │   ├── stores/      # State management
│   │   │   └── constants/   # Shared constants
│   │   └── package.json
│   │
│   ├── mobile/              # React Native app
│   │   ├── src/
│   │   │   ├── components/  # Mobile UI components
│   │   │   ├── screens/     # Mobile screens
│   │   │   ├── navigation/  # React Navigation
│   │   │   └── App.tsx
│   │   └── package.json
│   │
│   └── web/                 # React web app
│       ├── src/
│       │   ├── components/  # Web UI components
│       │   ├── pages/       # Web pages
│       │   ├── routes/      # React Router
│       │   └── App.tsx
│       └── package.json
│
└── package.json             # Root package.json
```

### Shared API Client Example

```typescript
// packages/shared/src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.API_URL || 'http://localhost:3000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken(); // Platform-specific implementation
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired, redirect to login
      handleLogout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Expected Code Sharing Percentage

According to 2026 industry data:
- **41% report shared UI components cut maintenance by at least 25%**
- **Realistic expectation: 40-60% code sharing**
  - 60-70% business logic shared
  - 10-20% UI components shared (design tokens, basic components)

---

## Push Notifications Architecture

### Firebase Cloud Messaging (FCM)

**Why FCM:**
- Free tier sufficient for this scale
- Works on both Android and iOS
- Reliable delivery
- Rich notification support

### Notification Flow

```
┌─────────────┐                                    ┌─────────────┐
│   Mobile    │                                    │   Backend   │
│     App     │                                    │  (Node.js)  │
└──────┬──────┘                                    └──────┬──────┘
       │                                                  │
       │ 1. App initializes                              │
       │ 2. Request FCM token from Firebase              │
       │                                                  │
       │ 3. POST /api/v1/notifications/register-token    │
       │    { fcmToken: "..." }                          │
       ├────────────────────────────────────────────────>│
       │                                                  │
       │                              4. Store token     │
       │                              in dealers table   │
       │                                                  │
       │ 5. Confirmation                                 │
       │<────────────────────────────────────────────────┤
       │                                                  │

       ... Later, when order status changes ...

                                                          │
                              6. Order status changes    │
                              7. Notification service    │
                              8. Send to FCM             │
                                                          │
       ┌────────────────────────────────────────────────┐│
       │ FCM Server                                      ││
       │                                                 ││
       │ 9. Deliver push notification                   ││
       └────────────────────────────────────────────────┘│
       │                                                  │
       │<─────────────────────────────────────────────────┘
       │
       │ 10. Display notification
```

### Backend Implementation

```typescript
// Notification Service
import admin from 'firebase-admin';

class NotificationService {
  constructor() {
    // Initialize Firebase Admin SDK
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY
      })
    });
  }

  async sendOrderStatusNotification(
    dealerId: string,
    orderNumber: string,
    newStatus: string
  ) {
    // Get dealer's FCM token
    const dealer = await dealerRepository.findById(dealerId);
    if (!dealer.fcm_token) return;

    // Prepare notification
    const message = {
      token: dealer.fcm_token,
      notification: {
        title: 'Order Update',
        body: `Order ${orderNumber} is now ${newStatus}`
      },
      data: {
        type: 'ORDER_STATUS_CHANGE',
        orderId: orderNumber,
        status: newStatus
      }
    };

    // Send via FCM
    try {
      await admin.messaging().send(message);
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token') {
        // Token expired, remove from database
        await dealerRepository.updateFcmToken(dealerId, null);
      }
    }
  }
}

// Event handler
eventBus.on('order.statusChanged', async (event) => {
  await notificationService.sendOrderStatusNotification(
    event.dealerId,
    event.orderId,
    event.newStatus
  );
});
```

### Mobile Implementation (React Native)

```typescript
// Using @react-native-firebase/messaging
import messaging from '@react-native-firebase/messaging';

class PushNotificationManager {
  async initialize() {
    // Request permission
    const authStatus = await messaging().requestPermission();
    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
      // Get FCM token
      const fcmToken = await messaging().getToken();

      // Register with backend
      await apiClient.post('/notifications/register-token', { fcmToken });
    }
  }

  setupListeners() {
    // Foreground message handler
    messaging().onMessage(async (remoteMessage) => {
      showInAppNotification(remoteMessage.notification);
    });

    // Background/quit message handler
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message:', remoteMessage);
    });

    // Notification tap handler
    messaging().onNotificationOpenedApp((remoteMessage) => {
      if (remoteMessage.data.type === 'ORDER_STATUS_CHANGE') {
        navigateToOrder(remoteMessage.data.orderId);
      }
    });
  }
}
```

---

## Suggested Build Order

### Phase 1: Foundation (Week 1-2)
**Goal:** Project setup, database, authentication

**Build order:**
1. **Backend project structure** - Express.js with modular architecture
2. **Database schema** - PostgreSQL tables for dealers, dealer_groups, products
3. **Auth module** - JWT login, token validation, middleware
4. **API foundation** - Error handling, validation, response formatting

**Deliverables:**
- Dealers can register and login
- JWT tokens issued and validated
- Basic API structure working

**Why first:** Everything depends on auth. Can't build features without user context.

---

### Phase 2: Product Catalog (Week 2-3)
**Goal:** Dealers can browse products

**Build order:**
1. **Products module** - CRUD operations, search
2. **File upload** - Multer + Cloudinary integration
3. **Pricing module** - Calculate dealer-specific prices based on group
4. **Mobile UI** - Product listing, product details screens
5. **Web UI** - Product catalog pages

**Deliverables:**
- Products displayed with images
- Prices show dealer-specific discounts
- Search and filtering work

**Why second:** Can't place orders without products. This gives dealers something to interact with.

---

### Phase 3: Order Management (Week 3-5)
**Goal:** Dealers can create and track orders

**Build order:**
1. **Orders module** - Create order, calculate totals
2. **Order state machine** - Implement valid transitions
3. **Order state history** - Audit trail
4. **Mobile UI** - Cart, checkout, order history screens
5. **Web UI** - Order management pages

**Deliverables:**
- Dealers create orders
- Orders have correct pricing (with discounts)
- Order history visible
- State transitions enforced

**Why third:** Core business value. This is what dealers came for.

---

### Phase 4: Notifications (Week 5-6)
**Goal:** Dealers receive push notifications on order updates

**Build order:**
1. **FCM setup** - Firebase project, service account
2. **Notifications module** - Send notifications via FCM
3. **Event handlers** - Listen to order state changes
4. **Mobile integration** - FCM token registration, notification handling
5. **Testing** - All order states trigger correct notifications

**Deliverables:**
- Push notifications sent on order status change
- Tapping notification opens order details
- Notifications work in foreground and background

**Why fourth:** Nice-to-have feature. System is usable without it, but improves UX significantly.

---

### Phase 5: Admin Features (Week 6-7)
**Goal:** Admin can manage orders, products, dealers

**Build order:**
1. **Admin authentication** - Separate admin login
2. **Admin web UI** - Order approval, status updates
3. **Product management** - CRUD for products
4. **Dealer management** - View dealers, assign groups
5. **Dashboard** - Order statistics, pending orders

**Deliverables:**
- Admin approves/rejects orders
- Admin updates order status through workflow
- Admin manages product catalog

**Why fifth:** Admin features support operations but aren't needed for initial testing with dealers.

---

### Dependencies Diagram

```
Phase 1: Foundation
    │
    │ (Auth + DB required for everything)
    │
    ├─> Phase 2: Product Catalog
    │       │
    │       │ (Products required for orders)
    │       │
    │       └─> Phase 3: Order Management
    │               │
    │               │ (Orders must exist to notify about them)
    │               │
    │               └─> Phase 4: Notifications
    │
    └─> Phase 5: Admin Features
            (Can be built anytime after Phase 3)
```

---

## Technology Recommendations Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| **Backend Framework** | Express.js | Most popular Node.js framework, fast development |
| **Architecture Pattern** | Modular Monolith | 2-3x faster to market than microservices for this scale |
| **API Style** | REST | 93% adoption, easier caching, faster implementation |
| **Database** | PostgreSQL | ACID compliance for transactional data, excellent performance |
| **ORM/Query Builder** | Prisma or TypeORM | Type-safe database access, migrations |
| **Authentication** | JWT | Stateless, scalable, works across web and mobile |
| **File Storage** | Cloudinary | CDN delivery, image optimization, free tier sufficient |
| **Push Notifications** | Firebase Cloud Messaging | Free, reliable, cross-platform |
| **Code Sharing** | Shared package in monorepo | 40-60% code reuse between web and mobile |
| **State Management** | Zustand or Redux Toolkit | Shared between platforms, simple API |

---

## Sources

### Architecture Patterns
- [B2B Ecommerce Software Architecture - Shopify](https://www.shopify.com/enterprise/blog/b2b-ecommerce-software-architecture)
- [The Modern Blueprint for Digital Ordering - Medium](https://medium.com/razi-chaudhry/the-modern-blueprint-for-digital-ordering-and-real-time-fulfillment-architecture-om-1-203a78bc8b25)
- [Composable Architecture Streamlines B2B Order Management - Smith](https://smithcommerce.com/insights/composable-architecture-streamlines-b2b-order-management/)

### Monolith vs Microservices
- [Monolithic vs Microservices - AWS](https://aws.amazon.com/compare/the-difference-between-monolithic-and-microservices-architecture/)
- [Microservices vs Monoliths in 2026 - Java Code Geeks](https://www.javacodegeeks.com/2025/12/microservices-vs-monoliths-in-2026-when-each-architecture-wins.html)
- [Monolithic vs Microservices in 2026 - Superblocks](https://www.superblocks.com/blog/monolithic-vs-microservices)

### Code Sharing
- [React Native vs React Web - Zuniweb](https://zuniweb.com/blog/react-native-vs-react-web-building-cross-platform-apps/)
- [Sharing code with React Native for Web - LogRocket](https://blog.logrocket.com/sharing-code-react-native-web/)
- [Code Sharing Between React and React Native - Matthew Wolfe](https://matthewwolfe.github.io/blog/code-sharing-react-and-react-native)

### Order State Machines
- [State machines best practices - commercetools](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/states-and-best-practices)
- [Understanding the State Pattern - Medium](https://jinlow.medium.com/understanding-the-state-pattern-a-deep-dive-into-e-commerce-order-management-architecture-744b9f0761ab)
- [What is State Machine - Sylius](https://sylius.com/blog/what-is-state-machine-and-why-is-it-useful-in-modeling-ecommerce-processes/)

### API Design
- [REST API Design Best Practices - freeCodeCamp](https://www.freecodecamp.org/news/rest-api-design-best-practices-build-a-rest-api/)
- [REST vs GraphQL vs tRPC 2026 - DEV](https://dev.to/dataformathub/rest-vs-graphql-vs-trpc-the-ultimate-api-design-guide-for-2026-8n3)
- [GraphQL vs REST - Postman](https://blog.postman.com/graphql-vs-rest/)

### Authentication
- [JWT Security Best Practices - Curity](https://curity.io/resources/learn/jwt-best-practices/)
- [API key vs JWT for B2B SaaS - Scalekit](https://www.scalekit.com/blog/apikey-jwt-comparison)
- [Using JWT as API Keys - Security Boulevard](https://securityboulevard.com/2026/01/using-jwt-as-api-keys-security-best-practices-implementation-guide/)

### File Handling
- [Easily File Upload Using Multer - Bacancy](https://www.bacancytechnology.com/blog/node-js-multer)
- [Multer: upload files with Node.js - LogRocket](https://blog.logrocket.com/multer-nodejs-express-upload-file/)
- [Node.js image upload - ImageKit](https://imagekit.io/blog/nodejs-image-upload/)

### Push Notifications
- [Send FCM Push Notification from Node.js - Medium](https://medium.com/@rhythm6194/send-fcm-push-notification-in-node-js-using-firebase-cloud-messaging-fcm-http-v1-2024-448c0d921fff)
- [FCM Architectural Overview - Firebase](https://firebase.google.com/docs/cloud-messaging/fcm-architecture)
- [Firebase Cloud Messaging Guide - Corecotech](https://corecotechnologies.com/development/firebase-cloud-messaging-complete-guide-for-node-js-and-mobile/)

### Database Design
- [Database design for e-commerce platform - Medium](https://bgiri-gcloud.medium.com/designing-the-database-schema-for-a-new-e-commerce-platform-and-considering-factors-like-ec28d4fb81db)
- [E-Commerce Database Design: EAV Model - Medium](https://np4652.medium.com/e-commerce-database-design-managing-product-variants-for-multi-vendor-platforms-using-the-eav-01307e63b920)
- [Ecommerce Database Design - Vertabelo](https://vertabelo.com/blog/er-diagram-for-online-shop/)

### Pricing
- [Tiered pricing strategies for B2B eCommerce - Turis](https://turis.app/b2b-ecommerce/tiered-pricing-strategies-b2b-wholesale/)
- [B2B eCommerce Tiered Pricing - Clarity](https://www.clarity-ventures.com/articles/b2b-ecommerce-tiered-pricing-structure-clarity)

### Modular Monolith
- [modular-monolith-nodejs - GitHub](https://github.com/mgce/modular-monolith-nodejs)
- [How to better structure your Node.js project - thetshaped.dev](https://thetshaped.dev/p/how-to-better-structure-your-nodejs-project-modular-monolith)

### MVP Build Order
- [Distributed Order Management: MVP approach - Fluent Commerce](https://fluentcommerce.com/resources/blog/distributed-order-management-an-mvp-approach-to-implementation/)
- [The Future of Order Management Systems 2026 - Netguru](https://www.netguru.com/blog/oms-future-trends)
