# Cursor Prompt 31: Meta Ads Funnel — Admin-side Tooling

> **Parent PRD:** `/Users/kshitijpratap/Documents/Projects/Pellow/Plans/product-prds/master-prd-20.md` (Vesspr repo)
> **Companion (Vesspr side):** `/Users/kshitijpratap/Documents/Projects/Pellow/Plans/cursor-prompts/cursor-prompts-48.md`
> **Repo:** `/Users/kshitijpratap/Documents/Projects/vesspr-admin/` (THIS repo). Do NOT modify anything in the Vesspr repo from these prompts.
> **Scope:** All admin-only Meta Ads tooling. The Vesspr product app handles user-facing pages, the GTM/Pixel injection, the Tally lead webhook, and the production CAPI call from the Dodo webhook. Everything else (funnel dashboard, CAPI test, CAPI backfill, daily CAPI telemetry cron) lives here.

---

## House rules

- **Next.js version drift:** Read `node_modules/next/dist/docs/` before writing any code. App Router only.
- **Prisma:** Reuse `@/lib/prisma`. Never `new PrismaClient()`. The admin app shares the same Neon DB as Vesspr.
- **Auth:** Already enforced by `middleware.ts` via the `vesspr-admin-token` JWT cookie. Do NOT add a second auth layer to any new route. The middleware matcher covers `/api/*` and all non-public pages.
- **No em dashes** anywhere (text, code, comments). Use commas, periods, parentheses.
- **DB migrations:** The DDL for `MarketingLead` and new `User` fields runs ONCE from the Vesspr repo (Phase 0 of PRD 20). Here we only mirror the schema and run `prisma generate`. Do NOT run `prisma migrate dev` from this repo.
- **Env vars:** `META_CAPI_ACCESS_TOKEN`, `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_TEST_EVENT_CODE` must be set on this Vercel project too. They are server-side; treat the access token as a secret.
- **Available shadcn components** (in `components/ui/`): avatar, badge, button, card, dialog, dropdown-menu, input, label, select, separator, sheet, sonner, table, tabs. No Skeleton primitive — use a plain `<div class="animate-pulse bg-muted h-X w-X rounded">` block where you need one.
- **Chart lib:** `recharts` v3 is already installed.

---

## PHASE 0 — Schema sync + env

**Goal:** mirror the Vesspr-side schema additions and document the new env vars. No new admin surface yet.

### Prompt 0.1 — Mirror MarketingLead + User additions

```
The Vesspr repo has just landed (or is about to land) a Prisma migration that adds a MarketingLead model and several fields to User. The DDL is applied to the shared Neon DB by the Vesspr migration. This repo must update its own schema.prisma so the generated client knows about the new tables/columns.

Open vesspr-admin/prisma/schema.prisma.

1. Locate the User model. Add the following fields. Place them near other optional profile fields (do not reorder existing columns):
   - fbp              String?
   - fbc              String?
   - lastClientIp     String?
   - lastUserAgent    String?
   - marketingLeadId  String?  @unique
   - marketingLead    MarketingLead? @relation("MarketingLeadUser")
   - variantId        String?
   - utmSource        String?
   - utmCampaign      String?
   - utmContent       String?

2. Append the new model at the bottom of schema.prisma:

   model MarketingLead {
     id              String   @id @default(cuid())
     source          String   @default("tally")
     variantId       String?
     externalRefId   String?  @unique
     email           String?
     name            String?
     phone           String?
     country         String?
     age             Int?
     utmSource       String?
     utmCampaign     String?
     utmContent      String?
     utmMedium       String?
     utmTerm         String?
     fbp             String?
     fbc             String?
     clientIp        String?
     clientUserAgent String?
     payload         Json?
     userId          String?
     createdAt       DateTime @default(now())
     consumedAt      DateTime?

     user User? @relation("MarketingLeadUser", fields: [userId], references: [id], onDelete: SetNull)

     @@index([userId])
     @@index([variantId])
     @@index([utmCampaign])
     @@index([createdAt])
   }

3. From the vesspr-admin/ directory, run:
   - npx prisma generate

   Do NOT run prisma migrate dev. The DDL is owned by the Vesspr repo's migration, applied once against the shared Neon DB. This repo only needs the regenerated TypeScript client.

4. Verify with a quick repl or a temporary route:
   import { prisma } from "@/lib/prisma";
   await prisma.marketingLead.findMany({ take: 1 });
   // Returns [] without throwing.

Acceptance:
- npm run build succeeds.
- prisma.marketingLead is defined on the generated client.
- prisma.user.findFirst({ include: { marketingLead: true } }) does not throw.
```

### Prompt 0.2 — Env vars

```
Add to vesspr-admin/.env.local (DO NOT commit real values; the file is gitignored):

# Meta CAPI (mirrored from Vesspr Vercel project)
NEXT_PUBLIC_META_PIXEL_ID=
META_CAPI_ACCESS_TOKEN=
META_CAPI_TEST_EVENT_CODE=

# Daily CAPI health cron
SLACK_WEBHOOK_URL=

# Optional: Sentry failure count for daily cron
SENTRY_AUTH_TOKEN=
SENTRY_PROJECT_SLUG=

In Vercel (vesspr-admin project), set the same keys with real values. The CAPI access token is the same one used by the Vesspr project (mirror, do not generate a second token; one token + one Pixel ID for both projects).

Acceptance:
- npm run dev boots locally without errors.
- process.env.META_CAPI_ACCESS_TOKEN reads as non-empty from a quick console.log inside a route.
```

**Sanity gate Phase 0:**
- `npx prisma generate` exits 0.
- `npm run build` succeeds.
- Sidebar still renders without errors (no UI changes yet, just verifying we did not break the build).

---

## PHASE 1 — Funnel dashboard

**Goal:** A `/funnel` page in the existing `(admin)` route group where Growth reads conversion rates sliced by variant and UTM. All data comes from the existing `AnalyticsEvent` table (written to by Vesspr).

### Prompt 1.1 — Funnel API route

```
Create vesspr-admin/app/api/funnel/route.ts.

Auth: already handled by middleware.ts. No extra gate.

GET handler:
1. Parse query params:
   - rangeDays: 7 | 14 | 30 | 90 (default 14). Validate against the allowed set; default if invalid.
   - variantId: optional string ("A" | "B" | "C" | "D" or custom)
   - utmSource: optional string
   - utmCampaign: optional string

2. Build a parameterized raw SQL query against AnalyticsEvent. Schema is: id, userId, eventName, properties (Json), createdAt. JSON access uses `properties->>'key'` syntax in Postgres.

   Use prisma.$queryRaw with the Prisma.sql tagged template (NOT string concatenation) to prevent SQL injection.

   SELECT
     "eventName"                                     AS event_name,
     (properties->>'variant_id')                     AS variant_id,
     (properties->>'utm_source')                     AS utm_source,
     (properties->>'utm_campaign')                   AS utm_campaign,
     DATE("createdAt")                               AS event_date,
     COUNT(DISTINCT "userId")                        AS user_count,
     COUNT(*)                                        AS event_count
   FROM "AnalyticsEvent"
   WHERE "createdAt" >= NOW() - (${rangeDays}::int || ' days')::interval
     AND "eventName" IN ('ad_lead_submit', 'onboarding_started', 'paywall_viewed', 'begin_checkout', 'purchase')
     -- Optional filter clauses applied via Prisma.sql joining
   GROUP BY event_name, variant_id, utm_source, utm_campaign, event_date
   ORDER BY event_date DESC;

3. Transform the rows into:
   {
     rangeDays,
     totals: {
       ad_lead_submit: number,
       onboarding_started: number,
       paywall_viewed: number,
       begin_checkout: number,
       purchase: number,
     },
     conversionRates: {
       lead_to_start: number,
       start_to_paywall: number,
       paywall_to_checkout: number,
       checkout_to_purchase: number,
     },
     byVariant: [{ variantId: string | null, ...totals shape, ...rates shape }],
     byCampaign: [{ utmCampaign: string | null, ...totals shape }],
     daily: [{ date: string, ad_lead_submit, onboarding_started, paywall_viewed, begin_checkout, purchase }],
   }

   Each conversion rate = numerator / denominator * 100, rounded to 1 decimal. Guard against divide-by-zero (return 0).

4. Set response headers:
   - Cache-Control: no-store
   - Content-Type: application/json

5. Return NextResponse.json(payload).

Acceptance:
- curl http://localhost:3000/api/funnel?rangeDays=14 with a valid vesspr-admin-token cookie -> 200 with the shape above.
- Without cookie -> 401 (handled by middleware).
- Sanity-check one number: run SELECT COUNT(*) FROM "AnalyticsEvent" WHERE "eventName" = 'paywall_viewed' AND "createdAt" >= NOW() - INTERVAL '14 days' in psql. The totals.paywall_viewed value should match.
- npm run build passes.
```

### Prompt 1.2 — Funnel page

```
Create vesspr-admin/app/(admin)/funnel/page.tsx.

Pattern: follow vesspr-admin/app/(admin)/dashboard or feedback for layout conventions. Use the existing AdminLayout (inherited via the (admin) route group).

Structure:
1. Server component default export.
   - Reads cookies via next/headers, fetches /api/funnel?rangeDays=14 from the same origin with the cookie forwarded.
   - Renders a header ("Conversion Funnel"), a small "Range: 14d" label, then mounts <FunnelView initial={data} />.

2. Client component vesspr-admin/app/(admin)/funnel/FunnelView.tsx ("use client"):
   - Props: { initial: FunnelResponse }.
   - useState for rangeDays (default 14) and slice ("none" | "variant" | "utm_campaign").
   - useEffect re-fetches /api/funnel?rangeDays=${rangeDays} when rangeDays changes.
   - UI:
     a) Tabs (shadcn) for date range: 7d, 14d, 30d, 90d.
     b) Select (shadcn) for slice dimension: None, By Variant, By Campaign.
     c) Primary funnel table (shadcn Table) with 5 rows: Lead submitted, Onboarding started, Paywall viewed, Checkout started, Purchase. Columns: Step, Users, Conversion (from previous step).
     d) If slice = "variant", render a second Table grouping by variantId with 5 columns matching the steps and one row per variant. Add a "Total" row at the bottom.
     e) If slice = "utm_campaign", same structure grouped by utm_campaign.
     f) Daily trend: recharts LineChart, x-axis = date, one line per step (5 lines, distinct colors). Height ~280px. Use ResponsiveContainer.
   - Loading state during refetch: opacity-50 overlay on the current data (no full unmount; keeps the UI calm).
   - Error state: red text "Could not load funnel data." with a Retry button.

3. Sidebar link. Open vesspr-admin/components/sidebar.tsx and add a new entry to the menu items array (currently lines 24-31). Place it right after Power Users:
   { href: "/funnel", label: "Funnel", icon: TrendingUp }
   Import TrendingUp from lucide-react.

Acceptance:
- Navigate to /funnel as a logged-in admin. The page renders within 1.5s on a warm cache.
- Without a vesspr-admin-token cookie, the middleware redirects to /login.
- Changing the date range via tabs triggers a refetch; counts update.
- Toggling slice to "By Variant" shows the per-variant table; A/B/C/D rows appear if data exists.
- Mobile width (375px Chrome DevTools): no horizontal overflow; the daily LineChart stays inside the viewport.
- npm run build succeeds. npm run lint passes.
```

**Sanity gate Phase 1:**
- The dashboard renders for an admin user, redirects to /login otherwise.
- Numbers match a direct psql count on AnalyticsEvent.
- The "Funnel" link is visible in the sidebar.

---

## PHASE 2 — CAPI test endpoint

**Goal:** A one-click engineering smoke that fires a synthetic Meta CAPI event with `test_event_code` so we can verify Meta Events Manager Test Events tab is receiving from this Vercel project.

### Prompt 2.1 — API route

```
Create vesspr-admin/app/api/meta-capi-test/route.ts.

This does NOT import any code from the Vesspr repo. The Vesspr-side CAPI helper has Sentry integration, retries, and Vesspr-specific paths that are unnecessary here. Inline a minimal Meta Graph v18 POST.

POST handler:
1. Read process.env: META_CAPI_ACCESS_TOKEN, NEXT_PUBLIC_META_PIXEL_ID, META_CAPI_TEST_EVENT_CODE.
   If any is unset, return NextResponse.json({ error: "Missing META_CAPI_* env" }, { status: 503 }).

2. Parse body:
   {
     eventName: "Purchase" | "Lead" | "InitiateCheckout" | "AddPaymentInfo" | "StartTrial" | "Subscribe",
     email?: string,
     value?: number,
     currency?: string,
   }

3. Build the payload:

   import { createHash } from "node:crypto";
   const sha = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

   const body = {
     data: [{
       event_name: eventName,
       event_time: Math.floor(Date.now() / 1000),
       event_id: `admin_test_${Date.now()}`,
       action_source: "website",
       event_source_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.vesspr.ai"}/onboard/payment?payment=returned`,
       user_data: email ? { em: [sha(email)] } : {},
       custom_data: { value: value ?? 1, currency: (currency ?? "USD").toUpperCase() },
     }],
     test_event_code: process.env.META_CAPI_TEST_EVENT_CODE, // always included on this endpoint
   };

4. POST to Meta with an AbortController 4s timeout:
   const url = `https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
   const res = await fetch(url, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(body),
     signal: AbortSignal.timeout(4000),
   });
   const text = await res.text();

5. Return Meta's response verbatim:
   return NextResponse.json({ status: res.status, body: text, requestPayload: body }, { status: 200 });

6. On exceptions (network, abort), return { status: 0, error: e.message } with status 502.

Acceptance:
- curl -X POST -H "Content-Type: application/json" -d '{"eventName":"Purchase","email":"test@example.com","value":39,"currency":"USD"}' -H "Cookie: vesspr-admin-token=..." http://localhost:3000/api/meta-capi-test
- Meta Events Manager Test Events tab shows the Purchase event within 10s.
- Missing token in env -> 503 with explanatory message.
- Without cookie -> 401 (middleware).
```

### Prompt 2.2 — UI page

```
Create vesspr-admin/app/(admin)/meta-capi-test/page.tsx.

Pure client UI; no server data needed.

Layout:
- Header: "Meta CAPI test"
- Subtext: "Fires a synthetic Meta event with test_event_code attached. Check Meta Events Manager > Test Events tab to confirm receipt."
- Form (shadcn):
  - Select (eventName): Purchase, Lead, InitiateCheckout, AddPaymentInfo, StartTrial, Subscribe (default Purchase)
  - Input (email, type=email, optional)
  - Input (value, type=number, default 39)
  - Input (currency, default USD)
  - Button "Fire test event"
- On submit: POST to /api/meta-capi-test with the form fields.
- Below the form, render the response (status code, body, requestPayload) in a <pre> with mono font and small text. Use a green border when status === 200, red otherwise.
- toast.success("Test event fired") on 200; toast.error(body) on non-200.

Sidebar: add a new entry to vesspr-admin/components/sidebar.tsx:
   { href: "/meta-capi-test", label: "CAPI Test", icon: Send }
Import Send from lucide-react. Place this in a logical position; if there is a "Tools" / "Diagnostics" grouping use it, otherwise after the Funnel link.

Acceptance:
- Visit /meta-capi-test as an admin. The page renders.
- Submitting the form with default values returns a green-bordered response containing { events_received: 1 }.
- Meta Events Manager Test Events shows the event within 10s.
- Mobile width 375px: no horizontal overflow.
```

**Sanity gate Phase 2:**
- The test endpoint works end-to-end from the admin UI.
- No shared CAPI helper imported from Vesspr.
- npm run build clean.

---

## PHASE 3 — CAPI backfill endpoint

**Goal:** Re-fire CAPI for `purchase` events where the original production webhook call to Meta failed (token rotation outage, network blip, etc.). Idempotent via Meta's `event_id` dedup.

### Prompt 3.1 — API route

```
Create vesspr-admin/app/api/meta-capi-backfill/route.ts.

Strategy:
- We do not maintain a "capi_failed" boolean in the DB (over-engineered for v1).
- Backfill takes a `since` query param. It re-fires CAPI for ALL "purchase" AnalyticsEvent rows in [since, now]. Meta dedupes against any prior successful send via event_id, so re-firing is idempotent.

POST handler:
1. Read env: META_CAPI_ACCESS_TOKEN, NEXT_PUBLIC_META_PIXEL_ID. Return 503 if missing.
2. Parse query params:
   - since: ISO 8601 string (required). Reject 400 if invalid or older than 7 days (safety rail; backfilling old data has limited Meta attribution value).
   - dryRun: "true" | "false" (default "false").
   - limit: integer 1..1000 (default 500). Hard cap at 1000 per call.

3. Query AnalyticsEvent:
   const rows = await prisma.analyticsEvent.findMany({
     where: { eventName: "purchase", createdAt: { gte: new Date(since) } },
     orderBy: { createdAt: "asc" },
     take: limit,
   });

4. For each row, load the User by row.userId (skip if null) with the marketingLead relation included.

5. Build a CAPI Purchase payload per user. Hash PII (email, phone lowercased trimmed; phone digits-only; first_name, last_name, country lowercased) with SHA-256. Pull non-hashed fields directly: fbp, fbc, client_ip_address, client_user_agent (prefer User fields, fall back to marketingLead).

6. CRITICAL: use the ORIGINAL event_id from row.properties.event_id so Meta dedups against any prior successful send. If properties.event_id is missing, generate `backfill_${row.id}` and log a warning to the response (these will NOT dedup with client-side events).

7. POST each event to https://graph.facebook.com/v18.0/{pixel_id}/events?access_token=... serially with a 200ms sleep between calls. Timeout 4s per call.

8. Counters: { attempted, succeeded, failed, missingEventId, skipped_no_user }.

9. If dryRun=true, build the full payload list but do NOT call Meta. Return what would have been sent (first 3 payloads as a sample).

10. Do NOT attach test_event_code on backfill (these are real conversions; we want them counted in the real Meta dashboard).

11. Return:
    {
      rangeStart: since,
      rangeEnd: now ISO,
      dryRun,
      counters: { attempted, succeeded, failed, missingEventId, skipped_no_user },
      errors: [first 10 error response bodies, each { eventId, status, body }],
      samplePayloads?: [first 3 if dryRun],
    }

Acceptance:
- Dry run on a 1h window with at least one real purchase returns sensible counts and 3 sample payloads.
- Live run on the same window pushes events to Meta. Meta Events Manager Diagnostics shows them merged (no duplicates) provided event_id was preserved.
- Backfill of a window with zero purchases returns { attempted: 0, succeeded: 0, failed: 0 }.
- Invalid since (> 7 days ago, or unparseable) returns 400 with a clear message.
- Missing token -> 503.
```

### Prompt 3.2 — UI page

```
Create vesspr-admin/app/(admin)/meta-capi-backfill/page.tsx.

Layout:
- Header: "CAPI backfill"
- Subtext: "Re-fires CAPI for purchase events in a time window. Idempotent via Meta event_id dedup. Use this after a CAPI outage to recover signal."
- Form:
  - Input (since, type=datetime-local, default = 6 hours ago)
  - Input (limit, type=number, default 500, min 1, max 1000)
  - Checkbox (dryRun, default checked) with label "Dry run (don't actually call Meta)"
  - Button "Run backfill" (variant=destructive if dryRun is unchecked, default variant when checked)
- On submit: POST to /api/meta-capi-backfill with query params.
- Result panel below:
  - Counters as 4 cards (Attempted, Succeeded, Failed, Missing Event ID)
  - If dryRun, show sample payloads in <pre>
  - If errors, list them (eventId, status, truncated body 200 chars)
- toast.success on 200; toast.error on 4xx/5xx.
- Confirm dialog (shadcn) when dryRun is unchecked AND limit > 100, to prevent accidental large runs.

Sidebar: add an entry in vesspr-admin/components/sidebar.tsx:
   { href: "/meta-capi-backfill", label: "CAPI Backfill", icon: RefreshCw }
Import RefreshCw from lucide-react.

Acceptance:
- Visit /meta-capi-backfill as an admin. Page renders.
- Dry run on the last 6 hours: counters populated, sample payloads visible, no Meta call.
- Live run on a known-affected window: counters succeed, Meta Events Manager shows the events without creating duplicates of prior successful sends.
- Confirm dialog appears for live runs over 100 events.
- Mobile width 375px: no overflow.
```

**Sanity gate Phase 3:**
- Dry run works on a small window with real data.
- Live run is idempotent (re-running it does not double-count in Meta).
- Confirm dialog prevents accidental large live runs.

---

## PHASE 4 — Daily CAPI health cron

**Goal:** A Vercel cron that fires daily at 09:00 UTC, counts last-24h funnel events from `AnalyticsEvent`, optionally pulls CAPI failure count from Sentry, and posts a one-line Slack summary.

### Prompt 4.1 — Cron route

```
Create vesspr-admin/app/api/cron/capi-health/route.ts.

GET handler (Vercel cron sends GET requests):
1. Validate the request is from Vercel cron. Vercel adds an `x-vercel-cron` header on cron invocations (value is the cron path). If the header is absent AND req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`, return 401.
   (Add CRON_SECRET to the env so a manual curl can also trigger this for testing.)

2. Define the lookback window: last 24h. Compute since = new Date(Date.now() - 24*60*60*1000).

3. Count events from AnalyticsEvent grouped by eventName, for the set we care about:
   const counts = await prisma.analyticsEvent.groupBy({
     by: ["eventName"],
     where: { createdAt: { gte: since }, eventName: { in: ["ad_lead_submit", "onboarding_started", "paywall_viewed", "begin_checkout", "purchase", "trial_started"] } },
     _count: { _all: true },
   });
   Reduce to a plain object: { purchase: 12, trial_started: 4, begin_checkout: 33, paywall_viewed: 90, ad_lead_submit: 250, onboarding_started: 60 }.

4. (Optional) Query Sentry for "Meta CAPI failure:" warning count in the last 24h:
   - If SENTRY_AUTH_TOKEN and SENTRY_PROJECT_SLUG are unset, skip silently.
   - Otherwise GET https://sentry.io/api/0/projects/{org}/{project}/events/?query=message:"Meta CAPI failure"&statsPeriod=24h
     with Authorization: Bearer ${SENTRY_AUTH_TOKEN}. Count the items array length (Sentry caps at 100, that is fine).
   - On Sentry error, log and continue; do NOT fail the cron.

5. Post to Slack:
   - If SLACK_WEBHOOK_URL is unset, log a warning and return { ok: true, posted: false, counts }.
   - Otherwise POST:
     {
       text: `CAPI 24h: ${purchase} purchases, ${trial_started} trials, ${begin_checkout} checkouts, ${paywall_viewed} paywall views, ${ad_lead_submit} leads. CAPI failures (Sentry): ${capiFailures ?? "n/a"}.`
     }
   - Timeout 4s.

6. Return NextResponse.json({ ok: true, posted: true, counts, capiFailures }).

Acceptance:
- curl with Authorization: Bearer $CRON_SECRET hits the route and posts to Slack.
- curl without auth -> 401.
- Without SLACK_WEBHOOK_URL set, route returns ok=true with posted=false.
- Cron metrics visible in Vercel dashboard after deploy.
```

### Prompt 4.2 — Register the cron

```
Create vesspr-admin/vercel.json if it does not already exist. If it exists, merge the crons array.

{
  "crons": [
    { "path": "/api/cron/capi-health", "schedule": "0 9 * * *" }
  ]
}

Notes:
- Vercel cron schedules use standard cron syntax. "0 9 * * *" = 09:00 UTC daily.
- Vercel cron is only triggered on production deployments. Preview deploys do NOT trigger crons. Verify after first prod deploy.
- The cron timeout is 10s on Hobby, 60s on Pro. Our route should comfortably finish in under 5s.

Acceptance:
- After next prod deploy, "Cron Jobs" appears under the project's Settings tab in Vercel with /api/cron/capi-health listed.
- The next 09:00 UTC fires and posts a Slack message (verify in Slack and in Vercel cron logs).
```

**Sanity gate Phase 4:**
- Cron route works locally via curl with CRON_SECRET.
- vercel.json registered, cron visible in Vercel dashboard post-deploy.
- Slack receives the daily summary once live.

---

## PHASE 5 — Documentation + final verification

### Prompt 5.1 — Operations note

```
Append a section to vesspr-admin/README.md (or create vesspr-admin/plans/meta-ads-admin-ops.md if you prefer to keep README short):

## Meta Ads admin tooling

This admin app hosts all Meta Ads internal tooling:

- /funnel — daily conversion funnel report, sliced by variant / UTM
- /meta-capi-test — fires synthetic Meta CAPI events with test_event_code
- /meta-capi-backfill — re-fires CAPI for purchases in a time window (idempotent)
- /api/cron/capi-health — Vercel cron, daily 09:00 UTC, Slack summary

Schema sync: when the Vesspr repo (Pellow/packages/database/prisma/schema.prisma) changes,
this repo's vesspr-admin/prisma/schema.prisma must be re-synced and `npx prisma generate`
re-run. The DDL itself is owned by the Vesspr repo; this repo only mirrors the schema for
its generated client.

Env vars required:
- META_CAPI_ACCESS_TOKEN (mirror of Vesspr)
- NEXT_PUBLIC_META_PIXEL_ID (mirror of Vesspr)
- META_CAPI_TEST_EVENT_CODE (mirror of Vesspr, staging only)
- SLACK_WEBHOOK_URL (for cron)
- CRON_SECRET (for cron auth + manual triggers)
- SENTRY_AUTH_TOKEN, SENTRY_PROJECT_SLUG (optional, for cron CAPI failure count)

Token rotation: when the Meta CAPI token is rotated in the Vesspr Vercel project, it MUST
also be rotated here. Both projects share the same Meta App / Pixel.
```

### Prompt 5.2 — Final acceptance walk

```
End-to-end verification (run after deploy):

1. Schema sync. Visit a temporary route or run a one-off:
   await prisma.marketingLead.findMany({ take: 1 });
   await prisma.user.findFirst({ include: { marketingLead: true } });
   Both succeed.

2. Funnel.
   - Visit /funnel as a logged-in admin. Page renders within 1.5s.
   - Change date range to 7d / 30d / 90d. Data refreshes.
   - Slice by Variant. Per-variant table appears.
   - Cross-check: pick one cell, run the matching SQL in psql, confirm the count matches.

3. CAPI test.
   - Visit /meta-capi-test. Submit a Purchase event with a test email.
   - Meta Events Manager > Test Events tab shows the event within 10s.

4. CAPI backfill.
   - Dry-run on the last 6 hours. Counters reasonable, sample payloads visible.
   - Live-run on a known small window. Meta Diagnostics shows events without duplication.

5. Cron.
   - Trigger manually:
     curl -H "Authorization: Bearer $CRON_SECRET" https://<vesspr-admin-host>/api/cron/capi-health
   - Slack receives the summary.
   - Verify cron is registered in Vercel project Settings -> Cron Jobs.

6. Auth.
   - Open any /funnel, /meta-capi-test, /meta-capi-backfill route in incognito. Middleware redirects to /login.

All 6 ticked.
```

**Sanity gate Phase 5:**
- README / ops note committed.
- All 6 verification items pass.

---

## Cross-references

Vesspr product app (`/Users/kshitijpratap/Documents/Projects/Pellow`):
- Parent PRD: `Plans/product-prds/master-prd-20.md`
- Vesspr-side prompts: `Plans/cursor-prompts/cursor-prompts-48.md`
- Production CAPI helper: `frontend/lib/marketing/meta-capi.ts` (called from the Dodo webhook only)
- Tally webhook (must stay in Vesspr, same-origin with onboarding): `frontend/app/api/ad-lead/route.ts`
- Webhook entry point: `frontend/app/api/webhooks/dodo/route.ts` -> `frontend/lib/payments/webhooks/shared.ts`
- AnalyticsEvent schema source of truth: `packages/database/prisma/schema.prisma`

Admin app (THIS repo):
- Funnel: `app/(admin)/funnel/page.tsx`, `app/api/funnel/route.ts`
- CAPI test: `app/(admin)/meta-capi-test/page.tsx`, `app/api/meta-capi-test/route.ts`
- CAPI backfill: `app/(admin)/meta-capi-backfill/page.tsx`, `app/api/meta-capi-backfill/route.ts`
- Cron: `app/api/cron/capi-health/route.ts`, `vercel.json`
- Schema mirror: `prisma/schema.prisma`
- Sidebar: `components/sidebar.tsx`
- Auth: `middleware.ts`, `lib/auth.ts`
- DB client: `lib/prisma.ts`

Design philosophy:
- Anything a teammate is the only consumer of belongs here, not in Vesspr.
- The Vesspr product app carries only code that ships to end users or runs as part of the user-facing request path (Dodo webhook + Tally webhook + the CAPI helper they call).
- When in doubt: if it would be sad to delete on the user-facing bundle, it goes here.
