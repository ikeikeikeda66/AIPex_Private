# AIPex Private

A privacy-hardened fork of [AIPex](https://github.com/AIPexStudio/AIPex), a browser automation agent that runs in your existing browser. This fork is built and audited by its maintainer and is installed manually. It is not published to any extension store.

Upstream: <https://github.com/AIPexStudio/AIPex> (MIT, see [LICENSE](LICENSE)). Fork baseline: upstream commit `4173fa865fed46aa4dd7af19f39a2ecace634116`.

## What this fork does differently

- Bring your own key (BYOK) only. If BYOK is disabled, or the API key or model is empty, the extension shows an error and sends nothing.
- No author-side services: no AI proxy, sign-in, model list, update check, conversation sharing, upload or telemetry endpoint, and no onboarding page on install.
- No MCP bridge, no external messaging (`externally_connectable` is removed), no Skills, and no runtime code fetched from a CDN.
- No external speech recognition. Voice input is removed.
- The API key is sent only to an allowlisted host. Redirects are rejected so the key cannot move to another host. The extension pages carry a `connect-src` policy that lists the same hosts.
- Permissions are reduced to what the remaining tools use. See [docs/PRIVACY.md](docs/PRIVACY.md).

This is not fully local processing. When you chat, your prompt, the page content the agent reads, and screenshots go to the LLM provider you configured.

## Install (manual)

Requirements: Node.js LTS and pnpm 10 or later.

```bash
git clone https://github.com/ikeikeikeda66/AIPex_Private.git
cd AIPex_Private
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
```

1. Open `chrome://extensions` in a dedicated Chrome profile and turn on Developer mode.
2. Choose "Load unpacked" and select `packages/browser-ext/dist`.
3. Open the extension settings, enable your own key, then enter the provider, API key and model.

## Update

There is no automatic update. Pull the commit you reviewed, run the install and build commands again, then press "Reload" on the extension card. Compare the build hashes as described in [docs/PRIVACY.md](docs/PRIVACY.md).

## Development

```bash
pnpm preflight   # format, lint, typecheck, test
```

Project layout and conventions are in [AGENTS.md](AGENTS.md).

## Remaining risks

Cloud LLM transmission, broad page and debugger access, prompt injection from web pages, mistaken actions, and the cost of auditing dependency updates remain. Details are in [docs/PRIVACY.md](docs/PRIVACY.md).

## License

MIT. The original copyright notice is kept in [LICENSE](LICENSE).
