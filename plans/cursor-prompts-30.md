# Cursor Prompt 30: Vesspr Admin Portal — Full Implementation

> **PRD:** `Plans/product-prds/admin-portal-prd.md`
> **Repo:** Create at `/Users/kshitijpratap/Documents/Projects/vesspr-admin/` (NOT inside the Vesspr monorepo)
> **Rule:** This is a SEPARATE Next.js app. Do NOT modify anything in the Vesspr repo.

---

## Phase 1: Scaffold Project

### 1.1 Create the app

```bash
cd /Users/kshitijpratap/Documents/Projects
npx create-next-app@latest vesspr-admin --typescript --tailwind --app --src-dir=false --import-alias="@/*"
cd vesspr-admin
```

### 1.2 Install dependencies

```bash
npm install @prisma/client@^6.6.0 @prisma/adapter-pg@^6.6.0 pg@^8.20.0 jose@^6.2.3 bcryptjs@^3.0.3 resend@^6.10.0 @aws-sdk/client-cost-explorer recharts@^2.12.0 lucide-react sonner
npm install -D prisma@^6.6.0 @types/bcryptjs @types/pg
```

### 1.3 Initialize shadcn/ui

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables.

Then add the components we need:

```bash
npx shadcn@latest add button card input label table tabs dialog badge separator select dropdown-menu avatar sheet toast sonner
```

### 1.4 Verify

- `npm run dev` starts without errors on localhost:3000
- shadcn components are available in `components/ui/`

---

## Phase 2: Prisma Setup

### 2.1 Copy schema

Copy the Prisma schema from the Vesspr monorepo:

```bash
mkdir -p prisma
cp /Users/kshitijpratap/Documents/Projects/Pellow/packages/database/prisma/schema.prisma prisma/schema.prisma
```

### 2.2 Patch the schema

Edit `prisma/schema.prisma`:

1. **Change the generator output** (if needed) — ensure it generates to `node_modules/.prisma/client`

2. **Comment out or `@ignore` all `Unsupported` fields** — these are pgvector columns that Prisma can't generate a client for:

```prisma
// In model Memory:
// embedding Unsupported("vector(384)")?    // @ignore — admin doesn't need embeddings

// In model KnowledgeChunk:
// embedding Unsupported("vector(384)")?    // @ignore
// tsv       Unsupported("tsvector")?       // @ignore

// In model ConversationChunk:
// embedding Unsupported("vector(384)")?    // @ignore
```

Comment out those 4 lines entirely (prefix with `//`). Also comment out any `@@index` that references those fields (the HNSW indexes on `embedding`).

3. **Change the datasource URL** to use env var:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
}
```

### 2.3 Generate client

```bash
npx prisma generate
```

### 2.4 Create singleton client

Create `lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  // Append connection pool params for serverless
  const sep = url.includes("?") ? "&" : "?";
  const pooledUrl = `${url}${sep}connection_limit=5&connect_timeout=15`;

  return new PrismaClient({
    datasources: { db: { url: pooledUrl } },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### 2.5 Create `.env.local`

```bash
# Database — same Neon pooled URL as main Vesspr app
DATABASE_URL=<paste from Vesspr backend/.env>

# Admin Auth
ADMIN_EMAILS=sachin@karooli.ai,vaibhav@karooli.ai,kshitij@karooli.ai
ADMIN_PASSWORD_HASH_SACHIN=<generate with: node -e "require('bcryptjs').hash('password', 12).then(console.log)">
ADMIN_PASSWORD_HASH_VAIBHAV=<generate>
ADMIN_PASSWORD_HASH_KSHITIJ=<generate>
ADMIN_JWT_SECRET=<generate with: openssl rand -hex 32>

# Email
RESEND_API_KEY=<paste from Vesspr>
EMAIL_FROM=Vesspr Admin <admin@karooli.ai>

# AWS
AWS_ACCESS_KEY_ID=<from AWS IAM>
AWS_SECRET_ACCESS_KEY=<from AWS IAM>
AWS_REGION=us-east-1
AWS_CREDIT_TOTAL=1000

# Main Vesspr app URL (for password reset links)
VESSPR_APP_URL=https://vesspr.ai
```

### 2.6 Verify

```bash
# Test database connection
npx prisma studio
```

Should open and show all 21 tables with real data. Close it after verifying.

---

## Phase 3: Auth System

### 3.1 Create `lib/auth.ts`

```typescript
import { jwtVerify, SignJWT } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";

const COOKIE_NAME = "vesspr-admin-token";
const JWT_SECRET = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || "");
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());

export async function validateAdmin(email: string, password: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(normalized)) return false;

  // Map email to env var: sachin@karooli.ai → ADMIN_PASSWORD_HASH_SACHIN
  const name = normalized.split("@")[0].toUpperCase();
  const hash = process.env[`ADMIN_PASSWORD_HASH_${name}`];
  if (!hash) return false;

  return compare(password, hash);
}

export async function signAdminToken(email: string): Promise<string> {
  return new SignJWT({ sub: email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .setIssuedAt()
    .sign(JWT_SECRET);
}

export async function verifyAdminToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const email = payload.sub as string;
    if (!ADMIN_EMAILS.includes(email.toLowerCase())) return null;
    return email;
  } catch {
    return null;
  }
}

export async function getAdminEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminToken(token);
}

export function setAdminCookie(response: Response, token: string): void {
  // Cookie set via headers — use in API routes
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
  );
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
```

### 3.2 Create `middleware.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "vesspr-admin-token";
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET || "");
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 3.3 Create `/api/auth/login/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { validateAdmin, signAdminToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const valid = await validateAdmin(email, password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signAdminToken(email.toLowerCase());
  const res = NextResponse.json({ success: true, email });
  res.cookies.set("vesspr-admin-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return res;
}
```

### 3.4 Create `/api/auth/logout/route.ts`

```typescript
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete("vesspr-admin-token");
  return res;
}
```

### 3.5 Create `/login/page.tsx`

Simple login form: email input, password input, submit button. On success redirect to `/dashboard`. Use shadcn Card, Input, Button, Label. Show error state on invalid credentials.

### 3.6 Verify

1. `npm run dev` → navigate to any page → redirected to `/login`
2. Login with a valid admin email + password → redirected to dashboard
3. Login with wrong email → "Invalid credentials" error
4. Login with non-admin email → "Invalid credentials" error
5. Visit `/api/users` without cookie → 401

---

## Phase 4: Layout — Sidebar + Content

### 4.1 Create `components/sidebar.tsx`

Side navigation with 5 items. Use Lucide icons: `BarChart3`, `Users`, `Mail`, `Server`, `Trash2`. Active state highlights current route. Collapsible on mobile (use shadcn Sheet).

Bottom: admin email display + logout button.

### 4.2 Create `app/(admin)/layout.tsx`

```
<div className="flex h-screen">
  <Sidebar />
  <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
    {children}
  </main>
</div>
```

### 4.3 Create `app/page.tsx`

Redirect to `/dashboard`:

```typescript
import { redirect } from "next/navigation";
export default function Home() { redirect("/dashboard"); }
```

### 4.4 Verify

- Sidebar renders with 5 nav items
- Clicking nav items navigates correctly
- Active route is highlighted
- Logout button clears cookie and redirects to login

---

## Phase 5: Users + Engagement Score

### 5.1 Create `/api/users/route.ts`

**GET handler:**

Query params: `period` (daily|weekly|monthly|quarterly), `sort` (score|name|email|createdAt), `order` (asc|desc), `page` (default 1), `limit` (default 25), `search` (name/email filter).

Logic:
1. Calculate `periodStart` from period param
2. Fetch all users with basic fields: `prisma.user.findMany({ select: { id, email, name, platform, subscriptionTier, createdAt } })`
3. Fetch message counts: `prisma.message.groupBy({ by: ['userId'], where: { sender: 'user', sentAt: { gte: periodStart } }, _count: { _all: true } })`
4. Join in JS: merge user data with scores
5. Sort, paginate, return

Response: `{ users: [...], total, page, limit }`

### 5.2 Create `app/(admin)/users/page.tsx`

- Period selector (4 buttons: Daily, Weekly, Monthly, Quarterly)
- Search input (debounced, 300ms)
- shadcn Table with columns: ID, Email, Name, Platform, Tier, Score, Created
- Sortable column headers (click to toggle asc/desc)
- Pagination controls
- Click row → navigate to `/users/[id]`

### 5.3 Verify

1. Table loads with real users
2. Score changes when switching period
3. Search filters by name/email
4. Sorting works on all columns
5. Clicking a row navigates to user detail

---

## Phase 6: User Detail View

### 6.1 Create `/api/users/[id]/route.ts`

**GET handler:**

```typescript
const user = await prisma.user.findUnique({
  where: { id: params.id },
  include: {
    personality: true,
    archetypeAnswers: true,
    memories: { take: 50, orderBy: { createdAt: "desc" } },
    events: { take: 50, orderBy: { eventDate: "desc" } },
    messages: { take: 100, orderBy: { sentAt: "desc" } },
    boundary: true,
    subscription: true,
    arcs: { orderBy: { weekNumber: "desc" }, take: 10 },
    initiativeLogs: { take: 50, orderBy: { createdAt: "desc" } },
    crisisEvents: { orderBy: { createdAt: "desc" } },
    emotionalPatterns: true,
    conversationChunks: { take: 20, orderBy: { createdAt: "desc" } },
    usageCounters: { orderBy: { periodStart: "desc" }, take: 12 },
    scheduledPings: { orderBy: { scheduledAt: "desc" }, take: 20 },
    persona: true,
    memorySummaries: { orderBy: { periodEnd: "desc" }, take: 10 },
    emotionalContexts: { orderBy: { createdAt: "desc" }, take: 20 },
  },
});
```

**DELETE handler:**

```typescript
await prisma.user.delete({ where: { id: params.id } });
// All 16 relations cascade-delete automatically
```

Add confirmation requirement: request body must include `{ confirmEmail: "<user's email>" }`.

### 6.2 Create `app/(admin)/users/[id]/page.tsx`

Use shadcn Tabs with 8 tabs (Profile, Messages, Memories, Events, Emotional, Subscription, Relationship, System).

Each tab renders a table or card layout for its data. Use badges for enums (importance, status, platform, sender).

Top of page: User header card with name, email, platform, tier, created date. Action buttons: "Send Email", "Send Password Reset", "Delete User".

### 6.3 Verify

1. Navigate to a user → all 8 tabs load with data
2. Messages tab shows sender/platform badges
3. Memories tab shows type/importance/pinned status
4. Delete button opens confirmation dialog
5. After delete, user is gone from the users table

---

## Phase 7: Analytics Dashboard

### 7.1 Create API routes

Create these files under `app/api/analytics/`:

**`summary/route.ts`** — Returns:
- Total users: `prisma.user.count()`
- Active today: distinct userIds in Message where sender='user' and sentAt >= today
- Messages today: count where sentAt >= today
- Paid subscribers: count where subscriptionTier != 'free'

**`growth/route.ts`** — User signups grouped by day/week/month. Use raw SQL for date_trunc:
```sql
SELECT date_trunc($1, "createdAt") as period, COUNT(*) as count
FROM "User" GROUP BY period ORDER BY period
```

**`active/route.ts`** — DAU/WAU over last 30 days.

**`messages/route.ts`** — Message count by day, optionally split by platform.

**`tiers/route.ts`** — `prisma.user.groupBy({ by: ['subscriptionTier'], _count: true })`

**`platforms/route.ts`** — `prisma.user.groupBy({ by: ['platform'], _count: true })`

**`usage/route.ts`** — Aggregate UsageCounter sums for the selected period.

**`events/route.ts`** — Top 20 AnalyticsEvent names with counts for the selected period.

### 7.2 Create chart components

Under `components/charts/`:

- `growth-chart.tsx` — Recharts AreaChart
- `active-users-chart.tsx` — Recharts BarChart (dual bars: DAU + WAU)
- `messages-chart.tsx` — Recharts AreaChart (stacked by platform)
- `tier-pie-chart.tsx` — Recharts PieChart/donut
- `platform-bar-chart.tsx` — Recharts BarChart (horizontal)
- `usage-chart.tsx` — Recharts BarChart (stacked: llm, voice, images)

All charts: responsive (`<ResponsiveContainer>`), Vesspr blue (`#1D9EFF`) as primary color, tooltips enabled.

### 7.3 Create `app/(admin)/dashboard/page.tsx`

Layout:
- Top row: 4 summary cards (total users, active today, messages today, paid)
- Controls: date range selector, granularity toggle
- Grid: 2 columns on desktop, 1 on mobile
  - Row 1: User Growth + Active Users
  - Row 2: Message Volume + Tier Distribution
  - Row 3: Platform Distribution + Usage Counters
  - Row 4: Top Analytics Events (table)

### 7.4 Verify

1. Summary cards show correct numbers (cross-check with Prisma Studio)
2. All 7 charts render with real data
3. Changing date range updates charts
4. Charts are responsive on mobile

---

## Phase 8: Email Composer

### 8.1 Create `lib/email.ts`

Copy the `emailShell()` function and brand tokens from `/Users/kshitijpratap/Documents/Projects/Pellow/frontend/lib/email.ts`. Initialize Resend client.

```typescript
import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.EMAIL_FROM || "Vesspr Admin <admin@karooli.ai>";
  await getResend().emails.send({ from, to, subject, html });
}

// Copy emailShell() from Vesspr frontend/lib/email.ts
export function emailShell(opts: { title: string; bodyHtml: string; ctaText?: string; ctaUrl?: string }): string {
  // ... exact copy of the function from the main app
}
```

### 8.2 Create `/api/email/send/route.ts`

POST handler: `{ to, subject, html }` → `sendEmail(to, subject, html)`

### 8.3 Create `/api/users/[id]/email/route.ts`

POST handler with two modes:

```typescript
const { type, subject, body } = await req.json();

if (type === "forgot-password") {
  // Look up user, generate reset token (JWT with purpose: "password-reset", 1hr expiry)
  // Build reset URL: `${VESSPR_APP_URL}/reset-password?token=xxx`
  // Send using emailShell template
}

if (type === "custom") {
  // Send { subject, body } wrapped in emailShell to user's email
}
```

### 8.4 Create `app/(admin)/email/page.tsx`

Two-tab layout (shadcn Tabs):

**Tab 1: Compose Email**
- To: Input with user search (fetch `/api/users?search=...` on type)
- Subject: Input
- Body: Textarea
- Preview: Rendered HTML in an iframe or div (using emailShell)
- Send button

**Tab 2: Password Reset**
- User search/select
- Shows user email + name
- "Send Password Reset" button
- Success/error toast (sonner)

### 8.5 Verify

1. Compose an email → recipient receives it (check with a test email)
2. Email renders with Vesspr branding (gradient header, logo)
3. Password reset sends email with working reset link
4. User search shows results as you type

---

## Phase 9: AWS Costs Dashboard

### 9.1 Create `lib/aws.ts`

```typescript
import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

// Cost Explorer API always uses us-east-1
const client = new CostExplorerClient({ region: "us-east-1" });

// In-memory cache (1hr TTL)
let cache: { data: any; ts: number } | null = null;
const CACHE_TTL = 3600_000;

export async function getAWSCosts(period: "current" | "last" | "total") {
  const cacheKey = period;
  if (cache && cache.ts > Date.now() - CACHE_TTL) return cache.data;

  const now = new Date();
  let start: string, end: string;

  if (period === "current") {
    start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    end = now.toISOString().slice(0, 10);
  } else if (period === "last") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    start = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-01`;
    end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  } else {
    start = "2026-04-01";
    end = now.toISOString().slice(0, 10);
  }

  const cmd = new GetCostAndUsageCommand({
    TimePeriod: { Start: start, End: end },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost"],
    GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
  });

  const result = await client.send(cmd);
  // Parse result.ResultsByTime into { services: [...], total }
  // ...

  cache = { data: parsed, ts: Date.now() };
  return parsed;
}
```

### 9.2 Create `/api/aws/costs/route.ts`

GET handler: query param `period` (current|last|total). Returns service breakdown + total + credits remaining.

Credits remaining = `AWS_CREDIT_TOTAL` env var minus total all-time spend.

### 9.3 Create `app/(admin)/aws/page.tsx`

- Period selector (Current Month, Last Month, All Time)
- Credits remaining card (big number, progress bar)
- Service breakdown table (shadcn Table): Service, Cost, % of Total
- Monthly trend chart (Recharts LineChart, last 6 months)

### 9.4 Verify

1. AWS costs page loads without error (requires valid AWS credentials)
2. Service breakdown matches rough estimates from `13-aws-costs.sh`
3. Credits remaining calculation is correct
4. Switching period updates the data

---

## Phase 10: User Deletion Page

### 10.1 Create `app/(admin)/delete/page.tsx`

- Search bar: find user by email or name
- Results list: show matching users (name, email, tier, message count)
- Select user → show detail card:
  - Name, email, platform, tier
  - Total messages, total memories
  - Created date, last message date
- Confirmation input: "Type the user's email to confirm"
- Delete button: disabled until email matches
- On confirm: DELETE `/api/users/[id]` with `{ confirmEmail }`
- Success: toast + redirect to users list
- Error: toast with error message

### 10.2 Verify

1. Search finds users
2. Cannot delete without typing exact email
3. After delete, user is gone from all tables (check Prisma Studio)
4. Cascade removes Messages, Memories, Events, etc.

---

## Testing Plan

After all phases are complete, run this comprehensive test:

```
## Vesspr Admin Portal — End-to-End Test Plan

### Prerequisites
- Admin portal running: `cd vesspr-admin && npm run dev` (port 3000)
- Vesspr main app database has real user data
- .env.local configured with all required variables

### T1: Authentication
1. Open http://localhost:3000 → VERIFY: redirected to /login
2. Enter random@gmail.com + any password → VERIFY: "Invalid credentials"
3. Enter sachin@karooli.ai + wrong password → VERIFY: "Invalid credentials"
4. Enter sachin@karooli.ai + correct password → VERIFY: redirected to /dashboard
5. Open browser dev tools → Application → Cookies → VERIFY: "vesspr-admin-token" exists, httpOnly=true
6. Click Logout → VERIFY: redirected to /login, cookie cleared
7. Try accessing /api/users without cookie (curl) → VERIFY: 401

### T2: Users Engagement Table
1. Navigate to /users → VERIFY: table loads with user data
2. Switch period to "Daily" → VERIFY: scores change (possibly lower)
3. Switch to "Monthly" → VERIFY: scores change (possibly higher)
4. Click "Score" column header → VERIFY: sorts descending then ascending
5. Type a known user name in search → VERIFY: table filters to matching users
6. Click a user row → VERIFY: navigates to /users/[id]

### T3: User Detail
1. On /users/[id] → VERIFY: user header shows name, email, platform, tier
2. Click each tab (Profile, Messages, Memories, Events, Emotional, Subscription, Relationship, System) → VERIFY: each loads data without error
3. Messages tab → VERIFY: shows sender badges (user/ai) and platform badges
4. Memories tab → VERIFY: shows importance and type badges

### T4: Analytics Dashboard
1. Navigate to /dashboard → VERIFY: 4 summary cards show numbers
2. Cross-check "Total Users" with: SELECT COUNT(*) FROM "User" (via Prisma Studio)
3. VERIFY: All 7 charts render (not empty, not error)
4. Change date range → VERIFY: charts update
5. Resize browser to mobile width → VERIFY: charts stack to single column

### T5: User Deletion
1. Navigate to /delete → search for a TEST user (create one first if needed)
2. Select user → VERIFY: detail card shows
3. Try clicking Delete without typing email → VERIFY: button disabled
4. Type wrong email → VERIFY: button stays disabled
5. Type correct email → VERIFY: button enables
6. Click Delete → VERIFY: success toast
7. Search for deleted user → VERIFY: not found
8. Check Prisma Studio → VERIFY: user gone from User, Message, Memory, etc.

### T6: Email Composer
1. Navigate to /email → Compose tab
2. Search for a user in To field → VERIFY: autocomplete works
3. Fill subject + body → VERIFY: preview renders with Vesspr branding
4. Send → VERIFY: email received (check recipient's inbox)
5. Switch to Password Reset tab → search for a user → click "Send Password Reset"
6. VERIFY: user receives reset email with working link to vesspr.ai/reset-password

### T7: AWS Costs
1. Navigate to /aws → VERIFY: page loads (may take 2-3s for API call)
2. VERIFY: service breakdown table shows AWS services
3. VERIFY: credits remaining shows a number
4. Switch period → VERIFY: data updates
5. Refresh page → VERIFY: loads faster (cached)

### T8: Build Verification
1. npm run build → VERIFY: no TypeScript errors
2. npm run lint → VERIFY: no lint errors

### T9: Security
1. Open incognito browser → go to /dashboard → VERIFY: redirected to /login
2. curl -X DELETE http://localhost:3000/api/users/some-id → VERIFY: 401
3. curl -X POST http://localhost:3000/api/email/send -d '{}' → VERIFY: 401
```

---

## Critical: Schema Drift Management

When the Vesspr main app schema changes:

1. Copy updated `schema.prisma` from `packages/database/prisma/schema.prisma`
2. Re-comment-out the 4 `Unsupported` field lines
3. Run `npx prisma generate`
4. Update any queries that reference new/changed fields

Document this in the admin repo's `README.md`.
