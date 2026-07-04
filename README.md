# Vesspr Admin Portal

Internal admin dashboard for the Vesspr team. Connects to the same Neon PostgreSQL database as the main Vesspr app.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.local.example .env.local

# Generate Prisma client
npx prisma generate

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Features

| Route | Description |
|---|---|
| `/dashboard` | Analytics overview with 7 chart types + summary cards |
| `/users` | User engagement table with period filters and search |
| `/users/[id]` | Full user detail view with 8 data tabs |
| `/email` | Compose emails + send password resets via Resend |
| `/aws` | AWS Cost Explorer integration with credit tracking |
| `/delete` | Safe user deletion with email confirmation |
| `/funnel` | Conversion funnel report, sliced by variant / UTM |
| `/meta-capi-test` | Fires synthetic Meta CAPI events with test_event_code |
| `/meta-capi-backfill` | Re-fires CAPI for purchases in a time window (idempotent) |

## Environment Variables

See `.env.local` for required variables:
- `DATABASE_URL` — Neon pooled PostgreSQL URL
- `ADMIN_EMAILS` — Comma-separated admin allowlist
- `ADMIN_PASSWORD_HASH_*` — bcrypt hashes for each admin
- `ADMIN_JWT_SECRET` — 64-char random hex string
- `RESEND_API_KEY` — For sending emails
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — For Cost Explorer

### Generate a password hash

```bash
node -e "require('bcryptjs').hash('your-password', 12).then(console.log)"
```

### Generate JWT secret

```bash
openssl rand -hex 32
```

## Schema Drift Management

When the Vesspr main app schema changes:

1. Copy updated `schema.prisma` from `packages/database/prisma/schema.prisma`
2. Comment out `Unsupported("vector(384)")` and `Unsupported("tsvector")` fields
3. Run `npx prisma generate`
4. Update any queries referencing new/changed fields

## Meta Ads admin tooling

This admin app hosts all Meta Ads internal tooling:

- `/funnel` — daily conversion funnel report, sliced by variant / UTM
- `/meta-capi-test` — fires synthetic Meta CAPI events with test_event_code
- `/meta-capi-backfill` — re-fires CAPI for purchases in a time window (idempotent)
- `/api/cron/capi-health` — Vercel cron, daily 09:00 UTC, Slack summary

Schema sync: when the Vesspr repo (`packages/database/prisma/schema.prisma`) changes,
this repo's `prisma/schema.prisma` must be re-synced and `npx prisma generate` re-run.
The DDL itself is owned by the Vesspr repo; this repo only mirrors the schema for its
generated client. Do NOT run `prisma migrate` from this repo.

Env vars required:

- `META_CAPI_ACCESS_TOKEN` (mirror of Vesspr)
- `NEXT_PUBLIC_META_PIXEL_ID` (mirror of Vesspr)
- `META_CAPI_TEST_EVENT_CODE` (mirror of Vesspr, staging only)
- `SLACK_WEBHOOK_URL` (for cron)
- `CRON_SECRET` (for cron auth + manual triggers)
- `SENTRY_AUTH_TOKEN`, `SENTRY_PROJECT_SLUG`, `SENTRY_ORG_SLUG` (optional, for cron CAPI failure count)

Token rotation: when the Meta CAPI token is rotated in the Vesspr Vercel project, it MUST
also be rotated here. Both projects share the same Meta App / Pixel.

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS + shadcn/ui
- Prisma 6 (shared Neon PostgreSQL)
- Recharts
- jose (JWT) + bcryptjs (auth)
- Resend (email)
- AWS SDK (Cost Explorer)
