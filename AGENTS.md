<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Infra and domains

- **Infra is AWS Amplify, not Vercel.** This repo deploys as the `vesspr-admin` Amplify app (`d3qs3x3q0ytx44`, `us-east-1`), built via the `amplify.yml` at the repo root. Vercel projects may exist under the team's account for historical reasons, but they are not the live deployment — don't use `vercel env`/`vercel deploy`/`vercel domains` to inspect or change real production config for this repo, or for the Pellow/Vesspr frontend (`vespr-frontend`, `d2d3rajrn9c4ki`, also AWS Amplify). Use `aws amplify get-app --app-id <id> --region us-east-1` (and related `aws amplify` subcommands) to inspect real production env vars/deploys.
- **`amplify.yml`'s preBuild step only materializes an explicit allowlist of env var names into `.env.production`** (Next.js SSR on Amplify doesn't otherwise see console-configured env vars at runtime). If you add a new `process.env.X` read anywhere in this app, you MUST also add `X` to the `grep -E '^(...)='` pattern in `amplify.yml`, or it will be `undefined` in production even if it's set correctly in the Amplify console.
- **Canonical brand domain is `vesspr.ai` (double-s), split across two subdomains**: `app.vesspr.ai` is the product itself (the Pellow/Vesspr frontend — onboarding, `/onboard/payment`, magic-link destinations, `/reset-password`), `www.vesspr.ai` is the separate marketing website. Any URL this admin app builds for a real user (password reset links, preview links, etc.) must point at `app.vesspr.ai`, never the bare apex `vesspr.ai` or `www.vesspr.ai`. The single-s `vespr.ai` and the `.app` TLD (`vesspr.app`) are not ours — historical typos.
