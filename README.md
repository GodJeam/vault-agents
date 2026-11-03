# Vault Agents

An **Obsidian** desktop plugin that connects local AI CLI agents (**Antigravity**, **OpenCode**, **Hermes Agent**, and **Pi**) directly to your vault: chat with agents, analyze notes, attach files, inspect tool calls, and manage sessions without leaving Obsidian.

## Features

- **Multi-Agent Architecture**: Switch seamlessly between **Antigravity (`agy`)**, **OpenCode (`opencode`)**, **Hermes (`hermes`)**, and **Pi (`pi`)** via `/agent` or the header agent selector.
- **Grouped Model Switcher (`/model`)**: Collapsible provider groups, filter chips, fuzzy search, live CLI **Refresh**, and custom model ID input, backed by universal runtime model and context window discovery (`1M` / `500K` / `256K` / `200K`).
- **Live Activity & Tool Inspection**: Real-time streaming responses, reasoning blocks, human-readable tool step badges with expandable `INPUT`/`OUTPUT` payloads, and interactive multi-choice question cards.
- **Vault Integration**: `/` slash commands (`/agent`, `/model`, `/new`, `/stats`, `/prompt`, `/pin`, `/rename`), `@` vault file attachments, `!` quick actions, and reusable prompt templates.
- **Document Conversion**: Optional automatic conversion of PDF, Word, and Excel attachments to Markdown via [anydoc](https://github.com/firecrawl/anydoc). Hosted OCR is opt-in.
- **Session & Context Management**: Multiple independent chat panes, context usage bar, token/cost statistics (`5h`, `week`, `month`), and automatic session continuation via summarization when context saturates.
- **Secure Defaults**: Auto-approve is off, hosted OCR is off, remote images in agent replies are neutralized, and chat history retention is bounded and configurable.

## Requirements

- **Obsidian** desktop **1.5.0+** (Windows, macOS, Linux).
- At least **one** supported agent CLI installed on your `PATH`:

| CLI | Binary | Minimum | Tested | Notes |
| --- | --- | --- | --- | --- |
| **Antigravity** | `agy` | 1.3.x | 1.3.5 | Google AI Pro subscription (`--output-format stream-json`). |
| **OpenCode** | `opencode` | 2.x | 2.0.29 | OpenCode 2.x JSON stream & local model/session API (`1.x` not supported). |
| **Hermes Agent** | `hermes` | 0.22+ | 0.22.5 | Nous Research CLI (`--format stream-json`) with native multi-provider discovery. |
| **Pi Coding Agent** | `pi` | 0.60+ | 0.68.0 | `@mariozechner/pi-coding-agent` (`--mode json --list-models`). |

- **[sqlite3](https://sqlite.org/)** on your `PATH` (used for Antigravity session lookup and OpenCode database management).
- **[anydoc](https://github.com/firecrawl/anydoc)** *(optional, for PDF/Office conversion)*: `npm install -g @firecrawl/anydoc`.

## Installation

### From Obsidian Community Plugins (Recommended)

1. Open **Settings → Community plugins → Browse** in Obsidian.
2. Search for **Vault Agents**, click **Install**, and then **Enable**.

### From Source

```bash
git clone https://github.com/GodJeam/vault-agents.git
cd vault-agents
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/vault-agents/` and enable the plugin in Obsidian.

## Project Structure

```text
src/
├── core/         # Provider descriptors, registry, settings migration & types
├── providers/    # CLI runners & stream parsers (antigravity, opencode, hermes, pi)
├── features/     # Chat view, bubbles, tool widgets, question cards & settings tab
├── shared/       # Agent switcher, grouped model switcher, file suggest & modals
├── i18n/         # English and Italian translations
└── main.ts       # Plugin entry point and command registration
test/
├── fixtures/     # Recorded .ndjson stream fixtures
├── mock-cli.mjs  # Offline Mock CLI Simulator
└── suite.test.ts # Unit and end-to-end test suite (npm test)
```

## Privacy & data handling

Vault Agents runs locally inside Obsidian and does not include telemetry, analytics, or its own network client. All model requests go through the CLI agents you install and configure. Still, some features handle data you should be aware of:

### Chat history

- Messages, reasoning blocks, token counts, and costs are saved in **plain text** in `<vault>/.obsidian/plugins/vault-agents/data.json`.
- By default the plugin keeps the **50 most recent sessions** or **5 MB**, whichever limit is reached first. Older sessions are pruned on save.
- Active and pinned sessions are always preserved.
- You can disable persistence with **Settings → Vault Agents → Chat history → Save chat history in the vault**. The current session then stays in memory only.
- If your vault is synced or shared, `data.json` may be synced or shared with it.

### Note content and attachments

- The text you send, attached files, and note contexts are passed to the selected CLI and therefore to the AI provider configured in that CLI. Their privacy terms apply.
- Attached documents are converted locally by default. If you enable **Send documents to hosted OCR**, scanned documents are uploaded to the external **Firecrawl Parse** service. This is off by default and shows a warning in Settings.
- Converted documents are cached in `$TMPDIR/vault-agents-anydoc` with owner-only permissions (`0700` directory, `0600` files) and are cleaned up after 24 hours.

### Process environment

- CLI processes inherit the environment of the Obsidian process so they can use their normal authentication (API keys, tokens, proxy settings). Avoid launching Obsidian with secrets that the agents do not need.

### Local agent databases

- Session listing, rename, and delete operations read or update the local SQLite databases managed by OpenCode and Antigravity.
- Database cleanup is **manual** (Settings → Database self-cleanup). Before deleting oversized file parts from `opencode.db`, the plugin creates an `opencode.db.bak` backup.

### Permissions and remote content

- **Auto-approve is disabled by default.** When enabled, agents can run shell commands and edit files without asking for confirmation. Enable it only for vaults and notes you trust.
- Remote images and media embedded in agent responses are replaced with plain text so opening a message cannot silently contact a third-party server. Normal links remain clickable.

## Contributing

All development takes place on the **`dev`** branch. Please read [**CONTRIBUTIONS.md**](CONTRIBUTIONS.md) before opening a Pull Request.

## License

GPL-3.0 — see [LICENSE](LICENSE).
