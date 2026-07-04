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
    console.warn("[Email] RESEND_API_KEY not set — skipping");
    return;
  }

  // Default to the verified karooli.ai sender. onboarding@resend.dev is Resend's
  // shared sandbox domain and only delivers to the account owner, so it must never
  // be the production default. Override with EMAIL_FROM once a Vesspr-branded
  // domain is verified in Resend.
  const from = process.env.EMAIL_FROM || "Vesspr <contact@karooli.ai>";
  const result = await resend.emails.send({ from, to, subject, html });

  if (result.error) {
    throw new Error(`Email failed: ${JSON.stringify(result.error)}`);
  }
}

// ─── Brand Tokens ───────────────────────────────────────
// Mirrors frontend/lib/email.ts and backend/src/email/sender.ts so signup, login,
// and admin-triggered emails share one identity.
const BRAND = {
  blue: "#1D9EFF",
  skyBlue: "#7EC8FF",
  skyLight: "#D9EEFF",
  cream: "#FFECDB",
  textDark: "#0F172A",
  textMuted: "#475569",
  textOnGradient: "#FFFFFF",
  cardBg: "#FFFFFF",
  pageBg: "#EAF4FF",
  border: "#DCE8F5",
  gradient: "linear-gradient(180deg, #1D9EFF 0%, #7EC8FF 55%, #D9EEFF 100%)",
} as const;

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VESSPR_APP_URL ||
    "https://app.vesspr.ai"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface EmailShellOpts {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
  appUrl?: string;
}

export function emailShell(o: EmailShellOpts): string {
  const appUrl = o.appUrl || appBaseUrl();
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>`
    : "";
  const cta =
    o.ctaText && o.ctaUrl
      ? `<a href="${o.ctaUrl}" style="display:inline-block;padding:14px 28px;background:${BRAND.blue};color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">${escapeHtml(o.ctaText)}</a>`
      : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(o.title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.textDark};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
      <tr><td style="background:${BRAND.gradient};background-image:url('${appUrl}/email-assets/vesspr-header-bg.png');background-size:cover;border-radius:20px 20px 0 0;padding:40px 32px 56px;text-align:center;">
        <img src="${appUrl}/email-assets/vesspr-logo.png" width="56" height="56" alt="Vesspr" style="width: 200px;height:100%;display:inline-block;margin:0 auto 12px;"/>
        <div style="font-size:14px;color:${BRAND.textOnGradient};opacity:0.88;margin-top:4px;">A friend who shows up first</div>
      </td></tr>
      <tr><td style="background:${BRAND.cardBg};border-radius:0 0 20px 20px;padding:40px 32px;">
        <h1 style="margin:0 0 18px;font-size:22px;font-weight:700;color:${BRAND.textDark};line-height:1.3;">${escapeHtml(o.title)}</h1>
        <div style="font-size:16px;line-height:1.6;color:${BRAND.textMuted};">${o.bodyHtml}</div>
        ${cta ? `<div style="margin-top:28px;">${cta}</div>` : ""}
      </td></tr>
      <tr><td style="padding:24px 24px 8px;text-align:center;">
        <div style="font-size:12px;color:${BRAND.textMuted};line-height:1.6;">
          ${o.footerNote ? escapeHtml(o.footerNote) + "<br/>" : ""}
          <a href="${appUrl}/dashboard/settings" style="color:${BRAND.textMuted};text-decoration:underline;">Preferences</a> ·
          <a href="${appUrl}/unsubscribe" style="color:${BRAND.textMuted};text-decoration:underline;">Unsubscribe</a><br/>
          <span style="opacity:0.7;">Vesspr · © ${new Date().getFullYear()}</span>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
