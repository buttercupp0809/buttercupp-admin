/**
 * lib/nurture/token.ts
 *
 * Unsubscribe token minting.
 *
 * A token is an HMAC-SHA256 over the userId, keyed by UNSUBSCRIBE_SECRET env
 * var (falls back to CRON_SECRET, then ADMIN_JWT_SECRET). Its only job is to be
 * an unguessable, high-entropy string that we store in the @unique
 * User.unsubscribeToken column at first-send time.
 *
 * Verification is done by the DB lookup, NOT by re-deriving the HMAC. Because
 * User.unsubscribeToken is @unique, a lookup by token authoritatively resolves
 * exactly one user. Re-deriving the HMAC at verify time would break every
 * previously-issued unsubscribe link the moment the secret is rotated, so we
 * deliberately do not do it (see app/api/unsubscribe/route.ts). Rotating the
 * secret only changes what future tokens look like; already-stored tokens keep
 * working.
 */

import { createHmac } from "crypto";

function getSecret(): string {
  const s =
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.CRON_SECRET ??
    process.env.ADMIN_JWT_SECRET;
  if (!s) {
    throw new Error(
      "No signing secret found. Set UNSUBSCRIBE_SECRET, CRON_SECRET, or ADMIN_JWT_SECRET."
    );
  }
  return s;
}

/**
 * Mint a stable HMAC token for a given userId.
 * The token is URL-safe base64, 43 chars.
 */
export function generateUnsubscribeToken(userId: string): string {
  const mac = createHmac("sha256", getSecret())
    .update(`unsub:${userId}`)
    .digest("base64url");
  return mac;
}
