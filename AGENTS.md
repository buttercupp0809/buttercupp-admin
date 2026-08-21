<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Infra and domains

- **Infra is AWS Amplify, not Vercel.** This repo will deploy as a `poppy-admin` Amplify app. Use `aws amplify get-app --app-id <id> --region us-east-1` (and related `aws amplify` subcommands) to inspect production env vars/deploys once deployed.
- **`amplify.yml`'s preBuild step only materializes an explicit allowlist of env var names into `.env.production`** (Next.js SSR on Amplify doesn't otherwise see console-configured env vars at runtime). If you add a new `process.env.X` read anywhere in this app, you MUST also add `X` to the `grep -E '^(...)='` pattern in `amplify.yml`, or it will be `undefined` in production even if it's set correctly in the Amplify console.
- **Database:** The admin connects to the same Neon PostgreSQL instance as the Poppy app. Schema DDL is owned by `poppy/packages/database` — never run `prisma migrate` from this repo.
- **Cookie name:** `poppy-admin-token` (HTTP-only, 24h JWT).
- **No em dashes** anywhere in code, comments, docs, or commit messages.
