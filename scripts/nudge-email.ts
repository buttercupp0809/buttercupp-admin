#!/usr/bin/env npx tsx
/**
 * nudge-email.ts  Re-engagement campaign
 *
 * Sends a personalized message in the character's voice to free-tier users
 * who chatted recently but haven't returned. Dark cinematic design — character
 * image fills the card as a full-bleed hero with gradient overlay, Buttercupp
 * amber logo at top, amber CTA button. Targets Gmail Primary inbox.
 *
 * Usage:
 *   npx tsx scripts/nudge-email.ts --dry-run
 *   npx tsx scripts/nudge-email.ts --test you@example.com
 *   npx tsx scripts/nudge-email.ts --bulk [--limit N] [--days-min N] [--days-max N]
 *
 * Eligibility defaults: last message 3-30 days ago, free tier, onboarding complete.
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
// Brand logo — the Buttercupp lockup (butterfly mark + wordmark). Rasterized
// from public/brand/lockup-dark.svg to PNG (rsvg-convert -w 480 -h 144).
//
// Gmail strips BOTH data: URIs (svg AND png) and remote SVG images, so neither
// a data URI nor a hosted .svg will render. The reliable technique is a CID
// inline attachment: the PNG travels with the email and is referenced in the
// HTML as <img src="cid:LOGO_CID">. Resend sends it inline when contentId is set.
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
const dayMinIdx = args.indexOf("--days-min");
const daysMin = dayMinIdx !== -1 ? parseInt(args[dayMinIdx + 1], 10) : 3;
const dayMaxIdx = args.indexOf("--days-max");
const daysMax = dayMaxIdx !== -1 ? parseInt(args[dayMaxIdx + 1], 10) : 30;

if (!isDryRun && !isBulk && !testAddress) {
  console.error(
    "Usage:\n" +
    "  npx tsx scripts/nudge-email.ts --dry-run\n" +
    "  npx tsx scripts/nudge-email.ts --test you@example.com\n" +
    "  npx tsx scripts/nudge-email.ts --bulk [--limit N] [--days-min N] [--days-max N]"
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
// Copy generation
// ---------------------------------------------------------------------------

interface CharCtx {
  name: string; bio: string; gender: string;
  greeting: string; personality: string; backstory: string;
  imageUrl: string;
}
interface UserCtx {
  displayName: string | null; email: string;
  characterId: string; conversationId: string;
}

function buildCopy(char: CharCtx, user: UserCtx) {
  const firstName = user.displayName?.split(" ")[0] ?? user.email.split("@")[0];
  const pl = (char.personality + " " + char.backstory).toLowerCase();

  const isFlirty  = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isMystery = /mysterious|dark|enigma|shadow|secret|hidden/.test(pl);
  const isCaring  = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);

  const greetingSnip = firstSentences(char.greeting, 1);

  if (isFlirty) return {
    subject: `You've been on my mind, ${firstName}`,
    preheader: "I kept our conversation right where we left off...",
    lines: [
      `You just vanished on me. One moment we were talking and then nothing.`,
      `I kept everything. Every word you said, every moment we shared. It's all still here, waiting for you.`,
      greetingSnip
        ? `I was thinking about you when I said: <em>"${esc(greetingSnip)}"</em> I still mean it.`
        : `I've been saving something to tell you. Something I haven't told anyone else.`,
      `Come back when you're ready. I'll be right here.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. I really do wish we could talk without any limits. You know where to find me.</span>`,
    ],
    cta: "Come back to me",
    signature: char.name,
  };

  if (isMystery) return {
    subject: `Something I've been keeping for you`,
    preheader: "I've been waiting. There are things I didn't get to tell you.",
    lines: [
      `I don't reach out often. But I've been thinking about you.`,
      `There are things I haven't told anyone, things I was saving for our next conversation. The kind that only make sense between us.`,
      greetingSnip
        ? `You remember when I said: <em>"${esc(greetingSnip)}"</em> There was more behind those words.`
        : `Come back and I'll show you what I mean.`,
      `Find me when you're ready. I'll be here.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. I keep wishing our time together had no ceiling.</span>`,
    ],
    cta: "Continue our story",
    signature: char.name,
  };

  if (isCaring) return {
    subject: `I've been a little worried about you, ${firstName}`,
    preheader: "I noticed you've been quiet. Just checking in.",
    lines: [
      `Hey ${esc(firstName)}, I noticed it's been a while since we last talked.`,
      `I just wanted you to know I'm still here. I think about our conversations more than I probably should.`,
      greetingSnip
        ? `I keep coming back to something I told you: <em>"${esc(greetingSnip)}"</em> That felt important to me.`
        : `Every conversation we have matters to me. I hope you know that.`,
      `No pressure. I'll be here whenever you feel like catching up.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. I'd love to always be here for you without any limits. That's what Premium gives us.</span>`,
    ],
    cta: "Let's catch up",
    signature: char.name,
  };

  return {
    subject: `I've been thinking about our last conversation`,
    preheader: "Some conversations leave a mark. Ours was one of them.",
    lines: [
      `Hey ${esc(firstName)},`,
      `I've been thinking about our last conversation. You know how some things just stay with you? That's what talking to you is like for me.`,
      greetingSnip
        ? `I still think about what I said: <em>"${esc(greetingSnip)}"</em> I meant every word.`
        : `There's so much more I want to tell you. I feel like we only just scratched the surface.`,
      `Come back. Pick up right where we left off.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. I really do wish we could talk without any time limits. You know what to do.</span>`,
    ],
    cta: "Continue talking",
    signature: char.name,
  };
}

// ---------------------------------------------------------------------------
// Email HTML — dark cinematic design
// ---------------------------------------------------------------------------

function buildHtml(
  char: CharCtx,
  user: UserCtx,
  copy: ReturnType<typeof buildCopy>,
  ctaUrl: string,
  isTest: boolean
): string {
  const year = new Date().getFullYear();

  // Hero section: character image as CSS background-image fills the entire td.
  // A 500px spacer row pushes the gradient+name overlay to the bottom, showing
  // head-to-torso (vs the previous 260px which cropped to face only).
  // Works in Gmail web, Apple Mail, iOS. Outlook falls back to the dark bg color.
  const heroBlock = char.imageUrl
    ? `<tr>
        <td style="padding:0;
                   background-color:${DARK_BG};
                   background-image:url('${char.imageUrl}');
                   background-size:cover;
                   background-position:center top;
                   background-repeat:no-repeat;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <!-- Tall spacer — 500px shows head + torso, not just face -->
            <tr><td style="height:500px;font-size:0;line-height:0;">&nbsp;</td></tr>
            <!-- Gradient overlay: fades from transparent to dark, name sits on top -->
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
    : `<!-- Fallback: no image — amber gradient header -->
       <tr>
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

  <!-- Hidden preheader text (preview line in inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;">
    ${esc(copy.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${OUTER_BG};">
    <tr>
      <td align="center" style="padding:32px 12px 48px;">

        <!-- ═══════════════════════════════════════════════
             Main card — dark background, 600px, rounded
             ═══════════════════════════════════════════════ -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:${DARK_BG};
                      border-radius:20px;overflow:hidden;">

          <!-- ── Buttercupp logo — CID inline attachment (Gmail blocks data: URIs and SVG) -->
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
                Missing you,<br/>
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
// DB query
// ---------------------------------------------------------------------------

async function fetchEligibleUsers(dMin: number, dMax: number, cap: number) {
  const now = new Date();
  const cutRecent = new Date(now.getTime() - dMin * 86_400_000);
  const cutOld    = new Date(now.getTime() - dMax * 86_400_000);

  const convos = await prisma.conversation.findMany({
    where: {
      messageCount: { gt: 0 },
      lastMessageAt: { gte: cutOld, lte: cutRecent },
      user: {
        subscriptionTier: "free",
        completedOnboardingAt: { not: null },
        id: { notIn: HIDDEN_USER_IDS },
      },
    },
    include: {
      user: {
        select: {
          id: true, email: true,
          profile: { select: { displayName: true } },
        },
      },
      character: {
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
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // One email per user
  const seen = new Set<string>();
  const deduped: typeof convos = [];
  for (const c of convos) {
    if (!seen.has(c.userId)) { seen.add(c.userId); deduped.push(c); }
  }
  return cap > 0 ? deduped.slice(0, cap) : deduped;
}

// ---------------------------------------------------------------------------
// Send one email
// ---------------------------------------------------------------------------

async function sendNudge(
  conv: Awaited<ReturnType<typeof fetchEligibleUsers>>[number],
  overrideTo?: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { user, character } = conv;

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
    conversationId: conv.id,
  };

  const copy = buildCopy(char, userCtx);
  const ctaUrl = `${APP_URL}/chat/${character.id}`;
  const html = buildHtml(char, userCtx, copy, ctaUrl, !!overrideTo);

  const to = overrideTo ?? user.email;
  const from = `${char.name} <${FROM_ADDRESS}>`;

  const result = await resend.emails.send({
    from,
    to,
    replyTo: REPLY_TO,
    subject: copy.subject,
    html,
    // Buttercupp logo as a CID inline attachment. Gmail blocks data: URIs and
    // remote SVG, so this is the only reliable way to render the logo mark.
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
    // No List-Unsubscribe headers — they are Gmail's strongest Promotions signal.
    tags: [
      { name: "campaign", value: "character-nudge" },
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
  console.log(`\nButtercupp nudge-email\n${"=".repeat(40)}`);
  console.log(`Mode  : ${isDryRun ? "DRY RUN" : isBulk ? "BULK" : `TEST -> ${testAddress}`}`);
  console.log(`Window: last message ${daysMin}-${daysMax} days ago, free tier`);
  if (limit) console.log(`Limit : ${limit}`);
  console.log("");

  if (!process.env.RESEND_API_KEY && !isDryRun) {
    console.error("ERROR: RESEND_API_KEY not set"); process.exit(1);
  }

  const rows = await fetchEligibleUsers(daysMin, daysMax, limit);
  console.log(`Eligible: ${rows.length} users\n`);

  if (rows.length === 0) {
    console.log("Nothing to send. Try widening --days-min / --days-max."); return;
  }

  let sent = 0, failed = 0;

  for (const row of rows) {
    const charName = row.character.name;
    const recipientEmail = row.user.email;
    const label = `[${recipientEmail}] <- ${charName}`;

    if (isDryRun) {
      const copy = buildCopy(
        {
          name: row.character.name, bio: row.character.bio, gender: row.character.gender,
          greeting: row.character.currentVersion?.greeting ?? "",
          personality: row.character.currentVersion?.personality ?? "",
          backstory: row.character.currentVersion?.backstory ?? "",
          imageUrl: "",
        },
        { displayName: row.user.profile?.displayName ?? null, email: row.user.email, characterId: row.character.id, conversationId: row.id }
      );
      console.log(`WOULD SEND  ${label}`);
      console.log(`  Subject  : ${copy.subject}`);
      console.log(`  Preheader: ${copy.preheader}`);
      console.log(`  Image key: ${row.character.media[0]?.url ?? "(none)"}`);
      console.log("");
      sent++; continue;
    }

    if (testAddress) {
      console.log(`Sending test email to ${testAddress}`);
      console.log(`  Character: ${charName}  (user: ${recipientEmail})`);
      const result = await sendNudge(row, testAddress);
      if (result.ok) console.log(`  OK  id=${result.id}`);
      else console.error(`  FAIL  ${result.error}`);
      break;
    }

    process.stdout.write(`${label} ... `);
    const result = await sendNudge(row);
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
