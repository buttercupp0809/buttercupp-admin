# Admin Portal PRD — Vesspr Internal Dashboard

> **Status:** Ready for implementation
> **Date:** 2026-05-28
> **Repo:** `/Users/kshitijpratap/Documents/Projects/vesspr-admin/` (SEPARATE from Vesspr monorepo)

---

## 1. Overview

Internal admin portal for the Vesspr team (3 admins) to monitor user engagement, view product analytics, manage users, send emails, and track AWS infrastructure costs. Connects to the same Neon PostgreSQL database as the main Vesspr app.

**Admin access (hardcoded allowlist):**
- sachin@karooli.ai
- vaibhav@karooli.ai
- kshitij@karooli.ai

---

## 2. Architecture

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15, App Router, TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Charts | Recharts |
| Database | Prisma Client → same Neon PostgreSQL (pooled) |
| Auth | jose (HS256 JWT), bcryptjs, httpOnly cookie |
| Email | Resend SDK |
| AWS Costs | @aws-sdk/client-cost-explorer |
| Icons | Lucide React |

### Database Access

- **Separate Prisma setup** — copy `schema.prisma` from `packages/database/prisma/schema.prisma`
- **Remove `Unsupported` fields** — pgvector `vector(384)` and `tsvector` columns must be commented out or `@ignore`'d (admin never reads embeddings)
- **Same `DATABASE_URL`** — Neon pooled hostname with `connection_limit=5` (lower than main app's 20)
- **Singleton client** — replicate the `globalThis` pattern from `packages/database/src/client.ts`

### Auth Flow

1. Admin visits `/login` → enters email + password
2. Server checks email against `ADMIN_EMAILS` allowlist
3. Maps email to `ADMIN_PASSWORD_HASH_{NAME}` env var (bcrypt)
4. On match: sign JWT with `jose` (HS256, 24h expiry, `sub: email`)
5. Set as `vesspr-admin-token` httpOnly cookie
6. Middleware guards all routes except `/login` and `/api/auth/login`

---

## 3. Features

### F1: User Engagement Score Table

**Route:** `/users`

**Score definition:** Count of `Message` rows where `sender = "user"` within the selected period.

**Filters:**
- Period: daily (today), weekly (last 7d), monthly (last 30d), quarterly (last 90d)
- Sortable by: score, name, email, createdAt
- Searchable by name or email

**Table columns:** ID (truncated UUID), Email, Name, Platform, Subscription Tier, Score, Created At

**Query approach:** `prisma.message.groupBy({ by: ['userId'], where: { sender: 'user', sentAt: { gte: periodStart } }, _count: true })` joined with user data in JS. Paginated (25 per page).

**Click action:** Navigate to `/users/[id]` (user detail view).

---

### F2: User Detail View

**Route:** `/users/[id]`

**Data:** Single `prisma.user.findUnique` with `include` for all 16 relations. Large collections (messages, memories) capped with `take: 50-100` + "load more".

**Tabs:**

| Tab | Data |
|---|---|
| Profile | User fields, Personality, ArchetypeAnswer |
| Messages | Message history (paginated), platform/sender badges |
| Memories | Memory list with type/importance/pinned/archived badges |
| Events | Events sorted by date |
| Emotional | EmotionalPattern, EmotionalContext, CrisisEvent |
| Subscription | Subscription details, UsageCounter history |
| Relationship | RelationshipArc, ConversationChunk |
| System | Boundary, ScheduledPing, UserPersona, MemorySummary, InitiativeLog |

**Actions on user detail page:**
- "Send Email" button → navigates to `/email` with user pre-filled
- "Send Password Reset" button → triggers forgot-password email
- "Delete User" button → opens confirmation dialog → cascade delete

---

### F3: Analytics Dashboard

**Route:** `/dashboard`

**Charts (all use Recharts):**

| Chart | Type | Data Source |
|---|---|---|
| User Growth | Area chart | `User.createdAt` grouped by day/week/month |
| Active Users | Bar chart (DAU + WAU) | Distinct `userId` in Message where `sender='user'` |
| Message Volume | Stacked area | Message count by day, stacked by platform |
| Tier Distribution | Donut chart | `User.subscriptionTier` group count |
| Platform Distribution | Horizontal bar | `User.platform` group count |
| Usage Counters | Stacked bar | `UsageCounter` sums: llmMessages, voiceNotes, imageGens |
| Top Events | Table | `AnalyticsEvent` grouped by eventName, count per period |

**Controls:** Date range picker (7d / 30d / 90d / all-time), granularity toggle (day / week / month).

**Summary cards at top:** Total users, Active today, Messages today, Paid subscribers.

---

### F4: User Data Deletion

**Route:** `/delete`

**Flow:**
1. Search for user by email or name
2. Select user → show summary (name, email, message count, subscription, created date)
3. Type user's email to confirm (destructive action pattern)
4. Click "Delete permanently" → `prisma.user.delete({ where: { id } })`
5. All 16 related tables cascade-delete automatically (schema has `onDelete: Cascade` on all)
6. Show success confirmation

**Also accessible** from user detail page (`/users/[id]`) via "Delete User" button.

---

### F5: Email Composer

**Route:** `/email`

**Mode 1: Rich Email**
- To: User email (type-ahead search)
- Subject: Free text
- Body: Textarea (plain text or basic HTML)
- Preview: Renders using the Vesspr `emailShell()` template (copied from `frontend/lib/email.ts`)
- Send: POST to `/api/email/send` → Resend API
- FROM: `Vesspr <admin@vesspr.ai>` (or `EMAIL_FROM` env var)

**Mode 2: Forgot Password**
- Select user from search
- One-click "Send Password Reset"
- Generates a reset token (JWT with `purpose: "password-reset"`, 1hr expiry)
- Sends via `sendPasswordResetEmail()` pattern from main app
- Reset URL points to `VESSPR_APP_URL/reset-password?token=xxx`

---

### F6: AWS Credits & Costs

**Route:** `/aws`

**Data source:** `@aws-sdk/client-cost-explorer` → `GetCostAndUsage` API

**Periods:** Current month, last month, all-time (since 2026-04-01)

**Display:**
- Total spend (current month)
- Credits remaining: `AWS_CREDIT_TOTAL` env var minus total all-time spend
- Service breakdown table: Service name, Cost, % of total
- Monthly trend line chart (last 6 months)

**Services tracked** (from `13-aws-costs.sh`):**
- RDS (db.t4g.micro)
- ECS Fargate
- ALB
- EC2 Bastion
- ECR
- EFS
- Secrets Manager
- CloudWatch Logs
- Amplify
- Data Transfer

**Caching:** In-memory cache (1hr TTL) to avoid Cost Explorer API charges ($0.01/request).

---

## 4. Layout

### Sidebar Navigation (240px fixed width, dark)

| Icon | Label | Route |
|---|---|---|
| BarChart3 | Dashboard | `/dashboard` |
| Users | Users | `/users` |
| Mail | Email | `/email` |
| Server | AWS Costs | `/aws` |
| Trash2 | Delete User | `/delete` |

### Root (`/`) redirects to `/dashboard`

### Top bar: "Vesspr Admin" + logged-in admin email + logout button

---

## 5. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Validate admin email + password, return JWT |
| `/api/auth/logout` | POST | Clear cookie |
| `/api/auth/check` | GET | Verify JWT, return admin info |
| `/api/users` | GET | List users with engagement scores. Query: `period`, `sort`, `order`, `page`, `limit`, `search` |
| `/api/users/[id]` | GET | Full user detail (all relations) |
| `/api/users/[id]` | DELETE | Cascade delete user |
| `/api/users/[id]/email` | POST | Send email to user (rich or forgot-password) |
| `/api/analytics/growth` | GET | Signups over time |
| `/api/analytics/active` | GET | DAU/WAU counts |
| `/api/analytics/messages` | GET | Message volume by period |
| `/api/analytics/tiers` | GET | Subscription tier distribution |
| `/api/analytics/platforms` | GET | Platform distribution |
| `/api/analytics/usage` | GET | Aggregated UsageCounter sums |
| `/api/analytics/events` | GET | AnalyticsEvent top events |
| `/api/analytics/summary` | GET | Summary cards (total users, active today, etc.) |
| `/api/aws/costs` | GET | AWS Cost Explorer data |
| `/api/email/send` | POST | Send arbitrary email via Resend |

---

## 6. Environment Variables

```bash
# Database (same Neon pooled URL as main app)
DATABASE_URL=postgresql://...@ep-xxx-pooler.eu-north-1.aws.neon.tech/vesspr?sslmode=require

# Admin Auth
ADMIN_EMAILS=sachin@karooli.ai,vaibhav@karooli.ai,kshitij@karooli.ai
ADMIN_PASSWORD_HASH_SACHIN=<bcrypt hash>
ADMIN_PASSWORD_HASH_VAIBHAV=<bcrypt hash>
ADMIN_PASSWORD_HASH_KSHITIJ=<bcrypt hash>
ADMIN_JWT_SECRET=<random 64-char string>

# Email
RESEND_API_KEY=re_xxx
EMAIL_FROM=Vesspr Admin <admin@karooli.ai>

# AWS
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_CREDIT_TOTAL=1000

# Main app URL (for password reset links)
VESSPR_APP_URL=https://vesspr.ai
```

---

## 7. Acceptance Criteria

- [ ] Only 3 admins can log in — all other emails rejected
- [ ] User engagement score table loads with correct message counts per period
- [ ] Clicking a user shows all data across all 16 related tables
- [ ] Analytics dashboard shows 7 chart types with real data
- [ ] Summary cards show correct totals
- [ ] Deleting a user removes ALL related data (verify with DB query after delete)
- [ ] Email composer sends real emails via Resend
- [ ] Forgot password sends reset email with working link to main app
- [ ] AWS costs page shows service breakdown and remaining credits
- [ ] All API routes return 401 without valid admin JWT
- [ ] No changes to the Vesspr repo — admin is fully self-contained
- [ ] Mobile-responsive sidebar collapses to hamburger menu
