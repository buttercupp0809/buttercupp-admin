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

## Tech Stack

- Next.js 16 (App Router)
- Tailwind CSS + shadcn/ui
- Prisma 6 (shared Neon PostgreSQL)
- Recharts
- jose (JWT) + bcryptjs (auth)
- Resend (email)
- AWS SDK (Cost Explorer)
