/**
 * Tests for lib/nurture/token.ts
 *
 * Verification of unsubscribe tokens is done by the @unique DB lookup, not by
 * re-deriving the HMAC (see app/api/unsubscribe/route.ts). These tests cover
 * minting only: a token is a stable, high-entropy, unguessable string.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateUnsubscribeToken } from "../../lib/nurture/token";

describe("unsubscribe token minting", () => {
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = "test-secret-for-unit-tests";
  });

  afterEach(() => {
    delete process.env.UNSUBSCRIBE_SECRET;
  });

  it("generates a non-empty token", () => {
    const token = generateUnsubscribeToken("user-123");
    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(20);
  });

  it("generates the same token for the same userId + secret", () => {
    const t1 = generateUnsubscribeToken("stable-user");
    const t2 = generateUnsubscribeToken("stable-user");
    expect(t1).toBe(t2);
  });

  it("generates different tokens for different userIds", () => {
    const a = generateUnsubscribeToken("user-a");
    const b = generateUnsubscribeToken("user-b");
    expect(a).not.toBe(b);
  });

  it("is URL-safe (base64url: no +, /, or = chars)", () => {
    const token = generateUnsubscribeToken("user-123");
    expect(token).not.toMatch(/[+/=]/);
  });

  it("rotating the secret only changes future tokens (stored tokens are unaffected)", () => {
    // A token minted under one secret would be stored in the DB. Rotating the
    // secret produces a DIFFERENT token for the same user, but the previously
    // stored token is still what lives in User.unsubscribeToken and is matched
    // by the DB lookup. This test documents that minting is secret-dependent
    // while verification (DB lookup) is not, so rotation never breaks a stored
    // link.
    process.env.UNSUBSCRIBE_SECRET = "secret-one";
    const beforeRotation = generateUnsubscribeToken("user-123");

    process.env.UNSUBSCRIBE_SECRET = "secret-two";
    const afterRotation = generateUnsubscribeToken("user-123");

    expect(beforeRotation).not.toBe(afterRotation);
  });

  it("throws if no signing secret is available", () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_JWT_SECRET;
    expect(() => generateUnsubscribeToken("user-x")).toThrow(/signing secret/);
  });
});
