import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set, skipping");
    return;
  }

  // Default sender is noreply@vesspr.ai. Override with EMAIL_FROM env var if a
  // different verified address is needed. If EMAIL_FROM is a bare address we wrap
  // it; if it already carries a display name ("Name <addr>") we use it verbatim.
  const fromEnv = process.env.EMAIL_FROM?.trim();
  const from = fromEnv
    ? fromEnv.includes("<")
      ? fromEnv
      : `Vesspr <${fromEnv}>`
    : "Vesspr <noreply@vesspr.ai>";
  const result = await resend.emails.send({ from, to, subject, html });

  if (result.error) {
    throw new Error(`Email failed: ${JSON.stringify(result.error)}`);
  }
}

// ─── Brand Tokens (from Figma: Vesspr email system) ─────
// Mirrors frontend/lib/email.ts and backend/src/email/sender.ts so signup, login,
// and admin-triggered emails share one identity.
const BRAND = {
  blue: "#1D9EFF",
  skyBlue: "#7EC8FF",
  skyLight: "#D9EEFF",
  cream: "#FFECDB",
  // Figma email palette
  heading: "#1A1625",
  body: "#33353E",
  footerText: "#1A1625",
  cardBg: "#FFFFFF",
  pageBg: "#F7F8F9",
  divider: "#ECECEC",
  buttonBg: "#000000",
  buttonText: "#FFFFFE",
  // legacy aliases still referenced by some templates
  textDark: "#1A1625",
  textMuted: "#33353E",
  border: "#ECECEC",
} as const;

const HEADING_FONT =
  "'Satoshi','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BODY_FONT =
  "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function appBaseUrl(): string {
  // Email assets (hero image, social icons) are served ONLY by the app host,
  // never the marketing apex (vesspr.ai) or www.vesspr.ai. NEXT_PUBLIC_APP_URL
  // is the single canonical env var for the product URL across every repo
  // (Pellow frontend/backend, vesspr-admin, vesspr-website); never introduce
  // an alternate name (e.g. NEXT_PUBLIC_APP_URL) for the same concept.
  // Mirrors Pellow frontend/lib/email.ts.
  return process.env.NEXT_PUBLIC_APP_URL || "https://app.vesspr.ai";
}

// Public brand/social handles used in the footer social row.
const SOCIALS: { slug: string; label: string; url: string }[] = [
  { slug: "facebook", label: "Facebook", url: "https://www.facebook.com/profile.php?id=61591083915079" },
  { slug: "x", label: "X", url: "https://x.com/vessprAI" },
  { slug: "instagram", label: "Instagram", url: "https://www.instagram.com/vesspr.ai" },
  { slug: "youtube", label: "YouTube", url: "https://www.youtube.com/@VessprAI" },
  { slug: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/company/karooli-ai/" },
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function socialRow(appUrl: string): string {
  const cells = SOCIALS.map(
    (s) =>
      `<td style="padding:0 8px;"><a href="${s.url}" target="_blank" style="text-decoration:none;"><img src="${appUrl}/email-assets/social/${s.slug}.png" width="28" height="28" alt="${s.label}" style="display:block;width:28px;height:28px;border:0;"/></a></td>`
  ).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${cells}</tr></table>`;
}

interface EmailShellOpts {
  /** Big heading (trusted HTML, callers must escape user input). */
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  appUrl?: string;
  /** Header hero art. "welcome" adds the mascot + confetti; "general" is the plain wordmark. */
  variant?: "welcome" | "general";
  /**
   * Transactional mode strips the hero image, social icons, Preferences link,
   * and Unsubscribe link. Use for all account/trigger emails (password reset,
   * nudge, shift-to-whatsapp, etc.) so Gmail routes them to Primary not Promotions.
   * Only set to false for genuine marketing blasts where Promotions is acceptable.
   */
  transactional?: boolean;
}

export function emailShell(o: EmailShellOpts): string {
  const appUrl = o.appUrl || appBaseUrl();
  // Default to transactional — callers must explicitly opt-in to the full
  // marketing shell (hero image + social row + unsubscribe) by passing
  // transactional: false.
  const isTransactional = o.transactional !== false;

  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>`
    : "";

  const heroFile = o.variant === "welcome" ? "welcome-head.png" : "general-head.png";

  // Transactional: small text wordmark instead of the full-bleed hero image.
  // Marketing: keep the image.
  const header = isTransactional
    ? `<tr><td style="background:${BRAND.cardBg};padding:28px 24px 0;border-radius:20px 20px 0 0;">
        <span style="font-size:18px;font-weight:700;color:${BRAND.heading};font-family:${HEADING_FONT};">Vesspr</span>
      </td></tr>`
    : `<tr><td style="padding:0;font-size:0;line-height:0;">
        <img src="${appUrl}/vesspr/${heroFile}" width="600" alt="Vesspr" style="display:block;width:100%;height:auto;border:0;border-radius:20px 20px 0 0;"/>
      </td></tr>`;

  const cta =
    o.ctaText && o.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 0;"><tr><td style="border-radius:22px;background:${BRAND.buttonBg};">
          <a href="${o.ctaUrl}" style="display:inline-block;padding:11px 30px;color:${BRAND.buttonText};text-decoration:none;border-radius:22px;font-weight:700;font-size:15px;font-family:${BODY_FONT};">${escapeHtml(o.ctaText)}</a>
        </td></tr></table>`
      : "";

  const footerNote = o.footerNote ?? "You created a Vesspr account with this email.";

  // Transactional footer: just the account note, no unsubscribe or preferences links.
  // Marketing footer: full social row + unsubscribe + preferences.
  const footerRows = isTransactional
    ? `<tr><td style="background:${BRAND.cardBg};padding:8px 24px 0;">
        <div style="border-top:1px solid ${BRAND.divider};font-size:1px;line-height:1px;">&nbsp;</div>
      </td></tr>
      <tr><td style="background:${BRAND.cardBg};padding:16px 24px 28px;text-align:center;">
        <div style="font-size:13px;line-height:20px;color:${BRAND.footerText};font-family:${BODY_FONT};">
          ${escapeHtml(footerNote)}<br/>
          <span style="color:#999;">Vesspr &copy; ${new Date().getFullYear()}</span>
        </div>
      </td></tr>`
    : `<tr><td style="background:${BRAND.cardBg};padding:24px 24px 8px;">
        ${socialRow(appUrl)}
      </td></tr>
      <tr><td style="background:${BRAND.cardBg};padding:8px 24px 0;">
        <div style="border-top:1px solid ${BRAND.divider};font-size:1px;line-height:1px;">&nbsp;</div>
      </td></tr>
      <tr><td style="background:${BRAND.cardBg};padding:20px 24px 28px;text-align:center;">
        <div style="font-size:13px;line-height:20px;color:${BRAND.footerText};font-family:${BODY_FONT};">
          ${escapeHtml(footerNote)}<br/>
          <span style="display:inline-block;padding:8px 0;">
            <a href="${appUrl}/dashboard/settings" style="color:${BRAND.footerText};text-decoration:underline;">Preferences</a>&nbsp;&nbsp;
            <a href="${appUrl}/unsubscribe" style="color:${BRAND.footerText};text-decoration:underline;">Unsubscribe</a>
          </span><br/>
          Vesspr &copy; ${new Date().getFullYear()}
        </div>
      </td></tr>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:${BODY_FONT};color:${BRAND.body};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.cardBg};border-radius:20px;overflow:hidden;">
      ${header}
      <tr><td style="background:${BRAND.cardBg};padding:20px 24px 8px;">
        <h1 style="margin:0 0 20px;font-size:26px;font-weight:600;color:${BRAND.heading};line-height:1.25;font-family:${HEADING_FONT};">${o.title}</h1>
        <div style="font-size:15px;line-height:24px;color:${BRAND.body};font-family:${BODY_FONT};">${o.bodyHtml}</div>
        ${cta ? `<div style="margin:28px 0 4px;text-align:center;">${cta}</div>` : ""}
      </td></tr>
      ${footerRows}
    </table>
  </td></tr>
</table>
</body></html>`;
}
