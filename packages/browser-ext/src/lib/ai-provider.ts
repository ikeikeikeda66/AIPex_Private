/**
 * AI Provider Factory
 * Creates AI SDK provider instances from the user's own (BYOK) settings.
 *
 * There is no fallback endpoint: when the settings are incomplete, no provider
 * is created and nothing is sent over the network. The API key is only sent to
 * hosts in the allowlist built by `getAllowedAiHostnames`.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  AI_PROVIDERS,
  type AIProviderKey,
  type AppSettings,
} from "@aipexstudio/aipex-core";

export interface ProviderConfig {
  provider: AIProviderKey;
  apiKey: string;
  baseURL?: string;
}

export const BYOK_NOT_CONFIGURED_MESSAGE =
  "AI is not configured. Enable your own API key, then set the API key and model in Settings. No request was sent.";

const DEFAULT_PROVIDER_HOSTNAMES = [
  "api.openai.com",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
];

const AZURE_HOSTNAME_SUFFIX = ".openai.azure.com";

const LOOPBACK_HOSTNAMES = ["localhost", "127.0.0.1"];

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Hostnames that may receive the API key: the preset providers, Azure OpenAI
 * resources, and loopback addresses for locally hosted models.
 */
export function getAllowedAiHostnames(): string[] {
  const presetHostnames = Object.values(AI_PROVIDERS).flatMap((provider) => {
    const host = "host" in provider ? provider.host : undefined;
    const hostname = host ? safeHostname(host) : undefined;
    return hostname && !hostname.startsWith("your-resource") ? [hostname] : [];
  });
  return [
    ...new Set([
      ...DEFAULT_PROVIDER_HOSTNAMES,
      ...presetHostnames,
      ...LOOPBACK_HOSTNAMES,
    ]),
  ];
}

export function isAllowedAiHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    getAllowedAiHostnames().includes(normalized) ||
    normalized.endsWith(AZURE_HOSTNAME_SUFFIX)
  );
}

/**
 * Validate the destination of the API key: http(s) only, plain http only for
 * loopback, and the hostname must be in the allowlist.
 */
function validateHostUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid aiHost URL: ${url}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `Unsupported protocol in aiHost: ${parsed.protocol} (only http/https allowed)`,
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!isAllowedAiHostname(hostname)) {
    throw new Error(
      `aiHost "${hostname}" is not in the allowed AI host list. The API key was not sent.`,
    );
  }

  if (parsed.protocol === "http:" && !LOOPBACK_HOSTNAMES.includes(hostname)) {
    throw new Error(`aiHost must use https unless it is a loopback address`);
  }

  return parsed.origin + parsed.pathname.replace(/\/+$/, "");
}

/**
 * Check whether the current settings represent a complete BYOK configuration.
 */
export function isByokConfigured(settings: AppSettings): boolean {
  if (!settings.byokEnabled) return false;

  const hasToken = Boolean(settings.aiToken?.trim());
  const hasModel = Boolean(settings.aiModel?.trim());
  return hasToken && hasModel;
}

export function assertByokConfigured(settings: AppSettings): void {
  if (!isByokConfigured(settings)) {
    throw new Error(BYOK_NOT_CONFIGURED_MESSAGE);
  }
}

/**
 * Fetch wrapper that keeps the API key on the validated host: requests to any
 * other hostname and redirects are rejected before the key can leave.
 */
export function createGuardedFetch(
  allowedHostname: string | undefined,
  baseFetch: typeof globalThis.fetch = (...args) => globalThis.fetch(...args),
): typeof globalThis.fetch {
  return async (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const hostname = safeHostname(requestUrl);
    if (!hostname || !isAllowedAiHostname(hostname)) {
      throw new Error(
        `Blocked request to "${hostname ?? requestUrl}": not in the allowed AI host list`,
      );
    }
    if (allowedHostname && hostname !== allowedHostname) {
      throw new Error(
        `Blocked request to "${hostname}": expected "${allowedHostname}"`,
      );
    }

    const response = await baseFetch(input, { ...init, redirect: "manual" });
    if (
      response.type === "opaqueredirect" ||
      (response.status >= 300 && response.status < 400)
    ) {
      throw new Error(
        "Blocked redirect from the AI host. The API key was not forwarded.",
      );
    }
    return response;
  };
}

/**
 * Create an AI SDK provider from BYOK settings.
 */
export function createAIProvider(settings: AppSettings) {
  const provider = settings.aiProvider ?? "openai";
  const apiKey = settings.aiToken ?? "";
  const baseURL = validateHostUrl(settings.aiHost || undefined);

  const defaultHostname =
    provider === "anthropic"
      ? "api.anthropic.com"
      : provider === "google"
        ? "generativelanguage.googleapis.com"
        : provider === "openai"
          ? "api.openai.com"
          : undefined;
  const allowedHostname = baseURL ? safeHostname(baseURL) : defaultHostname;
  const fetch = createGuardedFetch(allowedHostname);

  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey, baseURL, fetch });
    case "google":
      return createGoogleGenerativeAI({ apiKey, baseURL, fetch });
    case "openai":
      return createOpenAI({ apiKey, baseURL, fetch });
    default:
      if (!baseURL) {
        throw new Error(
          `Custom provider "${provider}" requires aiHost to be specified`,
        );
      }
      return createOpenAICompatible({ apiKey, baseURL, name: provider, fetch });
  }
}
