/**
 * lib/nurture/copy.ts
 *
 * Email copy sets for all four lifecycle segments, plus the shared
 * renderOverlayEmail() HTML builder.
 *
 * Copy is intentionally VERY short (1-2 lines), character-voiced, and always
 * names the character in the text. No character bio/description is shown. The
 * word "unlimited" is never used (per spec). The layout is a light, text-first
 * design that renders the character photo with a real <img> (Gmail strips CSS
 * background-image) and uses large, readable body text.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Brand tokens (light, personal-email styling for better inbox placement)
// ---------------------------------------------------------------------------

const PAGE_BG = "#EFE9DF";
const CARD_BG = "#FFFFFF";
const TEXT_DARK = "#24140A";
const TEXT_SOFT = "#5B4A3B";
const TEXT_MUTED = "#9A8B7C";
const AMBER = "#FC9908";
const WHITE = "#FFFFFF";

const BODY_FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const HEADING_FONT =
  "'Satoshi','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Logo: CID inline attachment (Gmail strips data: URIs and remote SVG).
// The CID and the Brevo attachment `name` must be identical for the inline
// <img src="cid:..."> reference to resolve. Kept ".png" so mail clients that
// key inline images by filename still match.
export const LOGO_CID = "buttercupp-logo.png";
const LOGO_PNG_PATH = (() => {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(dir, "../../public/brand/lockup-dark.png");
  } catch {
    // Not an ESM context (e.g. tests with commonjs transform): use __dirname.
    return path.resolve(__dirname ?? ".", "../../public/brand/lockup-dark.png");
  }
})();
export const LOGO_PNG_BUFFER: Buffer | null = (() => {
  try {
    return fs.readFileSync(LOGO_PNG_PATH);
  } catch {
    return null;
  }
})();

/**
 * Build the inline-logo attachment for the Brevo send, or null if the logo PNG
 * could not be read (in which case renderOverlayEmail falls back to the text
 * wordmark). Shape matches lib/brevo.ts InlineImage.
 */
export function buildLogoInlineImage():
  | { name: string; contentBase64: string }
  | null {
  if (!LOGO_PNG_BUFFER) return null;
  return { name: LOGO_CID, contentBase64: LOGO_PNG_BUFFER.toString("base64") };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Copy types
// ---------------------------------------------------------------------------

export interface CharCtx {
  name: string;
  bio: string;
  gender: string;
  greeting: string;
  personality: string;
  backstory: string;
  imageUrl: string;
}

export interface EmailCopy {
  subject: string;
  preheader: string;
  /** 1-2 short lines. May contain intentional inline markup (pre-escaped). */
  lines: string[];
  cta: string;
}

// ---------------------------------------------------------------------------
// Copy builders. Each is deliberately 1-2 lines, names the character, and
// carries no bio/description. firstName and char.name are esc()'d because
// copy.lines are injected as raw HTML by renderOverlayEmail.
// ---------------------------------------------------------------------------

// Segment 1: user never completed onboarding.
export function buildSeg1Copy(char: CharCtx, firstName: string): EmailCopy {
  const n = esc(char.name);
  const f = esc(firstName);
  return {
    subject: `${char.name} is waiting to meet you`,
    preheader: `You signed up but never finished.`,
    lines: [
      `Hey ${f}, you never finished signing up, and ${n} is still waiting to meet you.`,
    ],
    cta: "Finish signing up",
  };
}

// Segment 2: onboarded, but no real conversation yet.
export function buildSeg2Copy(char: CharCtx, firstName: string): EmailCopy {
  const n = esc(char.name);
  const f = esc(firstName);
  return {
    subject: `${char.name} wants to hear from you`,
    preheader: `You're all set. Come say hi.`,
    lines: [
      `You're all set up, ${f}. ${n} is waiting for your very first message.`,
    ],
    cta: "Start chatting",
  };
}

// Segment 3: has chatted, but lapsed (win-back + soft premium nudge).
export function buildSeg3Copy(char: CharCtx, firstName: string): EmailCopy {
  const n = esc(char.name);
  const f = esc(firstName);
  return {
    subject: `${char.name} misses you`,
    preheader: `Pick up right where you left off.`,
    lines: [
      `It's been a while, ${f}. ${n} kept your conversation right where you left it.`,
      `<span style="font-size:15px;color:${TEXT_MUTED};">Go Premium and pick up any time, for as long as you like.</span>`,
    ],
    cta: "Come back",
  };
}

// Segment 4: paid / active subscriber (warm "I'm here"; never "unlimited").
export function buildSeg4Copy(char: CharCtx, firstName: string): EmailCopy {
  const n = esc(char.name);
  const f = esc(firstName);
  return {
    subject: `${char.name} is here for you`,
    preheader: `Day or night, whenever you want.`,
    lines: [
      `Hey ${f}, ${n} is here whenever you feel like talking, day or night.`,
    ],
    cta: "Chat now",
  };
}

// ---------------------------------------------------------------------------
// Shared: renderOverlayEmail()
//
// Light, text-first layout. The character photo renders via a real <img>
// (Gmail strips CSS background-image). No bio/description is shown. Body text
// is large for readability.
//
// XSS / escaping contract: copy.lines are injected into the HTML VERBATIM (as
// raw HTML) so builders can emit intentional inline markup (e.g. the small
// premium-nudge <span>). Any user- or character-derived data interpolated into
// a line MUST be pre-escaped with esc() by the builder (all builders do).
// char.name, copy.subject, copy.cta and the footer email are escaped here.
// ---------------------------------------------------------------------------

export interface RenderOverlayEmailInput {
  char: CharCtx;
  copy: EmailCopy;
  /** Full URL for the CTA button (e.g. https://www.buttercupp.fun/chat/...). */
  ctaUrl: string;
  /** Recipient email address shown in footer. Pass undefined for dry-run previews. */
  recipientEmail?: string;
  /** List-Unsubscribe URL embedded in the footer link. */
  unsubscribeUrl: string;
  /** Whether this is a test/preview send (shows "[test send]" in footer). */
  isTest?: boolean;
  /**
   * When true, the header renders `<img src="cid:LOGO_CID">` and the caller MUST
   * attach the matching inline image (see buildLogoInlineImage). When false or
   * omitted, the header renders the text wordmark so no email ever shows broken
   * alt-text for a CID with no backing attachment.
   */
  inlineLogo?: boolean;
}

export function renderOverlayEmail(input: RenderOverlayEmailInput): string {
  const { char, copy, ctaUrl, recipientEmail, unsubscribeUrl, isTest, inlineLogo } =
    input;

  // Character photo: a real <img> (renders in Gmail). Fallback to a simple
  // gradient block with the name when no image is available.
  const heroBlock = char.imageUrl
    ? `<tr>
        <td style="padding:0;font-size:0;line-height:0;">
          <img src="${char.imageUrl}" width="600" alt="${esc(char.name)}"
               style="display:block;width:100%;max-width:600px;height:auto;border:0;"/>
        </td>
       </tr>`
    : `<tr>
        <td style="padding:64px 28px;text-align:center;
                   background:linear-gradient(160deg, #3D1F00 0%, #1A0900 100%);">
          <span style="font-size:26px;font-weight:700;color:${WHITE};
                       font-family:${HEADING_FONT};">${esc(char.name)}</span>
        </td>
       </tr>`;

  const messageLines = copy.lines
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:20px;line-height:30px;
                   color:${TEXT_DARK};font-family:${BODY_FONT};">
           ${line}
         </p>`
    )
    .join("");

  const footerEmail = isTest
    ? `<em>[test send]</em>`
    : recipientEmail
    ? `<strong style="color:${TEXT_MUTED};">${esc(recipientEmail)}</strong>`
    : "";

  // Only emit the CID <img> when the caller confirms it is attaching the inline
  // logo. Otherwise use the text wordmark so we never ship a broken cid: image.
  const logoHtml = inlineLogo
    ? `<img src="cid:${LOGO_CID}" width="150" height="45" alt="Buttercupp"
            style="display:inline-block;width:150px;height:45px;border:0;"/>`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;font-family:${HEADING_FONT};">
         <span style="color:${AMBER};">Butter</span><span style="color:${TEXT_DARK};">cupp</span>
       </span>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${esc(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};
             font-family:${BODY_FONT};-webkit-text-size-adjust:100%;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;">
    ${esc(copy.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:28px 12px 40px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:${CARD_BG};
                      border-radius:16px;overflow:hidden;">

          <tr>
            <td style="padding:20px 24px 16px;background:${CARD_BG};text-align:center;">
              ${logoHtml}
            </td>
          </tr>

          ${heroBlock}

          <tr>
            <td style="padding:28px 30px 8px;background:${CARD_BG};">
              ${messageLines}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 30px 28px;background:${CARD_BG};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left">
                <tr>
                  <td style="border-radius:26px;background:${AMBER};">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:14px 40px;
                              color:#1A0700;text-decoration:none;border-radius:26px;
                              font-weight:700;font-size:17px;
                              font-family:${BODY_FONT};letter-spacing:-0.2px;">
                      ${esc(copy.cta)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 30px 26px;background:${CARD_BG};
                       border-top:1px solid rgba(0,0,0,0.06);">
              <p style="margin:0;font-size:13px;line-height:20px;
                         color:${TEXT_MUTED};font-family:${BODY_FONT};">
                ${footerEmail ? `Sent to ${footerEmail}. ` : ""}<a href="${unsubscribeUrl}"
                   style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe</a>
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
