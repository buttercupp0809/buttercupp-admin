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

// No personality keywords: exercises the default copy branch of every builder.
const genericChar: CharCtx = {
  ...baseChar,
  personality: "neutral",
  backstory: "",
};

describe("buildSeg1Copy", () => {
  it("returns subject, preheader, lines, cta, signature", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    expect(copy.subject).toBeTruthy();
    expect(copy.preheader).toBeTruthy();
    expect(copy.lines.length).toBeGreaterThan(0);
    expect(copy.cta).toBeTruthy();
    expect(copy.signature).toBe("Aria");
  });

  it("uses mystery copy branch for mysterious personality", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    expect(copy.subject.toLowerCase()).toMatch(/know|started|waiting/);
  });

  it("uses flirty copy branch for flirtatious personality", () => {
    const copy = buildSeg1Copy(flirtyChar, "Alice");
    expect(copy.subject).toMatch(/Alice/);
  });

  it("uses caring copy branch for caring personality", () => {
    const copy = buildSeg1Copy(caringChar, "Alice");
    expect(copy.subject).toMatch(/Alice|finished/);
  });

  it("includes greeting snippet when greeting is non-empty", () => {
    const copy = buildSeg1Copy(baseChar, "Alice");
    const combined = copy.lines.join(" ");
    expect(combined).toMatch(/waiting for you/i);
  });
});

describe("buildSeg2Copy", () => {
  it("returns short copy (2 lines for generic personality)", () => {
    const genericChar: CharCtx = { ...baseChar, personality: "neutral", backstory: "" };
    const copy = buildSeg2Copy(genericChar, "Bob");
    expect(copy.lines.length).toBeLessThanOrEqual(3);
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
    const copy = buildSeg3Copy(flirtyChar, "Alice");
    const allText = copy.lines.join(" ").toLowerCase();
    expect(allText).toMatch(/premium/);
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

  it("renders fallback hero block when imageUrl is empty", () => {
    const html = renderOverlayEmail({
      char: { ...baseChar, imageUrl: "" },
      copy,
      ctaUrl: "https://buttercupp.fun/onboarding",
      unsubscribeUrl: "https://example.com/unsub",
    });
    // Should have a gradient fallback, not a background-image rule.
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
    // No CID image (which would be broken with no backing attachment).
    expect(html).not.toContain("cid:");
    // The text wordmark is present instead.
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
