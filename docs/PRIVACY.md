# Privacy and audit notes

Scope: the initial hardened version of this fork (issue #1). Baseline for the comparison: upstream commit `4173fa865fed46aa4dd7af19f39a2ecace634116`.

This document does not claim that upstream was malicious or that it ran hidden telemetry. It records what was removed and what remains.

## Network behavior

| Source | Destination | When |
| --- | --- | --- |
| LLM requests | The host in your AI settings, restricted to the allowlist below | Each chat turn, after you enable BYOK and fill key and model |
| Page and tab tools | The web page you operate on | Only the page's own traffic. The extension adds none |

The extension sends nothing else. Removed: AI proxy and cookie-based sign-in, model list fetch, version check, install-time site tab, conversation sharing, screenshot and recording upload functions, server speech recognition, ElevenLabs speech recognition, the Web Speech voice intervention, MCP WebSocket bridge, external website messaging, esm.sh module loading.

If BYOK is not configured, `assertByokConfigured` throws before a provider is created, so no request starts.

### AI host allowlist

Allowed: the preset providers in `packages/core/src/config/ai-providers.ts`, `*.openai.azure.com`, and loopback (`localhost`, `127.0.0.1`, `[::1]`) for local models. Plain `http` is accepted only for loopback. Any other host is rejected in `createAIProvider`, and `createGuardedFetch` checks every request again.

- Redirects are sent with `redirect: "manual"` and rejected, so the key is never forwarded.
- The AI settings screen shows the host that receives the key.
- Changing the host is a manual edit in settings.
- Custom OpenAI-compatible hosts outside the list are not supported in this version. Add the hostname to `AI_PROVIDERS` and to `connect-src` in `packages/browser-ext/manifest.json`, then rebuild. A unit test keeps the two lists in sync.

## Permissions

| Permission | Reason |
| --- | --- |
| `tabs`, `windows`, `tabGroups` | Tab list, switch, create, close, ungroup, and screenshot of a window |
| `activeTab` | Access to the current tab on user action |
| `scripting` | DOM snapshot, element actions, and highlight in pages |
| `debugger` | Trusted input and screenshots through the Chrome DevTools Protocol (`computer` tool) |
| `webNavigation` | Frame discovery for snapshots |
| `downloads` | Saving images from the chat |
| `storage` | Settings, API key, conversations |
| `sidePanel`, `commands` | Side panel and keyboard shortcut |
| `host_permissions: <all_urls>` | The agent must work on any site you choose. It cannot be narrowed without breaking that |

Removed from upstream: `cookies`, `history`, `bookmarks`, `management`, `browsingData`, `sessions`, `contextMenus`, `alarms`, `audioCapture`, the duplicate `https://*/*` and `http://*/*` host patterns, and `externally_connectable`. The matching history and bookmark context sources and unused tools were deleted.

The content script runs on all URLs and in all frames because the agent overlay and capture features need it.

## API key storage and removal

The key is stored unencrypted in `chrome.storage.local` under the settings entry of this extension. Any code that runs inside the extension can read it. To remove it, clear the key in the AI settings and save, or remove the extension. Do not export or share the browser profile.

Logs: error handlers print error objects, not settings or the key. The AI SDK error objects can include the request body, which holds page content, so avoid sharing the extension console output.

## Build and hashes

Build only from a commit you reviewed.

```bash
git rev-parse HEAD
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
(cd packages/browser-ext/dist && find . -type f -print0 | sort -z | xargs -0 shasum -a 256) > build-hashes.txt
shasum -a 256 build-hashes.txt
```

Store `build-hashes.txt` and the commit hash together outside the repository. Re-run the build and compare before you trust a new build. The first build output of this change was not inspected in this session (see the report in issue #1).

## Dependencies

- `pnpm-lock.yaml` is committed. Install with `--frozen-lockfile --ignore-scripts`.
- Install scripts are allowed by `pnpm-workspace.yaml` (`allowBuilds`) for `@j178/prek` (git hook installer), `esbuild`, `protobufjs`, and `puppeteer` (a dev dependency of the runtime tests that downloads Chromium). Use `--ignore-scripts` unless you need those.
- `pnpm audit --prod` on this branch reported 81 findings (1 critical, 27 high, 46 moderate, 7 low). The critical and most high findings are in server-side packages that `@openai/agents-extensions` pulls in (`proxy-addr`, `hono`, `express-rate-limit`, `@modelcontextprotocol/sdk`, `path-to-regexp`, `ws`) and in build tooling (`browserslist`, `minimatch`, `braces`, `tmp`). Whether any of them is in the built extension bundle is not verified.

## Residual risks

- Cloud LLM transmission: prompts, page text, and screenshots leave the machine.
- Broad access: all-site access and `debugger` let the agent read and act on any page you open, including logged-in pages.
- Prompt injection: a web page can contain text that steers the model. There is no confirmation step before send, purchase, or delete actions.
- Mistaken actions: the model can click or type the wrong thing.
- Dependency updates: every update needs a new review and a new hash comparison.

## Follow-up (not in this version)

- Re-introducing MCP needs token authentication, strict extension ID checks, user approval of connections, localhost-only binding, and exit on disconnect.
- Skills need bundled, audited code and a permission design.
- A local LLM option would allow fully local processing.
- Confirmation before send, purchase, and delete actions.
