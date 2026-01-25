# Technology Stack Research

**Project:** B2B Dealer Order Management System
**Researched:** 2026-01-25
**Scale:** ~500 products, ~700 dealers, 20-30 orders/day
**Architecture:** Web portal + React Native mobile app + Node.js backend

## Executive Summary

For a B2B dealer order management system in 2025, the recommended stack prioritizes **type safety, developer experience, and proven scalability**. The architecture uses NestJS for structured backend development, PostgreSQL with Prisma for transactional data integrity, Next.js 15 App Router for the web portal, and React Native with Expo Router for mobile. This stack balances modern best practices with battle-tested stability, appropriate for the 700-dealer, 20-30 orders/day scale.

---

## Recommended Stack

### Backend Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **NestJS** | ^11.1.0 | Backend framework | Enterprise-grade architecture, built-in TypeScript support, excellent for complex B2B logic with dependency injection and modular structure. Dominates B2B/enterprise space in 2025. |
| **Fastify** | ^5.2.0 | HTTP adapter (optional) | Can replace Express under NestJS for 2-3x better performance. Use `@nestjs/platform-fastify` for high-throughput scenarios. |
| **TypeScript** | ^5.7.0 | Type system | Required for NestJS, provides compile-time safety critical for order/pricing logic. |

**Rationale:**
- NestJS is the clear winner for B2B order management systems in 2025, providing the structure needed for complex business logic (dealer groups, tiered pricing, order workflows)
- Built-in dependency injection, modules, and decorators keep code maintainable as features grow
- Can use Fastify adapter for performance without sacrificing NestJS architecture
- Express is too minimal for this complexity; raw Fastify lacks the architectural patterns NestJS provides

**Sources:**
- [Express.js vs Fastify vs NestJS for Backend Development [2026 Comparison]](https://www.index.dev/skill-vs-skill/backend-nestjs-vs-expressjs-vs-fastify)
- [Express vs NestJS vs Fastify – Which Node.js Framework Should You Choose in 2025](https://jeuxdevelopers.com/Blogs/Express-vs-NestJS-vs-Fastify-Which-Node.js-Framework-Should-You-Choose-in-2025)
- [NestJS vs. Express.js: Choosing the Best Node Framework for 2026](https://swovo.com/blog/nestjs-vs-express/)

---

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 16.x | Primary database | ACID compliance critical for order transactions, strong support for complex queries (dealer-group pricing), excellent JSON support (JSONB) for flexible product attributes. |
| **Prisma** | ^7.3.0 | ORM | Best-in-class TypeScript integration, schema-first approach, auto-generated type-safe client. Superior developer experience over Drizzle/TypeORM for new projects. |
| **node-postgres (pg)** | ^8.17.0 | PostgreSQL driver | Industry standard, used by Prisma internally. |

**Rationale:**
- PostgreSQL over MongoDB: B2B order management requires **ACID transactions** for orders, payments, and inventory. PostgreSQL provides relational integrity (orders → line items → products) while JSONB handles flexible product catalogs
- Prisma over Drizzle/TypeORM: While Drizzle has better performance, Prisma's developer experience, schema migrations, and type generation are unmatched for rapid development. At 20-30 orders/day, performance difference is negligible
- PostgreSQL JSONB gives flexibility for product attributes without sacrificing transactional guarantees

**Alternative considered:**
- **MongoDB**: Only if product catalog had extremely variable schemas. Rejected due to lack of multi-document ACID transactions and relational complexity of dealer-group-pricing-order relationships
- **Drizzle ORM**: Better performance but requires more SQL knowledge. Choose if team is SQL-fluent and performance becomes critical
- **TypeORM**: Legacy choice, spotty maintenance in 2025

**Sources:**
- [PostgreSQL vs. MongoDB in 2025: Which Database Should Power Your Next Project?](https://dev.to/hamzakhan/postgresql-vs-mongodb-in-2025-which-database-should-power-your-next-project-2h97)
- [MongoDB vs PostgreSQL in 2025: What Should You Choose?](https://www.sevensquaretech.com/mongodb-vs-postgresql/)
- [Node.js ORMs in 2025: Choosing Between Prisma, Drizzle, TypeORM, and Beyond](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)
- [Best ORM for NestJS in 2025: Drizzle ORM vs TypeORM vs Prisma](https://dev.to/sasithwarnakafonseka/best-orm-for-nestjs-in-2025-drizzle-orm-vs-typeorm-vs-prisma-229c)

---

### Mobile (React Native)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **React Native** | ^0.83.0 | Mobile framework | Cross-platform iOS/Android from single codebase. Mature ecosystem for e-commerce apps. |
| **Expo** | ^54.0.0 | Development platform | Simplifies build/deploy, provides unified APIs for native features. Recommended for new RN projects in 2025. |
| **Expo Router** | ^4.1.0 | Navigation | File-based routing (like Next.js), built on React Navigation. Default for new Expo projects. |
| **Gluestack UI** | ^2.0.0 | UI component library | Modern replacement for NativeBase, responsive components across iOS/Android. |
| **React Native Paper** | ^5.15.0 | Material Design UI | Alternative/complement to Gluestack, Material Design patterns. |

**React Native Libraries for E-commerce:**

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **React Navigation** | ^7.1.0 | Navigation (alternative) | If not using Expo Router, component-based navigation |
| **React Native Gesture Handler** | ^2.24.0 | Gestures | Swipeable carts, pull-to-refresh (included with Expo) |
| **React Native Reanimated** | ^3.18.0 | Animations | Smooth UI animations (included with Expo) |
| **React Native Fast Image** | ^8.6.3 | Image caching | Optimized product image loading and caching |
| **react-native-image-crop-picker** | ^0.43.0 | Image upload | Dealer profile pictures, product images |

**Rationale:**
- Expo is the standard way to build React Native apps in 2025, eliminating native build complexity during development
- Expo Router over React Navigation: File-based routing is clearer for large apps, matches Next.js mental model for web developers
- Gluestack UI: Modern, actively maintained, better TypeScript support than older libraries

**Sources:**
- [Top 10 React Libraries to Use in 2025](https://strapi.io/blog/top-react-libraries)
- [Best React Native UI Component Libraries in 2025](https://www.eitbiz.com/blog/best-react-native-ui-component-libraries/)
- [React Navigation 7 vs Expo Router: Complete Comparison Guide for 2025](https://viewlytics.ai/blog/react-navigation-7-vs-expo-router)
- [Introduction to Expo Router - Expo Documentation](https://docs.expo.dev/router/introduction/)

---

### Web Frontend

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Next.js** | ^16.1.0 | Web framework | React framework with SSR, App Router for file-based routing, server components. Industry standard for 2025. |
| **React** | ^19.0.0 | UI library | Next.js 16 supports React 19. |
| **TypeScript** | ^5.7.0 | Type system | Type safety across frontend/backend. |
| **TailwindCSS** | ^4.1.0 | Styling | Utility-first CSS, rapid UI development, excellent with Next.js. |
| **shadcn/ui** | latest | Component library | Copy-paste components built on Radix UI + Tailwind, highly customizable. |

**State Management:**

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **TanStack Query** | ^5.90.0 | Server state | API data fetching, caching, synchronization. Replaces Redux for API calls. |
| **Zustand** | ^5.0.10 | Client state | Lightweight global state (cart, UI state). Use for non-server state. |

**Rationale:**
- Next.js 15/16 App Router is the forward-looking choice in 2025. Server Components reduce client JavaScript, faster page loads critical for B2B users
- State management: **TanStack Query + Zustand** replaces Redux. TanStack Query handles all server/API state (products, orders), Zustand handles client state (cart, filters). This is the 2025 standard
- Do NOT use Redux for new projects unless you have massive, complex state dependencies (you don't at this scale)
- shadcn/ui over MUI/Ant Design: More modern, better performance, full control over component code

**Sources:**
- [Goodbye Redux? Meet TanStack Query & Zustand in 2025](https://www.bugragulculer.com/blog/good-bye-redux-how-react-query-and-zustand-re-wired-state-management-in-25)
- [State Management Trends in React 2025](https://makersden.io/blog/react-state-management-in-2025)
- [Redux Toolkit vs React Query vs Zustand: Which One Should You Use in 2025?](https://medium.com/@vishalthakur2463/redux-toolkit-vs-react-query-vs-zustand-which-one-should-you-use-in-2025-048c1d3915f4)
- [Next.js Routing: App Router vs. Pages Router (2025)](https://kitemetric.com/blogs/next-js-routing-in-2025-app-router-vs-pages-router)

---

### Authentication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **jsonwebtoken** | ^9.0.3 | JWT signing/verification | Industry standard for stateless auth tokens. |
| **bcrypt** | ^5.1.1 | Password hashing | Secure password storage. |
| **@nestjs/passport** | ^11.0.0 | Auth middleware | Passport.js integration for NestJS. |
| **passport-jwt** | ^4.0.1 | JWT strategy | JWT authentication strategy for Passport. |

**Strategy:**
- **Access tokens:** Short-lived (15-30 minutes), stored in memory (web) or secure storage (mobile)
- **Refresh tokens:** Long-lived (7 days), stored in HTTP-only cookies (web) or secure storage (mobile)
- **Token rotation:** Rotate refresh tokens on each use to prevent replay attacks

**Security Best Practices (2025):**
1. Use HTTP-only cookies for refresh tokens (web)
2. Set appropriate token expiration times (15-30 min access, 7 days refresh)
3. Store secrets in environment variables, never hardcode
4. Use HTTPS in production
5. Implement token rotation/revocation
6. Use bcrypt rounds of 10-12 for password hashing

**Rationale:**
- JWT is the standard for B2B applications requiring mobile + web auth
- Session-based auth requires server-side storage, complicates horizontal scaling
- Refresh token rotation prevents long-lived token theft

**Alternative considered:**
- **Session-based auth**: Simpler but requires Redis/database for session storage. Rejected due to mobile app complexity
- **Auth0/Clerk**: SaaS auth providers. Rejected for MVP to maintain control, consider for production

**Sources:**
- [5 JWT authentication best practices for Node.js apps](https://medium.com/deno-the-complete-reference/5-jwt-authentication-best-practices-for-node-js-apps-f1aaceda3f81)
- [JWT Authentication In Node.js](https://www.geeksforgeeks.org/node-js/jwt-authentication-with-node-js/)
- [How to Secure JWT Authentication in a Node.js API?](https://github.com/orgs/community/discussions/147581)

---

### Push Notifications

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Firebase Cloud Messaging (FCM)** | latest | Push delivery | Free, supports iOS/Android, industry standard for 2025. |
| **expo-notifications** | ~0.30.0 | RN integration | Unified API for push notifications in Expo apps. |
| **@react-native-firebase/messaging** | ^21.11.0 | Native FCM (if not Expo) | Direct FCM integration for bare React Native. |

**Strategy:**
- Use **Expo Push Notifications** for MVP (simplest setup, free)
- Migrate to **FCM** for production (more control, analytics, better deliverability)
- Store push tokens in database linked to dealer accounts
- Send notifications for: order status updates, new product announcements, price changes

**Rationale:**
- Expo Notifications is fastest to implement for MVP, no certificate/API key setup needed
- FCM is free and the most widely adopted solution in 2025
- OneSignal is better if you need advanced segmentation/A-B testing, but adds complexity and cost for your scale

**Alternative considered:**
- **OneSignal**: Better analytics and marketing features, but overkill for 700 dealers. Consider post-MVP
- **Apple/Google native**: Too complex, FCM abstracts both

**Sources:**
- [Top 5 Push Notification Services for Expo/React Native in 2025](https://pushbase.dev/blog/top-5-push-notification-services-for-expo-react-native-in-2025)
- [React Native Push Notifications: FCM, Expo & Production Guide](https://www.courier.com/blog/react-native-push-notifications-fcm-expo-guide)
- [Expo Push Notification Setup - Expo Documentation](https://docs.expo.dev/push-notifications/push-notifications-setup/)

---

### Image/File Storage & CDN

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Cloudinary** | ^2.9.0 | Image storage/CDN | Automatic optimization, transformations, built-in CDN. Best DX for image-heavy apps. |
| **cloudinary-build-url** | ^0.2.4 | URL builder | Generate optimized image URLs with transformations. |

**Strategy:**
- **Product images:** Upload to Cloudinary, serve via CDN with automatic WebP/AVIF conversion
- **Transformations:** Generate thumbnails, mobile-optimized versions on-the-fly
- **Free tier:** 25GB storage, 25GB bandwidth/month (sufficient for MVP with 500 products)
- **Cost optimization:** Migrate old/unused images to AWS S3 for long-term storage if needed

**Rationale:**
- Cloudinary provides automatic image optimization (WebP, compression, responsive sizing) without manual work
- Built-in CDN for global delivery
- Node.js SDK is mature and well-documented
- For 500 products, free tier is sufficient; upgrade only when scaling past 700 dealers

**Alternative considered:**
- **AWS S3 + CloudFront**: More cost-effective at very high scale (100k+ images) but requires manual optimization pipeline (Sharp, Lambda@Edge). Rejected for MVP due to complexity
- **Hybrid approach**: Use Cloudinary for active products (30 days), archive to S3. Consider post-MVP

**Sources:**
- [Media Hosting in AWS S3 vs Cloudinary](https://praveenax.medium.com/media-hosting-in-aws-s3-vs-cloudinary-e9a42b001111)
- [Cloudinary vs. S3: Choosing the Right Solution for Media Optimization](https://cloudinary.com/guides/ecosystems/cloudinary-vs-s3)
- [Handling File Uploads in MERN: Cloudinary, AWS S3, or Firebase?](https://dev.to/nadim_ch0wdhury/handling-file-uploads-in-mern-cloudinary-aws-s3-or-firebase-3j3n)

---

### Additional Backend Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| **class-validator** | ^0.14.1 | DTO validation (NestJS) |
| **class-transformer** | ^0.5.1 | DTO transformation (NestJS) |
| **@nestjs/config** | ^3.4.0 | Environment configuration |
| **@nestjs/swagger** | ^8.0.11 | API documentation (OpenAPI) |
| **helmet** | ^8.1.0 | Security headers |
| **cors** | ^2.8.5 | CORS configuration |
| **compression** | ^1.7.5 | Response compression |

---

### Development Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **ESLint** | ^9.20.0 | Linting |
| **Prettier** | ^3.4.2 | Code formatting |
| **Husky** | ^10.1.1 | Git hooks |
| **lint-staged** | ^15.5.0 | Pre-commit linting |
| **Jest** | ^29.7.0 | Testing framework |
| **Supertest** | ^7.1.0 | API testing |

---

## What NOT to Use

### Anti-Recommendations

| Technology | Why Avoid | Use Instead |
|------------|-----------|-------------|
| **Express (standalone)** | Too minimal for complex B2B logic. No built-in structure leads to inconsistent architecture as team grows. | NestJS (uses Express/Fastify under the hood with structure) |
| **MongoDB** | Lack of ACID transactions across collections makes order management error-prone. Dealer-product-order relationships are inherently relational. | PostgreSQL with JSONB for flexible fields |
| **Redux (standalone)** | Massive boilerplate for what TanStack Query + Zustand do better. Redux belongs in 2020, not 2025. | TanStack Query (server state) + Zustand (client state) |
| **TypeORM** | Spotty maintenance, critical bugs unresolved for months. Prisma and Drizzle have surpassed it in 2025. | Prisma (DX) or Drizzle (performance) |
| **Create React App** | Deprecated. No longer maintained. | Next.js or Vite |
| **MobX** | Declining adoption, harder to debug than Zustand for simple cases, still requires understanding of reactive programming. | Zustand for client state |
| **GraphQL (for this project)** | Overkill for a straightforward CRUD B2B system. REST API is simpler, faster to implement, easier to debug. | REST API with NestJS controllers |
| **Sequelize** | Legacy ORM with poor TypeScript support compared to modern alternatives. | Prisma |
| **Local file storage** | No CDN, no automatic optimization, disaster recovery issues. | Cloudinary (images) |
| **AWS S3 (for MVP)** | Requires manual optimization pipeline. Adds complexity without benefit at MVP scale. | Cloudinary (upgrade to S3 when cost justifies complexity) |
| **OneSignal (for MVP)** | More complex setup than needed. Better for marketing-heavy push campaigns. | Expo Push Notifications → FCM |
| **Socket.io** | Stateful connections complicate horizontal scaling. For simple order updates, polling or server-sent events sufficient. | Polling with TanStack Query (5-min intervals) or WebSockets only if real-time critical |

---

## Installation Commands

### Backend (NestJS)
```bash
# Create NestJS project
npm i -g @nestjs/cli
nest new bayi-backend

# Core dependencies
npm install @nestjs/config @nestjs/swagger @nestjs/passport passport passport-jwt
npm install @prisma/client bcrypt jsonwebtoken helmet cors compression
npm install class-validator class-transformer
npm install cloudinary

# Dev dependencies
npm install -D @nestjs/platform-fastify
npm install -D prisma @types/passport-jwt @types/bcrypt @types/jsonwebtoken
npm install -D @types/node typescript ts-node

# Initialize Prisma
npx prisma init
```

### Web (Next.js)
```bash
# Create Next.js project with TypeScript
npx create-next-app@latest bayi-web --typescript --tailwind --app

# Dependencies
npm install @tanstack/react-query zustand
npm install axios # or fetch wrapper

# UI
npm install clsx tailwind-merge # for shadcn/ui utilities
npx shadcn@latest init

# Dev dependencies
npm install -D @types/node
```

### Mobile (React Native + Expo)
```bash
# Create Expo project with Expo Router
npx create-expo-app@latest bayi-mobile -e with-router

# UI libraries
npx expo install @gluestack-ui/themed @gluestack-style/react
npx expo install react-native-paper

# Core functionality
npx expo install expo-notifications expo-device expo-constants
npx expo install react-native-gesture-handler react-native-reanimated
npx expo install expo-image-picker expo-secure-store

# Image handling
npm install react-native-fast-image
npm install axios # API client

# State management
npm install @tanstack/react-query zustand
```

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| **Backend Framework (NestJS)** | **HIGH** | Dominant choice for enterprise Node.js in 2025, excellent for B2B complexity. Multiple authoritative sources confirm. |
| **Database (PostgreSQL + Prisma)** | **HIGH** | PostgreSQL is proven for transactional B2B systems. Prisma is the most popular TypeScript ORM in 2025. |
| **Mobile (React Native + Expo)** | **HIGH** | Expo is the recommended way to build React Native apps per official docs. Expo Router is default for new projects. |
| **Web (Next.js App Router)** | **HIGH** | Next.js 15+ App Router is the official recommendation from Vercel. Industry standard verified by multiple sources. |
| **State Management (TanStack Query + Zustand)** | **HIGH** | Clear consensus in 2025 community that this combination replaces Redux for most use cases. |
| **Authentication (JWT)** | **MEDIUM** | JWT is standard for mobile + web, but implementation details (refresh token rotation, storage) require careful execution. |
| **Push Notifications (FCM)** | **MEDIUM** | FCM is proven, but Expo Push Notifications for MVP is a pragmatic choice with migration path. Consider OneSignal if marketing features become critical. |
| **Image Storage (Cloudinary)** | **MEDIUM** | Best DX but cost may require S3 migration later. Free tier sufficient for MVP verified. |

---

## Version Lock Recommendations

Lock major versions to avoid breaking changes:

```json
{
  "dependencies": {
    "@nestjs/core": "^11.1.0",
    "next": "^16.1.0",
    "react-native": "^0.83.0",
    "expo": "~54.0.0",
    "prisma": "^7.3.0",
    "@tanstack/react-query": "^5.90.0"
  }
}
```

Use `^` for minor updates, avoid automatic major version upgrades.

---

## Migration Path

This stack is designed for evolution:

1. **MVP (now):** Expo Notifications, Cloudinary free tier, single backend instance
2. **Scale (700+ dealers):** Migrate to FCM, add Redis for caching, horizontal backend scaling
3. **Enterprise (2000+ dealers):** Consider Drizzle ORM for performance, S3 for cost, dedicated CDN
4. **Multi-tenant:** Add tenant isolation in PostgreSQL schemas, consider Auth0/Clerk

---

## Summary

This stack represents the **2025 standard for B2B order management systems**, balancing:
- **Type safety:** TypeScript throughout (NestJS, Prisma, Next.js, React Native)
- **Developer experience:** Prisma, TanStack Query, Expo, Next.js App Router
- **Scalability:** PostgreSQL ACID, stateless JWT, CDN-backed images
- **Proven reliability:** NestJS, Next.js, PostgreSQL are battle-tested at enterprise scale

At 700 dealers and 20-30 orders/day, this stack will perform exceptionally without over-engineering. All components have clear upgrade paths when scale demands it.
