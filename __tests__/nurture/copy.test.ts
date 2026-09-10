/**
 * Tests for lib/nurture/copy.ts
 *
 * Verifies copy generation and renderOverlayEmail HTML output.
 */

import { describe, it, expect } from "vitest";
import {
  buildSeg1Copy,
  buildSeg2Copy,
  buildSeg3Copy,
  buildSeg4Copy,
  renderOverlayEmail,
  buildLogoInlineImage,
  LOGO_CID,
  type CharCtx,
} from "../../lib/nurture/copy";

const baseChar: CharCtx = {
  name: "Aria",
  bio: "A mysterious companion who loves long conversations.",
  gender: "female",
  greeting: "Hello, I have been waiting for you.",
  personality: "mysterious dark enigma",
  backstory: "A shadow who knows all secrets.",
  imageUrl: "",
};

const flirtyChar: CharCtx = {
  ...baseChar,
  personality: "flirtatious romantic charming",
  backstory: "A lover of deep connection.",
};

const caringChar: CharCtx = {
  ...baseChar,
  personality: "caring nurturing warm gentle",
  backstory: "A supportive friend.",
};

// No personality keywords: copy is single-variant now, but keep a generic
// character in the suite to prove copy does not depend on personality.
const genericChar: CharCtx = {
  ...baseChar,
  personality: "neutral",
  backstory: "",
};

describe("buildSeg1Copy", () => {
  it("returns subject, preheader, at least one line, cta", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    expect(copy.subject).toBeTruthy();
    expect(copy.preheader).toBeTruthy();
    expect(copy.lines.length).toBeGreaterThan(0);
    expect(copy.cta).toBeTruthy();
  });

  it("is short (1-2 lines) and names the character in text + subject", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    expect(copy.lines.length).toBeLessThanOrEqual(2);
    expect(copy.subject).toContain("Aria");
    const combined = copy.lines.join(" ");
    expect(combined).toContain("Aria");
    expect(combined).toContain("Alice");
  });

  it("does not include the character bio/description", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    const combined = copy.lines.join(" ");
    expect(combined).not.toContain("mysterious companion");
  });
});

describe("buildSeg2Copy", () => {
  it("is short (1-2 lines) and names the character", () => {
    const copy = buildSeg2Copy(genericChar, "Bob");
    expect(copy.lines.length).toBeLessThanOrEqual(2);
    expect(copy.lines.join(" ")).toContain("Aria");
    expect(copy.subject).toContain("Aria");
  });
});

describe("buildSeg3Copy", () => {
  it("never uses the word 'unlimited'", () => {
    for (const char of [baseChar, flirtyChar, caringChar, genericChar]) {
      const copy = buildSeg3Copy(char, "Alice");
      const allText = [copy.subject, copy.preheader, ...copy.lines].join(" ").toLowerCase();
      expect(allText).not.toContain("unlimited");
    }
  });

  it("mentions premium as a soft nudge", () => {
    const copy = buildSeg3Copy(baseChar, "Alice");
    expect(copy.lines.join(" ").toLowerCase()).toMatch(/premium/);
  });
});

describe("buildSeg4Copy", () => {
  it("never uses the word 'unlimited'", () => {
    for (const char of [baseChar, flirtyChar, caringChar, genericChar]) {
      const copy = buildSeg4Copy(char, "Alice");
      const allText = [copy.subject, copy.preheader, ...copy.lines].join(" ").toLowerCase();
      expect(allText).not.toContain("unlimited");
    }
  });

  it("is short (1-2 lines) and names the character", () => {
    const copy = buildSeg4Copy(baseChar, "Alice");
    expect(copy.lines.length).toBeLessThanOrEqual(2);
    expect(copy.lines.join(" ")).toContain("Aria");
  });
});

describe("renderOverlayEmail", () => {
  const copy = buildSeg1Copy(baseChar, "Alice");

  it("returns a valid HTML doctype", () => {
    const html = renderOverlayEmail({
      char: baseChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://admin.buttercupp.fun/api/unsubscribe?token=tok",
    });
    expect(html).toMatch(/<!doctype html>/i);
  });

  it("includes the character name in output", () => {
    const html = renderOverlayEmail({
      char: baseChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://admin.buttercupp.fun/api/unsubscribe?token=tok",
    });
    expect(html).toContain("Aria");
  });

  it("renders the character photo as a real <img> (not CSS background-image)", () => {
    const html = renderOverlayEmail({
      char: { ...baseChar, imageUrl: "https://cdn.example.com/aria.webp" },
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
    });
    expect(html).toContain('<img src="https://cdn.example.com/aria.webp"');
    expect(html).not.toContain("background-image");
  });

  it("includes the unsubscribe URL in footer", () => {
    const unsubUrl = "https://admin.buttercupp.fun/api/unsubscribe?token=tok123";
    const html = renderOverlayEmail({
      char: baseChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: unsubUrl,
    });
    expect(html).toContain(unsubUrl);
  });

  it("escapes HTML special chars in character name", () => {
    const xssChar: CharCtx = { ...baseChar, name: '<script>alert("xss")</script>' };
    const html = renderOverlayEmail({
      char: xssChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders the fallback hero block when imageUrl is empty", () => {
    const html = renderOverlayEmail({
      char: { ...baseChar, imageUrl: "" },
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
    });
    expect(html).toContain("linear-gradient(160deg");
    expect(html).not.toContain("background-image:url('')");
  });

  it("renders the TEXT wordmark (no broken cid: img) when inlineLogo is not set", () => {
    const html = renderOverlayEmail({
      char: baseChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
    });
    expect(html).not.toContain("cid:");
    expect(html).toContain(">Butter<");
    expect(html).toContain(">cupp<");
  });

  it("renders the cid: logo img only when inlineLogo is true", () => {
    const html = renderOverlayEmail({
      char: baseChar,
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
      inlineLogo: true,
    });
    expect(html).toContain(`src="cid:${LOGO_CID}"`);
  });
});

describe("buildLogoInlineImage", () => {
  it("returns an attachment whose name equals LOGO_CID (so cid: resolves)", () => {
    const logo = buildLogoInlineImage();
    // The logo PNG exists in the repo, so this should be non-null.
    expect(logo).not.toBeNull();
    if (logo) {
      expect(logo.name).toBe(LOGO_CID);
      // Base64, no data: prefix.
      expect(logo.contentBase64.length).toBeGreaterThan(0);
      expect(logo.contentBase64).not.toMatch(/^data:/);
    }
  });
});
