/**
 * lib/brevo.ts
 *
 * Thin wrapper around the Brevo transactional-email v3 API.
 * Shape mirrors lib/email.ts (Resend) so callers are provider-agnostic.
 *
 * Env vars required:
 *   BREVO_API_KEY  - Brevo API key (starts with "xkeysib-")
 *   EMAIL_FROM     - Sender address, e.g. "Buttercupp <admin@buttercupp.fun>"
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Input schema (zod validates at every call site)
// ---------------------------------------------------------------------------

/**
 * An inline (CID-referenced) image attachment. Brevo's v3 transactional API
 * accepts attachments as `{ content: <base64>, name }`; an inline image is
 * referenced in the HTML as `<img src="cid:NAME">` where NAME matches the
 * attachment `name`. `content` is a base64 string (no data: prefix).
 */
export const InlineImageSchema = z.object({
  /** CID and attachment filename. Must equal the `cid:` used in the HTML. */
  name: z.string().min(1),
  /** Base64-encoded file bytes (no "data:" prefix). */
  contentBase64: z.string().min(1),
});

export type InlineImage = z.infer<typeof InlineImageSchema>;

export const SendEmailInputSchema = z.object({
  to: z.string().email(),
  fromName: z.string().min(1),
  subject: z.string().min(1),
  html: z.string().min(1),
  /** Optional plain-text fallback. If omitted Brevo auto-generates from HTML. */
  text: z.string().optional(),
  /** RFC 5322 / RFC 2369 headers such as List-Unsubscribe. */
  headers: z.record(z.string(), z.string()).optional(),
  /** Arbitrary key-value tags stored with the message in Brevo analytics. */
  tags: z.array(z.string()).optional(),
  /** Inline CID images (e.g. the header logo) attached and referenced in HTML. */
  inlineImages: z.array(InlineImageSchema).optional(),
});

export type SendEmailInput = z.infer<typeof SendEmailInputSchema>;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface SendEmailResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Brevo send
// ---------------------------------------------------------------------------

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Send a single transactional email via the Brevo v3 SMTP API.
 *
 * Throws only on programming errors (bad input shape). Network/API failures
 * are returned as { ok: false, error: "..." } so callers can log and continue.
 */
export async function sendBrevoEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  // Validate at trust boundary.
  const parsed = SendEmailInputSchema.parse(input);

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY env var not set" };
  }

  // Resolve EMAIL_FROM env var, falling back to the fromName + a hardcoded domain.
  const fromEnv = process.env.EMAIL_FROM?.trim();
  const fromAddress = fromEnv
    ? fromEnv.includes("<")
      ? fromEnv
      : `${parsed.fromName} <${fromEnv}>`
    : `${parsed.fromName} <admin@buttercupp.fun>`;

  // Parse "Display Name <email@example.com>" into separate name + email parts.
  const fromMatch = fromAddress.match(/^(.*?)\s*<([^>]+)>$/);
  const senderEmail = fromMatch ? fromMatch[2].trim() : fromAddress.trim();
  const senderName = fromMatch ? fromMatch[1].trim() : parsed.fromName;

  const payload: Record<string, unknown> = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: parsed.to }],
    subject: parsed.subject,
    htmlContent: parsed.html,
  };

  if (parsed.text) payload.textContent = parsed.text;

  if (parsed.headers && Object.keys(parsed.headers).length > 0) {
    payload.headers = parsed.headers;
  }

  if (parsed.tags && parsed.tags.length > 0) {
    payload.tags = parsed.tags;
  }

  // Inline CID attachments (Brevo v3: attachment: [{ content: base64, name }]).
  // The HTML references each by <img src="cid:NAME"> where NAME === attachment.name.
  if (parsed.inlineImages && parsed.inlineImages.length > 0) {
    payload.attachment = parsed.inlineImages.map((img) => ({
      content: img.contentBase64,
      name: img.name,
    }));
  }

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Brevo API ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as { messageId?: string };
    return { ok: true, messageId: data.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Brevo fetch failed: ${message}` };
  }
}
