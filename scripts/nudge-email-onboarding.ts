#!/usr/bin/env npx tsx
/**
 * nudge-email-onboarding.ts  First-touch invitation campaign
 *
 * Sends the same dark cinematic email as nudge-email.ts, but targets free-tier
 * users who signed up and NEVER completed onboarding (so they have no
 * conversation and no character of their own). Each user is assigned a RANDOM
 * public character from the DB, who speaks to them as someone they haven't met
 * yet. The CTA points to /onboarding to finish signing up.
 *
 * Usage:
 *   npx tsx scripts/nudge-email-onboarding.ts --dry-run
 *   npx tsx scripts/nudge-email-onboarding.ts --test you@example.com
 *   npx tsx scripts/nudge-email-onboarding.ts --bulk [--limit N]
 *
 * Eligibility: free tier, completedOnboardingAt IS NULL, not hidden.
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Brand logo — Buttercupp lockup PNG, sent as a CID inline attachment.
// Gmail strips data: URIs (svg AND png) and remote SVG, so the reliable path is
// an inline attachment referenced in HTML as <img src="cid:LOGO_CID">.
// ---------------------------------------------------------------------------
const LOGO_CID = "buttercupp-logo";
const LOGO_PNG_PATH = path.resolve(__dirname, "../public/brand/lockup-dark.png");
const LOGO_PNG_BUFFER: Buffer | null = (() => {
  try {
    return fs.readFileSync(LOGO_PNG_PATH);
  } catch {
    return null;
  }
})();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FROM_ADDRESS = "admin@buttercupp.fun";
const REPLY_TO = "admin@buttercupp.fun";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.buttercupp.fun").replace(/\/$/, "");
const CLOUDFRONT_URL = (process.env.CLOUDFRONT_URL ?? "").replace(/\/$/, "");
const HIDDEN_USER_IDS = ["b0926f59-f5d1-4280-b462-944425549aea"];

// Character pool size to draw random assignments from (top public characters).
const POOL_SIZE = 200;

// Brand tokens
const DARK_BG = "#1A0900";
const OUTER_BG = "#F7F1E6"; // warm cream — the page area around the dark card
const AMBER = "#FC9908";
const TEXT_WHITE = "#FFFFFF";
const TEXT_DIM = "rgba(255,255,255,0.72)";
const TEXT_MUTED = "rgba(255,255,255,0.40)";

const BODY_FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const HEADING_FONT =
  "'Satoshi','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isBulk = args.includes("--bulk");
const testIdx = args.indexOf("--test");
const testAddress = testIdx !== -1 ? args[testIdx + 1] : null;
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 0;

if (!isDryRun && !isBulk && !testAddress) {
  console.error(
    "Usage:\n" +
    "  npx tsx scripts/nudge-email-onboarding.ts --dry-run\n" +
    "  npx tsx scripts/nudge-email-onboarding.ts --test you@example.com\n" +
    "  npx tsx scripts/nudge-email-onboarding.ts --bulk [--limit N]"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);
const s3 = new S3Client({ region: process.env.POPPY_S3_REGION ?? "eu-north-1" });

// ---------------------------------------------------------------------------
// Image URL resolution (presigned S3 URLs — 7-day expiry)
// ---------------------------------------------------------------------------

function bucketForKey(key: string): string {
  if (key.startsWith("images/")) return process.env.POPPY_S3_BUCKET_GENERATED ?? "";
  if (key.startsWith("reels/")) return process.env.POPPY_S3_BUCKET_REELS ?? "";
  return process.env.S3_BUCKET ?? "";
}

async function resolveImageUrl(raw: string | null | undefined): Promise<string> {
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    if (CLOUDFRONT_URL && raw.includes("amazonaws.com")) {
      const key = raw.replace(/^https?:\/\/[^/]+\//, "");
      return `${CLOUDFRONT_URL}/${key}`;
    }
    return raw;
  }
  const bucket = bucketForKey(raw);
  if (!bucket) return CLOUDFRONT_URL ? `${CLOUDFRONT_URL}/${raw}` : raw;
  try {
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: raw });
    return await getSignedUrl(s3, cmd, { expiresIn: 7 * 24 * 3600 });
  } catch {
    return CLOUDFRONT_URL ? `${CLOUDFRONT_URL}/${raw}` : raw;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstSentences(text: string, max = 1): string {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, max)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Copy generation — FIRST-TOUCH. The character has never met the user, so the
// copy is framed as an introduction / invitation, not a "come back".
// ---------------------------------------------------------------------------

interface CharCtx {
  name: string; bio: string; gender: string;
  greeting: string; personality: string; backstory: string;
  imageUrl: string;
}
interface UserCtx {
  displayName: string | null; email: string; characterId: string;
}

function buildCopy(char: CharCtx, user: UserCtx) {
  const firstName = user.displayName?.split(" ")[0] ?? user.email.split("@")[0];
  const pl = (char.personality + " " + char.backstory).toLowerCase();

  const isFlirty  = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isMystery = /mysterious|dark|enigma|shadow|secret|hidden/.test(pl);
  const isCaring  = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);

  const greetingSnip = firstSentences(char.greeting, 1);

  if (isFlirty) return {
    subject: `I've been hoping you'd show up, ${firstName}`,
    preheader: "You signed up and then disappeared on me. I noticed.",
    lines: [
      `So you're the one I've been curious about. You made an account and then vanished before we ever got to talk.`,
      `That's a little cruel, don't you think? I don't get excited about just anyone.`,
      greetingSnip
        ? `The first thing I want to say to you is this: <em>"${esc(greetingSnip)}"</em>`
        : `I already have a feeling about you. Come find out if I'm right.`,
      `Finish setting things up and come find me. I've been waiting.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. It only takes a minute to pick up where you left off.</span>`,
    ],
    cta: "Come meet me",
    signature: char.name,
  };

  if (isMystery) return {
    subject: `We haven't met yet, but I already know`,
    preheader: "You started something. You didn't finish. I've been waiting.",
    lines: [
      `You slipped in quietly and then left before we crossed paths. I noticed anyway.`,
      `There's a version of this where we never meet. I don't like that version.`,
      greetingSnip
        ? `When we do talk, the first thing I'll tell you is: <em>"${esc(greetingSnip)}"</em>`
        : `There's something I've been holding onto for the right person. Come see if it's you.`,
      `Finish what you started. I'll be waiting on the other side.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. One minute is all it takes to begin.</span>`,
    ],
    cta: "Begin our story",
    signature: char.name,
  };

  if (isCaring) return {
    subject: `I noticed you never finished, ${firstName}`,
    preheader: "You got so close. I saved your spot.",
    lines: [
      `Hey ${esc(firstName)}, you signed up but never quite made it to the part where we actually meet.`,
      `No worries at all. Life gets busy. I just wanted you to know I'm here whenever you're ready.`,
      greetingSnip
        ? `When we talk, the first thing I want to say is: <em>"${esc(greetingSnip)}"</em>`
        : `I have a feeling we'd get along. I'd love the chance to find out.`,
      `It only takes a minute to finish. I'll be right here waiting for you.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. Your spot is still saved. Come say hi.</span>`,
    ],
    cta: "Finish and say hi",
    signature: char.name,
  };

  return {
    subject: `I've been waiting to meet you`,
    preheader: "You signed up but we never actually got to talk.",
    lines: [
      `Hey ${esc(firstName)},`,
      `You made an account but never finished, so we haven't actually met yet. I'd really like to change that.`,
      greetingSnip
        ? `The first thing I want to say to you is: <em>"${esc(greetingSnip)}"</em>`
        : `I have a feeling our first conversation would be a good one. Come find out.`,
      `Finish setting up and let's finally talk. I'll be here.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. It only takes a minute to pick up where you left off.</span>`,
    ],
    cta: "Let's meet",
    signature: char.name,
  };
}

// ---------------------------------------------------------------------------
// Email HTML — identical dark cinematic design to nudge-email.ts
// ---------------------------------------------------------------------------

function buildHtml(
  char: CharCtx,
  user: UserCtx,
  copy: ReturnType<typeof buildCopy>,
  ctaUrl: string,
  isTest: boolean
): string {
  const year = new Date().getFullYear();

  const heroBlock = char.imageUrl
    ? `<tr>
        <td style="padding:0;
                   background-color:${DARK_BG};
                   background-image:url('${char.imageUrl}');
                   background-size:cover;
                   background-position:center top;
                   background-repeat:no-repeat;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="height:500px;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td style="background:linear-gradient(to bottom, rgba(26,9,0,0) 0%, rgba(26,9,0,0.92) 60%, ${DARK_BG} 100%);
                         padding:32px 28px 20px;">
                <h2 style="margin:0 0 6px;font-size:28px;font-weight:700;
                            color:${TEXT_WHITE};font-family:${HEADING_FONT};
                            letter-spacing:-0.4px;line-height:1.15;">
                  ${esc(char.name)}
                </h2>
                <p style="margin:0;font-size:14px;line-height:1.5;
                           color:${TEXT_DIM};font-family:${BODY_FONT};">
                  ${esc(firstSentences(char.bio, 1))}
                </p>
              </td>
            </tr>
          </table>
        </td>
       </tr>`
    : `<tr>
        <td style="padding:44px 28px 20px;
                   background:linear-gradient(160deg, #3D1F00 0%, ${DARK_BG} 100%);">
          <h2 style="margin:0 0 6px;font-size:28px;font-weight:700;
                     color:${TEXT_WHITE};font-family:${HEADING_FONT};letter-spacing:-0.4px;">
            ${esc(char.name)}
          </h2>
          <p style="margin:0;font-size:14px;color:${TEXT_DIM};font-family:${BODY_FONT};">
            ${esc(firstSentences(char.bio, 1))}
          </p>
        </td>
       </tr>`;

  const messageLines = copy.lines
    .map(
      (line) =>
        `<p style="margin:0 0 18px;font-size:16px;line-height:28px;
                   color:${TEXT_DIM};font-family:${BODY_FONT};">
           ${line}
         </p>`
    )
    .join("");

  const footerEmail = isTest
    ? `<em>[test send]</em>`
    : `<strong style="color:rgba(255,255,255,0.55);">${esc(user.email)}</strong>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${esc(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${OUTER_BG};
             font-family:${BODY_FONT};-webkit-text-size-adjust:100%;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;">
    ${esc(copy.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${OUTER_BG};">
    <tr>
      <td align="center" style="padding:32px 12px 48px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:${DARK_BG};
                      border-radius:20px;overflow:hidden;">

          <!-- ── Buttercupp logo — CID inline attachment ── -->
          <tr>
            <td style="padding:22px 24px 18px;background:${DARK_BG};text-align:center;">
              ${LOGO_PNG_BUFFER
                ? `<img src="cid:${LOGO_CID}" width="180" height="54" alt="Buttercupp"
                        style="display:inline-block;width:180px;height:54px;border:0;"/>`
                : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;font-family:${HEADING_FONT};">
                     <span style="color:${AMBER};">Butter</span><span style="color:${TEXT_WHITE};">cupp</span>
                   </span>`}
            </td>
          </tr>

          ${heroBlock}

          <!-- ── Character message ───────────────────── -->
          <tr>
            <td style="padding:26px 28px 8px;background:${DARK_BG};">
              ${messageLines}
              <p style="margin:20px 0 0;font-size:16px;line-height:24px;
                         color:${TEXT_DIM};font-family:${BODY_FONT};font-style:italic;">
                Waiting for you,<br/>
                <strong style="font-style:normal;color:${TEXT_WHITE};">
                  ${esc(copy.signature)}
                </strong>
              </p>
            </td>
          </tr>

          <!-- ── Amber CTA button ────────────────────── -->
          <tr>
            <td style="padding:28px 28px 8px;background:${DARK_BG};text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0"
                     border="0" align="center">
                <tr>
                  <td style="border-radius:28px;background:${AMBER};">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 48px;
                              color:#1A0700;text-decoration:none;border-radius:28px;
                              font-weight:700;font-size:16px;
                              font-family:${BODY_FONT};letter-spacing:-0.2px;">
                      ${esc(copy.cta)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Divider ─────────────────────────────── -->
          <tr>
            <td style="padding:28px 28px 0;background:${DARK_BG};">
              <div style="border-top:1px solid rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <!-- ── Footer ──────────────────────────────── -->
          <tr>
            <td style="padding:16px 28px 28px;background:${DARK_BG};text-align:center;">
              <p style="margin:0;font-size:12px;line-height:20px;
                         color:${TEXT_MUTED};font-family:${BODY_FONT};">
                You have a Buttercupp account at ${footerEmail}.<br/>
                <a href="${APP_URL}/settings/notifications"
                   style="color:${TEXT_MUTED};text-decoration:underline;">
                  Manage notifications
                </a>
                &nbsp;&middot;&nbsp;
                <a href="${APP_URL}/unsubscribe"
                   style="color:${TEXT_MUTED};text-decoration:underline;">
                  Unsubscribe
                </a>
              </p>
              <p style="margin:6px 0 0;font-size:11px;
                         color:rgba(255,255,255,0.18);font-family:${BODY_FONT};">
                Buttercupp &copy; ${year}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

type PoolCharacter = Awaited<ReturnType<typeof fetchCharacterPool>>[number];

// Public, approved characters that have at least one image + a current version.
async function fetchCharacterPool() {
  const chars = await prisma.character.findMany({
    where: {
      visibility: "public",
      moderationStatus: "approved",
      currentVersionId: { not: null },
      media: { some: { kind: "image", hidden: false } },
    },
    include: {
      media: {
        where: { kind: "image", hidden: false },
        orderBy: [{ isDisplay: "desc" }, { isPrimary: "desc" }, { sort: "asc" }],
        take: 1,
      },
      currentVersion: {
        select: { personality: true, backstory: true, greeting: true },
      },
    },
    orderBy: { popularityScore: "desc" },
    take: POOL_SIZE,
  });
  // Belt and suspenders: only keep those that actually resolved an image row.
  return chars.filter((c) => c.media.length > 0);
}

// Free-tier users who never completed onboarding.
async function fetchNonOnboardedUsers(cap: number) {
  const users = await prisma.user.findMany({
    where: {
      subscriptionTier: "free",
      completedOnboardingAt: null,
      id: { notIn: HIDDEN_USER_IDS },
    },
    select: {
      id: true,
      email: true,
      profile: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    ...(cap > 0 ? { take: cap } : {}),
  });
  return users;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Send one email
// ---------------------------------------------------------------------------

async function sendNudge(
  user: Awaited<ReturnType<typeof fetchNonOnboardedUsers>>[number],
  character: PoolCharacter,
  overrideTo?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const imageUrl = await resolveImageUrl(character.media[0]?.url ?? null);

  const char: CharCtx = {
    name: character.name,
    bio: character.bio,
    gender: character.gender,
    greeting: character.currentVersion?.greeting ?? "",
    personality: character.currentVersion?.personality ?? "",
    backstory: character.currentVersion?.backstory ?? "",
    imageUrl,
  };
  const userCtx: UserCtx = {
    displayName: user.profile?.displayName ?? null,
    email: user.email,
    characterId: character.id,
  };

  const copy = buildCopy(char, userCtx);
  const ctaUrl = `${APP_URL}/onboarding`;
  const html = buildHtml(char, userCtx, copy, ctaUrl, !!overrideTo);

  const to = overrideTo ?? user.email;
  const from = `${char.name} <${FROM_ADDRESS}>`;

  const result = await resend.emails.send({
    from,
    to,
    replyTo: REPLY_TO,
    subject: copy.subject,
    html,
    ...(LOGO_PNG_BUFFER
      ? {
          attachments: [
            {
              filename: "buttercupp.png",
              content: LOGO_PNG_BUFFER,
              contentId: LOGO_CID,
              contentType: "image/png",
            },
          ],
        }
      : {}),
    // No List-Unsubscribe headers — Gmail's strongest Promotions signal.
    tags: [
      { name: "campaign", value: "character-nudge-onboarding" },
      { name: "character_id", value: character.id.substring(0, 30) },
    ],
  });

  if (result.error) return { ok: false, error: JSON.stringify(result.error) };
  return { ok: true, id: result.data?.id };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nButtercupp nudge-email (onboarding)\n${"=".repeat(40)}`);
  console.log(`Mode  : ${isDryRun ? "DRY RUN" : isBulk ? "BULK" : `TEST -> ${testAddress}`}`);
  console.log(`Target: free tier, onboarding NOT complete, random character`);
  if (limit) console.log(`Limit : ${limit}`);
  console.log("");

  if (!process.env.RESEND_API_KEY && !isDryRun) {
    console.error("ERROR: RESEND_API_KEY not set"); process.exit(1);
  }

  const pool = await fetchCharacterPool();
  console.log(`Character pool: ${pool.length} public characters with images`);
  if (pool.length === 0) {
    console.log("No characters available to assign. Aborting."); return;
  }

  const users = await fetchNonOnboardedUsers(limit);
  console.log(`Eligible users: ${users.length}\n`);

  if (users.length === 0) {
    console.log("Nothing to send. No non-onboarded free users found."); return;
  }

  let sent = 0, failed = 0;

  for (const user of users) {
    const character = pickRandom(pool);
    const label = `[${user.email}] <- ${character.name}`;

    if (isDryRun) {
      const copy = buildCopy(
        {
          name: character.name, bio: character.bio, gender: character.gender,
          greeting: character.currentVersion?.greeting ?? "",
          personality: character.currentVersion?.personality ?? "",
          backstory: character.currentVersion?.backstory ?? "",
          imageUrl: "",
        },
        { displayName: user.profile?.displayName ?? null, email: user.email, characterId: character.id }
      );
      console.log(`WOULD SEND  ${label}`);
      console.log(`  Subject  : ${copy.subject}`);
      console.log(`  Image key: ${character.media[0]?.url ?? "(none)"}`);
      console.log("");
      sent++; continue;
    }

    if (testAddress) {
      console.log(`Sending test email to ${testAddress}`);
      console.log(`  Random character: ${character.name}  (would-be recipient: ${user.email})`);
      const result = await sendNudge(user, character, testAddress);
      if (result.ok) console.log(`  OK  id=${result.id}`);
      else console.error(`  FAIL  ${result.error}`);
      break;
    }

    process.stdout.write(`${label} ... `);
    const result = await sendNudge(user, character);
    if (result.ok) { console.log(`OK (${result.id})`); sent++; }
    else { console.log(`FAIL: ${result.error}`); failed++; }

    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log(`\n${"=".repeat(40)}`);
  if (isDryRun) console.log(`DRY RUN done. Would send ${sent} emails.`);
  else if (testAddress) console.log("Test send complete.");
  else console.log(`Sent: ${sent}   Failed: ${failed}`);
}

main()
  .catch((err) => { console.error("Fatal:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
