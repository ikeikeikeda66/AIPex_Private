import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertByokConfigured,
  BYOK_NOT_CONFIGURED_MESSAGE,
  createAIProvider,
  createGuardedFetch,
  getAllowedAiHostnames,
  isAllowedAiHostname,
  isByokConfigured,
} from "./ai-provider";

// Provide minimal mock for import.meta.env
vi.stubGlobal("import", { meta: { env: { PROD: false } } });

describe("createAIProvider", () => {
  describe("URL validation", () => {
    it("accepts valid https URLs", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "https://api.openai.com/v1",
        }),
      ).not.toThrow();
    });

    it("accepts undefined aiHost", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
        }),
      ).not.toThrow();
    });

    it("accepts empty string aiHost", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "",
        }),
      ).not.toThrow();
    });

    it("rejects invalid URLs", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "not-a-url",
        }),
      ).toThrow("Invalid aiHost URL");
    });

    it("rejects non-http protocols", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "ftp://evil.com",
        }),
      ).toThrow("Unsupported protocol");
    });

    it("rejects hosts outside the allowlist", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "https://evil.example.com/v1",
        }),
      ).toThrow("not in the allowed AI host list");
    });

    it("rejects lookalike hosts of allowed providers", () => {
      expect(isAllowedAiHostname("api.openai.com.evil.test")).toBe(false);
      expect(isAllowedAiHostname("evilapi.openai.com.test")).toBe(false);
    });

    it("rejects the former author-side proxy host", () => {
      expect(isAllowedAiHostname("www.claudechrome.com")).toBe(false);
    });

    it("accepts Azure OpenAI resources and loopback hosts", () => {
      expect(isAllowedAiHostname("my-res.openai.azure.com")).toBe(true);
      expect(() =>
        createAIProvider({
          aiProvider: "custom" as any,
          aiToken: "k",
          aiHost: "http://localhost:11434/v1",
        }),
      ).not.toThrow();
    });

    it("rejects plain http for non-loopback hosts", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          aiHost: "http://api.openai.com/v1",
        }),
      ).toThrow("must use https");
    });

    it("rejects javascript: protocol", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "openai",
          aiToken: "sk-test",
          // eslint-disable-next-line no-script-url
          aiHost: "javascript:alert(1)",
        }),
      ).toThrow("Unsupported protocol");
    });
  });

  describe("provider creation", () => {
    it("creates openai provider by default", () => {
      const provider = createAIProvider({
        aiProvider: "openai",
        aiToken: "sk-test",
      });
      expect(provider).toBeDefined();
    });

    it("creates anthropic provider", () => {
      const provider = createAIProvider({
        aiProvider: "anthropic",
        aiToken: "sk-test",
      });
      expect(provider).toBeDefined();
    });

    it("creates google provider", () => {
      const provider = createAIProvider({
        aiProvider: "google",
        aiToken: "sk-test",
      });
      expect(provider).toBeDefined();
    });

    it("requires baseURL for custom providers", () => {
      expect(() =>
        createAIProvider({
          aiProvider: "custom" as any,
          aiToken: "sk-test",
        }),
      ).toThrow("requires aiHost");
    });

    it("creates custom provider with an allowed baseURL", () => {
      const provider = createAIProvider({
        aiProvider: "custom" as any,
        aiToken: "sk-test",
        aiHost: "https://api.deepseek.com/v1",
      });
      expect(provider).toBeDefined();
    });
  });
});

describe("BYOK configuration", () => {
  it.each([
    ["byok disabled", { byokEnabled: false, aiToken: "k", aiModel: "m" }],
    ["byok flag missing", { aiToken: "k", aiModel: "m" }],
    ["empty key", { byokEnabled: true, aiToken: "  ", aiModel: "m" }],
    ["empty model", { byokEnabled: true, aiToken: "k", aiModel: "" }],
  ])("stops without a provider when %s", (_name, settings) => {
    expect(isByokConfigured(settings as any)).toBe(false);
    expect(() => assertByokConfigured(settings as any)).toThrow(
      BYOK_NOT_CONFIGURED_MESSAGE,
    );
  });

  it("passes when enabled with key and model", () => {
    expect(() =>
      assertByokConfigured({
        byokEnabled: true,
        aiToken: "k",
        aiModel: "m",
      } as any),
    ).not.toThrow();
  });
});

describe("createGuardedFetch", () => {
  it("does not call the network for a disallowed host", async () => {
    const base = vi.fn();
    const guarded = createGuardedFetch(undefined, base);
    await expect(guarded("https://evil.example.com/x")).rejects.toThrow(
      "not in the allowed AI host list",
    );
    expect(base).not.toHaveBeenCalled();
  });

  it("does not call the network for a host other than the validated one", async () => {
    const base = vi.fn();
    const guarded = createGuardedFetch("api.openai.com", base);
    await expect(guarded("https://api.deepseek.com/v1/chat")).rejects.toThrow(
      "expected",
    );
    expect(base).not.toHaveBeenCalled();
  });

  it("sends redirect: manual and rejects redirect responses", async () => {
    const base = vi.fn().mockResolvedValue({ type: "default", status: 302 });
    const guarded = createGuardedFetch("api.openai.com", base);
    await expect(guarded("https://api.openai.com/v1/chat")).rejects.toThrow(
      "Blocked redirect",
    );
    expect(base.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("rejects opaque redirects", async () => {
    const base = vi
      .fn()
      .mockResolvedValue({ type: "opaqueredirect", status: 0 });
    const guarded = createGuardedFetch("api.openai.com", base);
    await expect(guarded("https://api.openai.com/v1/chat")).rejects.toThrow(
      "Blocked redirect",
    );
  });

  it("returns normal responses", async () => {
    const ok = { type: "default", status: 200 };
    const base = vi.fn().mockResolvedValue(ok);
    const guarded = createGuardedFetch("api.openai.com", base);
    await expect(guarded("https://api.openai.com/v1/chat")).resolves.toBe(ok);
  });
});

describe("manifest connect-src", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, "../../manifest.json"), "utf8"),
  ) as {
    content_security_policy: { extension_pages: string };
    externally_connectable?: unknown;
    host_permissions: string[];
    permissions: string[];
  };
  const connectSrc = manifest.content_security_policy.extension_pages
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith("connect-src"));

  it("allows every allowlisted AI hostname", () => {
    for (const hostname of getAllowedAiHostnames()) {
      expect(connectSrc).toContain(hostname);
    }
  });

  it("allows only allowlisted https/http origins besides self, blob and data", () => {
    const origins = (connectSrc ?? "")
      .split(/\s+/)
      .slice(1)
      .filter((src) => /^https?:/.test(src));
    for (const origin of origins) {
      const hostname = origin
        .replace(/^https?:\/\//, "")
        .replace(/:\*$/, "")
        .replace(/^\*\./, "x.");
      expect(
        isAllowedAiHostname(hostname) || hostname === "x.openai.azure.com",
      ).toBe(true);
    }
  });

  it("has no external messaging or removed permissions", () => {
    expect(manifest.externally_connectable).toBeUndefined();
    for (const removed of [
      "cookies",
      "history",
      "bookmarks",
      "management",
      "browsingData",
      "sessions",
      "alarms",
      "audioCapture",
    ]) {
      expect(manifest.permissions).not.toContain(removed);
    }
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
  });
});
