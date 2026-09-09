/**
 * Tests for lib/brevo.ts
 *
 * Mocks the global fetch so no real Brevo API calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendBrevoEmail } from "../../lib/brevo";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

const validInput = {
  to: "test@example.com",
  fromName: "Aria",
  subject: "Test subject",
  html: "<p>Hello</p>",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendBrevoEmail", () => {
  beforeEach(() => {
    process.env.BREVO_API_KEY = "xkeysib-test-key";
    process.env.EMAIL_FROM = "Buttercupp <admin@buttercupp.fun>";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("sends successfully and returns messageId", async () => {
    const fetchMock = mockFetch(201, { messageId: "abc123" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBrevoEmail(validInput);

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("abc123");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends correct payload shape to Brevo API", async () => {
    const fetchMock = mockFetch(201, { messageId: "id1" });
    vi.stubGlobal("fetch", fetchMock);

    await sendBrevoEmail({
      ...validInput,
      headers: { "List-Unsubscribe": "<https://example.com/unsub>" },
      tags: ["seg-1"],
    });

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");

    const body = JSON.parse(opts.body as string);
    expect(body.to).toEqual([{ email: "test@example.com" }]);
    expect(body.sender.name).toBe("Buttercupp"); // from EMAIL_FROM "Buttercupp <...>"
    expect(body.subject).toBe("Test subject");
    expect(body.headers["List-Unsubscribe"]).toBe("<https://example.com/unsub>");
    expect(body.tags).toContain("seg-1");
  });

  it("maps inlineImages to the Brevo `attachment` payload field", async () => {
    const fetchMock = mockFetch(201, { messageId: "id-att" });
    vi.stubGlobal("fetch", fetchMock);

    await sendBrevoEmail({
      ...validInput,
      inlineImages: [{ name: "buttercupp-logo.png", contentBase64: "QUJD" }],
    });

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.attachment).toEqual([
      { content: "QUJD", name: "buttercupp-logo.png" },
    ]);
  });

  it("omits the attachment field when no inlineImages are given", async () => {
    const fetchMock = mockFetch(201, { messageId: "id-noatt" });
    vi.stubGlobal("fetch", fetchMock);

    await sendBrevoEmail(validInput);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.attachment).toBeUndefined();
  });

  it("sets api-key header from BREVO_API_KEY env var", async () => {
    const fetchMock = mockFetch(201, { messageId: "id2" });
    vi.stubGlobal("fetch", fetchMock);

    await sendBrevoEmail(validInput);

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["api-key"]).toBe("xkeysib-test-key");
  });

  it("returns ok:false when BREVO_API_KEY is missing", async () => {
    delete process.env.BREVO_API_KEY;
    const result = await sendBrevoEmail(validInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/BREVO_API_KEY/);
  });

  it("returns ok:false on 4xx API error", async () => {
    const fetchMock = mockFetch(400, { code: "invalid_parameter", message: "Bad request" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendBrevoEmail(validInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/400/);
  });

  it("returns ok:false on network error (fetch throws)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Network down")));

    const result = await sendBrevoEmail(validInput);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Network down/);
  });

  it("throws ZodError for invalid email address", async () => {
    await expect(
      sendBrevoEmail({ ...validInput, to: "not-an-email" })
    ).rejects.toThrow();
  });
});
