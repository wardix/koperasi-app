import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { NusanetSsoClient } from "../services/nusanet-sso";

describe("NusanetSsoClient Play Store Review Routing", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NUSANET_SSO_BASE_URL = "https://sso.production.example";
    delete process.env.NUSANET_SSO_REVIEW_EMAIL;
    delete process.env.NUSANET_SSO_REVIEW_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses default baseUrl when review override is not configured", () => {
    const client = new NusanetSsoClient();
    expect(client.getBaseUrl("employee@example.com")).toBe("https://sso.production.example");
    expect(client.getBaseUrl()).toBe("https://sso.production.example");
  });

  it("uses reviewBaseUrl when email matches NUSANET_SSO_REVIEW_EMAIL (case-insensitive)", () => {
    process.env.NUSANET_SSO_REVIEW_EMAIL = "reviewer.playstore@example.com";
    process.env.NUSANET_SSO_REVIEW_BASE_URL = "https://demo.nusawork.com";

    const client = new NusanetSsoClient();

    // Matching review email
    expect(client.getBaseUrl("reviewer.playstore@example.com")).toBe("https://demo.nusawork.com");
    expect(client.getBaseUrl("Reviewer.PlayStore@EXAMPLE.com")).toBe("https://demo.nusawork.com");
    expect(client.getBaseUrl("  reviewer.playstore@example.com  ")).toBe("https://demo.nusawork.com");

    // Regular employee email stays on production baseUrl
    expect(client.getBaseUrl("regular.employee@example.com")).toBe("https://sso.production.example");
    expect(client.getBaseUrl()).toBe("https://sso.production.example");
  });

  it("disables review override if NUSANET_SSO_REVIEW_EMAIL is empty or whitespace", () => {
    process.env.NUSANET_SSO_REVIEW_EMAIL = "   ";
    process.env.NUSANET_SSO_REVIEW_BASE_URL = "https://demo.nusawork.com";

    const client = new NusanetSsoClient();
    expect(client.getBaseUrl("reviewer.playstore@example.com")).toBe("https://sso.production.example");
  });

  it("routes requestEmailOtp to reviewBaseUrl when email matches review account", async () => {
    process.env.NUSANET_SSO_REVIEW_EMAIL = "reviewer@example.com";
    process.env.NUSANET_SSO_REVIEW_BASE_URL = "https://demo.nusawork.com";

    const client = new NusanetSsoClient();
    let requestedUrl = "";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      requestedUrl = url.toString();
      return new Response(null, { status: 204 });
    }) as typeof fetch;

    try {
      await client.requestEmailOtp("reviewer@example.com");
      expect(requestedUrl).toContain("https://demo.nusawork.com/auth/api/oauth/email/reviewer%40example.com");

      // Verify regular email routes to production
      await client.requestEmailOtp("regular@example.com");
      expect(requestedUrl).toContain("https://sso.production.example/auth/api/oauth/email/regular%40example.com");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("routes verifyEmailOtp to reviewBaseUrl when email matches review account", async () => {
    process.env.NUSANET_SSO_REVIEW_EMAIL = "reviewer@example.com";
    process.env.NUSANET_SSO_REVIEW_BASE_URL = "https://demo.nusawork.com";
    process.env.NUSANET_SSO_CLIENT_ID = "test-client";
    process.env.NUSANET_SSO_CLIENT_SECRET = "test-secret";

    const client = new NusanetSsoClient();
    const interceptedUrls: string[] = [];

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = url.toString();
      interceptedUrls.push(urlStr);

      if (urlStr.includes("/email/")) {
        return new Response(JSON.stringify({ tmp_token: "tmp-demo-token" }), { status: 200 });
      }
      if (urlStr.includes("/oauth/token")) {
        return new Response(JSON.stringify({
          access_token: "demo-access-token",
          refresh_token: "demo-refresh-token",
          expires_in: 3600
        }), { status: 200 });
      }
      if (urlStr.includes("/user")) {
        return new Response(JSON.stringify({
          id: 999,
          email: "reviewer@example.com",
          name: "Play Store Tester"
        }), { status: 200 });
      }

      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const identity = await client.verifyEmailOtp("reviewer@example.com", "123456");
      expect(identity.email).toBe("reviewer@example.com");
      expect(identity.name).toBe("Play Store Tester");
      expect(identity.subjectId).toBe("999");

      // Verify all 3 downstream calls were routed to demo.nusawork.com
      expect(interceptedUrls.length).toBe(3);
      for (const callUrl of interceptedUrls) {
        expect(callUrl.startsWith("https://demo.nusawork.com")).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
