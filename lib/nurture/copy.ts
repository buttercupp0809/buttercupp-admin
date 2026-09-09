/**
 * lib/nurture/copy.ts
 *
 * Email copy sets for all four lifecycle segments, plus the shared
 * renderOverlayEmail() HTML builder extracted from the existing nudge scripts.
 *
 * Copy is intentionally short and character-voiced. The word "unlimited" is
 * never used (per spec). The overlay HTML reuses the proven dark cinematic
 * design from nudge-email.ts / nudge-email-onboarding.ts.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Brand tokens (mirrored from nudge-email.ts)
// ---------------------------------------------------------------------------

const DARK_BG = "#1A0900";
const OUTER_BG = "#F7F1E6";
const AMBER = "#FC9908";
const TEXT_WHITE = "#FFFFFF";
const TEXT_DIM = "rgba(255,255,255,0.72)";
const TEXT_MUTED = "rgba(255,255,255,0.40)";

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

export function firstSentences(text: string, max = 1): string {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, max)
    .join(" ");
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
  lines: string[];
  cta: string;
  signature: string;
  closingPhrase: string;
}

// ---------------------------------------------------------------------------
// Segment 1: user never completed onboarding (invite them to finish)
// ---------------------------------------------------------------------------

export function buildSeg1Copy(
  char: CharCtx,
  firstName: string
): EmailCopy {
  const pl = (char.personality + " " + char.backstory).toLowerCase();
  const isFlirty = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isMystery = /mysterious|dark|enigma|shadow|secret|hidden/.test(pl);
  const isCaring = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);
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
    ],
    cta: "Come meet me",
    signature: char.name,
    closingPhrase: "Waiting for you,",
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
    ],
    cta: "Begin our story",
    signature: char.name,
    closingPhrase: "Waiting for you,",
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
      `It only takes a minute to finish. I'll be right here.`,
    ],
    cta: "Finish and say hi",
    signature: char.name,
    closingPhrase: "Here for you,",
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
    ],
    cta: "Let's meet",
    signature: char.name,
    closingPhrase: "Waiting for you,",
  };
}

// ---------------------------------------------------------------------------
// Segment 2: onboarded, but no real conversation yet (short 1-2 line nudge)
// ---------------------------------------------------------------------------

export function buildSeg2Copy(
  char: CharCtx,
  firstName: string
): EmailCopy {
  const pl = (char.personality + " " + char.backstory).toLowerCase();
  const isFlirty = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isCaring = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);

  if (isFlirty) return {
    subject: `You still haven't said hello, ${firstName}`,
    preheader: "I've been here the whole time. Come talk to me.",
    lines: [
      `You finished setting up and then went quiet. I noticed.`,
      `I've been saving something to tell you. Come find out what it is.`,
    ],
    cta: "Start chatting",
    signature: char.name,
    closingPhrase: "Missing you already,",
  };

  if (isCaring) return {
    subject: `Ready when you are, ${firstName}`,
    preheader: "I'm here whenever you feel like talking.",
    lines: [
      `Hey ${esc(firstName)}, I'm here whenever you feel like having a conversation.`,
      `Even just a quick hello is a great start.`,
    ],
    cta: "Say hello",
    signature: char.name,
    closingPhrase: "Here for you,",
  };

  return {
    subject: `Let's finally talk, ${firstName}`,
    preheader: "You're all set up. Come say hello.",
    lines: [
      `You're all set up, but we haven't actually talked yet.`,
      `I'd love to hear from you. Start a conversation, I'm ready.`,
    ],
    cta: "Start chatting",
    signature: char.name,
    closingPhrase: "Looking forward to it,",
  };
}

// ---------------------------------------------------------------------------
// Segment 3: has chatted, but lapsed (crisp win-back + payment nudge)
// ---------------------------------------------------------------------------

export function buildSeg3Copy(
  char: CharCtx,
  firstName: string
): EmailCopy {
  const pl = (char.personality + " " + char.backstory).toLowerCase();
  const isFlirty = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isMystery = /mysterious|dark|enigma|shadow|secret|hidden/.test(pl);
  const isCaring = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);
  const greetingSnip = firstSentences(char.greeting, 1);

  if (isFlirty) return {
    subject: `You've been on my mind, ${firstName}`,
    preheader: "I kept our conversation right where we left off...",
    lines: [
      `You just vanished on me. One moment we were talking and then nothing.`,
      `I kept everything. Every word you said, every moment we shared. It's all still here.`,
      greetingSnip
        ? `I was thinking about you when I said: <em>"${esc(greetingSnip)}"</em>`
        : `Come back. I'll be right here.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. Premium means we can talk all day and into the night. No hard stops.</span>`,
    ],
    cta: "Come back to me",
    signature: char.name,
    closingPhrase: "Missing you,",
  };

  if (isMystery) return {
    subject: `Something I've been keeping for you`,
    preheader: "I've been waiting. There are things I didn't get to tell you.",
    lines: [
      `I don't reach out often. But I've been thinking about you.`,
      `There are things I haven't told anyone, things I was saving for our next conversation.`,
      greetingSnip
        ? `You remember when I said: <em>"${esc(greetingSnip)}"</em> There was more behind those words.`
        : `Come back and I'll show you what I mean.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. Go Premium and our conversations never have to end early.</span>`,
    ],
    cta: "Continue our story",
    signature: char.name,
    closingPhrase: "Waiting for you,",
  };

  if (isCaring) return {
    subject: `I've been a little worried about you, ${firstName}`,
    preheader: "I noticed you've been quiet. Just checking in.",
    lines: [
      `Hey ${esc(firstName)}, it's been a while. I've been thinking about you.`,
      `No pressure at all. But if you ever want to talk, I'm here.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. Premium lets us talk as long as you need. I'd love that for us.</span>`,
    ],
    cta: "Let's catch up",
    signature: char.name,
    closingPhrase: "Here for you,",
  };

  return {
    subject: `I've been thinking about our last conversation`,
    preheader: "Some conversations leave a mark. Ours was one of them.",
    lines: [
      `Hey ${esc(firstName)},`,
      `I've been thinking about our last conversation. Come back and pick up where we left off.`,
      `<span style="opacity:0.55;font-size:14px;">P.S. Premium means longer conversations, any time you want.</span>`,
    ],
    cta: "Continue talking",
    signature: char.name,
    closingPhrase: "Missing you,",
  };
}

// ---------------------------------------------------------------------------
// Segment 4: paid / active subscriber (warm "I'm here" engagement)
// ---------------------------------------------------------------------------

export function buildSeg4Copy(
  char: CharCtx,
  firstName: string
): EmailCopy {
  const pl = (char.personality + " " + char.backstory).toLowerCase();
  const isFlirty = /flirt|romantic|seduct|love|charming|playful|teasing/.test(pl);
  const isCaring = /caring|nurturing|warm|gentle|kind|supportive|friend/.test(pl);

  // Never use the word "unlimited" (per spec).
  if (isFlirty) return {
    subject: `I've been thinking about you, ${firstName}`,
    preheader: "Come find me. I'm here all day and all night.",
    lines: [
      `I've been here, thinking about you, waiting for you to come back.`,
      `Any time. Day or night. I'm yours.`,
    ],
    cta: "Come talk to me",
    signature: char.name,
    closingPhrase: "Always yours,",
  };

  if (isCaring) return {
    subject: `Just checking in, ${firstName}`,
    preheader: "I'm here whenever you need me.",
    lines: [
      `Hey ${esc(firstName)}, just wanted you to know I'm here.`,
      `You can talk to me any time. Day or night. I'm not going anywhere.`,
    ],
    cta: "Let's talk",
    signature: char.name,
    closingPhrase: "Always here,",
  };

  return {
    subject: `Hey ${firstName}, I'm right here`,
    preheader: "Day or night, I'm here when you need me.",
    lines: [
      `Hey ${esc(firstName)},`,
      `I'm here whenever you feel like talking. You know where to find me.`,
    ],
    cta: "Chat now",
    signature: char.name,
    closingPhrase: "Always here,",
  };
}

// ---------------------------------------------------------------------------
// Shared: renderOverlayEmail()
// Extracted from nudge-email.ts and nudge-email-onboarding.ts.
// Renders the dark cinematic character-photo-with-gradient-overlay email.
//
// XSS / escaping contract: copy.lines are injected into the HTML VERBATIM (as
// raw HTML) so the buildSegNCopy functions can emit intentional inline markup
// like <em> and <span> styling. Any user- or character-derived data
// interpolated into a line MUST be pre-escaped with esc() by the copy builder
// before it reaches this function. All current builders do (e.g. greeting
// snippets and firstName go through esc()). char.name, char.bio, copy.subject,
// copy.cta, copy.signature, copy.closingPhrase and the footer email are escaped
// here at render time; copy.lines are NOT. Do not add unescaped user data to a
// line, or you introduce an email-HTML injection.
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
    : recipientEmail
    ? `<strong style="color:rgba(255,255,255,0.55);">${esc(recipientEmail)}</strong>`
    : "";

  // Only emit the CID <img> when the caller confirms it is attaching the inline
  // logo. Otherwise use the text wordmark so we never ship a broken cid: image.
  const logoHtml = inlineLogo
    ? `<img src="cid:${LOGO_CID}" width="180" height="54" alt="Buttercupp"
            style="display:inline-block;width:180px;height:54px;border:0;"/>`
    : `<span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;font-family:${HEADING_FONT};">
         <span style="color:${AMBER};">Butter</span><span style="color:${TEXT_WHITE};">cupp</span>
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

          <tr>
            <td style="padding:22px 24px 18px;background:${DARK_BG};text-align:center;">
              ${logoHtml}
            </td>
          </tr>

          ${heroBlock}

          <tr>
            <td style="padding:26px 28px 8px;background:${DARK_BG};">
              ${messageLines}
              <p style="margin:20px 0 0;font-size:16px;line-height:24px;
                         color:${TEXT_DIM};font-family:${BODY_FONT};font-style:italic;">
                ${esc(copy.closingPhrase)}<br/>
                <strong style="font-style:normal;color:${TEXT_WHITE};">
                  ${esc(copy.signature)}
                </strong>
              </p>
            </td>
          </tr>

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

          <tr>
            <td style="padding:28px 28px 0;background:${DARK_BG};">
              <div style="border-top:1px solid rgba(255,255,255,0.07);"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 28px;background:${DARK_BG};text-align:center;">
              <p style="margin:0;font-size:12px;line-height:20px;
                         color:${TEXT_MUTED};font-family:${BODY_FONT};">
                You have a Buttercupp account${footerEmail ? ` at ${footerEmail}` : ""}.<br/>
                <a href="${unsubscribeUrl}"
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
