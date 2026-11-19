# Vault Agents

An **Obsidian** desktop plugin that connects local AI CLI agents (**Antigravity**, **OpenCode**, **Hermes Agent**, and **Pi**) directly to your vault. Chat with agents, attach vault notes or documents, inspect live tool calls, and manage sessions without leaving Obsidian.

## Features

- **Multi-agent switching**: Switch between **Antigravity (`agy`)**, **OpenCode (`opencode`)**, **Hermes Agent (`hermes`)**, and **Pi (`pi`)** via `/agent` or the chat composer.
- **Model switcher (`/model`)**: Searchable picker grouped by provider, filter chips, live CLI refresh, custom model IDs, and automatic context-window detection.
- **Live activity & tool inspection**: Streaming responses, collapsible reasoning blocks, tool steps with expandable inputs/outputs, and interactive multi-choice prompts.
- **Vault integration**: `/` commands (`/agent`, `/model`, `/new`, `/note`, `/attach`, `/stats`, `/pin`, `/rename`, `/prompt`), `@` vault file attachments, `!` quick actions, saved prompt templates, and Command Palette actions (send selection, use/analyze current note).
- **Document conversion**: Optional PDF, Word, and Excel conversion to Markdown via [anydoc](https://github.com/firecrawl/anydoc) (hosted OCR is off by default).
- **Session & context tracking**: Independent chat tabs, local session titles, context usage bar, token/cost stats (`5h`, `week`, `month`), and optional auto-continuation by summary when context reaches 92%.
- **Secure defaults**: Auto-approve off, hosted OCR off, remote media and remote `<style>` rules neutralized in replies while preserving normal links, credential redaction on errors and tool I/O details, and bounded local history.

## Requirements

- **Obsidian** desktop **1.5.0+** (Windows, macOS, Linux).
- At least **one** supported CLI installed on your `PATH`:

| CLI | Binary | Minimum | Tested | Notes |
| --- | --- | --- | --- | --- |
| **Antigravity** | `agy` | 1.3.x | 1.3.5 | Google AI Pro subscription (`--output-format stream-json`). |
| **OpenCode** | `opencode` | 2.x | 2.0.29 | OpenCode 2.x JSON stream & local DB/API (`1.x` not supported). |
| **Hermes Agent** | `hermes` | 0.22+ | 0.22.5 | Nous Research CLI (`--format stream-json`). |
| **Pi Coding Agent** | `pi` | 0.60+ | 0.68.0 | `@mariozechner/pi-coding-agent` (`--print --mode json`). |

- **[sqlite3](https://sqlite.org/)** on your `PATH` (used for Antigravity, OpenCode, and Hermes session/token lookups).
- **[anydoc](https://github.com/firecrawl/anydoc)** *(optional, for PDF/Office attachments)*: `npm install -g @firecrawl/anydoc`.

## Installation

### Obsidian Community Plugins (Recommended)

1. Open **Settings → Community plugins → Browse** in Obsidian.
2. Search for **Vault Agents**, click **Install**, and **Enable**.

### From Source

```bash
git clone https://github.com/GodJeam/vault-agents.git
cd vault-agents
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/vault-agents/` and enable the plugin in Obsidian.

## Usage

1. Click the **Vault Agents** ribbon icon or run **Open Vault Agents chat** from the Command Palette.
2. Pick an agent and model from the composer chips (or configure CLI paths and defaults in **Settings → Vault Agents**).
3. Type `/` for commands, `@` to attach vault files, or `!` for quick actions. Use **Test connection** in Settings if a CLI is not on your default `PATH`.

## Privacy & Data Handling

Vault Agents runs locally inside Obsidian without telemetry, analytics, or its own network client; model traffic goes exclusively through your configured CLI tools.

- **Chat history**: Saved in plain text in `<vault>/.obsidian/plugins/vault-agents/data.json` (default cap: 50 sessions or 5 MB; active and pinned sessions are kept). You can disable persistence under **Settings → Vault Agents → Chat history → Save chat history in the vault** so sessions stay in memory only. Note that synced vaults will also sync `data.json`.
- **Notes & attachments**: Sent prompts, attached files, and note context are forwarded to the active CLI and its configured AI provider. Documents are converted locally by `anydoc` (with a 60s timeout); enabling **Send documents to hosted OCR** uploads scanned files to Firecrawl Parse (off by default). Cached conversions live in a per-user `$TMPDIR/vault-agents-anydoc-<uid>` directory on POSIX (`$TMPDIR/vault-agents-anydoc` on Windows, `0700` directory, `0600` files) and expire after 24 hours.
- **Process environment**: Spawned CLIs inherit Obsidian's environment so existing CLI authentication and proxy settings work.
- **Local agent databases**: Session listing, token stats, rename, and delete read or use the CLI databases for Antigravity, OpenCode, and Hermes. **Database self-cleanup** is manual-only and creates a WAL-safe `opencode.db.bak` snapshot (via SQLite `VACUUM INTO`, with file-copy fallback) before pruning oversized parts.
- **Permissions & remote media**: **Auto-approve permissions** is disabled by default; enable it only in trusted vaults. Remote images, media, and remote CSS imports in agent replies are neutralized to prevent silent third-party requests while keeping normal and reference-style links clickable.

## Project Structure

```text
src/
├── core/         # Provider interfaces, registry, redaction, settings & history
├── providers/    # CLI runners & stream parsers (antigravity, opencode, hermes, pi)
├── features/     # Chat view, bubbles, step widgets, question cards & settings UI
├── shared/       # Agent/model switchers, icons, file suggest & modals
├── i18n/         # English and Italian translations
└── main.ts       # Plugin entry point & Obsidian commands
test/
├── fixtures/     # Recorded NDJSON stream fixtures
├── mock-cli.mjs  # Offline mock CLI for testing without real binaries
└── suite.test.ts # Unit and end-to-end tests (npm test)
```

## Contributing

Development happens on the `dev` branch. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a Pull Request.

## License

GPL-3.0 (see [LICENSE](LICENSE)).
