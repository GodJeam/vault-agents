# Vault Agents

An **Obsidian** plugin that integrates local AI agents into your vault: chat with AI agents, analyze notes, attach files, and manage sessions without leaving Obsidian.

> **Note**: this project was entirely generated using large language models (LLMs). The code received **little personal review**: use it with due caution, test it, and report or fix any issues you find.

## Features

- **Multi-Agent Architecture**: Support for multiple local AI agents, easily switchable directly from the interface and designed to accommodate additional CLI agents in the future.
- **Fast Model Switcher**: Native modal dialog (`/model` or the model button) with real-time fuzzy search to quickly find and switch models across all available engines.
- **Tool Inspection**: Interactive display of tool and command executions directly in the chat with expandable input/output details.
- **Chat in Obsidian**: Fast pane chat with streaming responses and reasoning indicators.
- **Identical UX & Workflow**: The exact same UI, shortcuts, attachments, session controls, and tool inspection work seamlessly across all supported agents.
- **Slash commands**: `/` for actions (model, new session, stats, prompts, ...), `@` to attach vault files, `!` for quick actions.
- **Reusable prompt templates** inserted in the chat with `/prompt`.
- **Multiple chat windows**, each with its own session, to work on several sessions at the same time.
- **Session management**: pin, rename and delete sessions.
- **Document conversion**: PDF, Word, Excel, etc. are converted to Markdown with [anydoc](https://github.com/firecrawl/anydoc) before being sent, so any model can read them.
- **Context and cost awareness**: session context usage bar, token/cost stats, and a live indicator of whether the model is still working or stuck.
- **Continue past the context limit**: when a session saturates, summarize and continue in a new session.

## Requirements

- **Obsidian** desktop **1.5.0** or newer (Windows/macOS/Linux).
- At least **one** supported agent CLI installed and available on your `PATH`:
  - **Antigravity CLI** (`agy`), **1.3.x** (tested with 1.3.5).
  - **OpenCode CLI** (`opencode`), **2.x** (tested with 2.0.29).
- **[sqlite3](https://sqlite.org/)** on your `PATH` — used by the Antigravity session manager and by the OpenCode database self-cleanup.
- [anydoc](https://github.com/firecrawl/anydoc) (optional, for document conversion): `npm install -g @firecrawl/anydoc`.

### Agent CLI compatibility

| Component | Tested with | Minimum | Notes |
| --- | --- | --- | --- |
| Obsidian | 1.5.7 | 1.5.0 | Desktop only (`isDesktopOnly: true`). |
| Antigravity CLI (`agy`) | 1.3.5 | 1.3.x | Runs `agy --print --output-format stream-json --model … --effort …`. Model ids already embed the reasoning effort (e.g. `gemini-3.8-flash-low`), so `--effort` is only sent for models without a suffix. |
| OpenCode CLI (`opencode`) | 2.0.29 | 2.x | Uses `opencode run --format json`, `opencode models`, `opencode session …`, `opencode debug paths`, and the local API (`opencode api GET /api/model`, `/api/session/{id}`, `/api/experimental/session/stats`). |
| sqlite3 | 3.51.2 | any recent | Session management for Antigravity and database cleanup for OpenCode. |
| anydoc (optional) | 0.2.4 | 0.2.x | Document → Markdown conversion for attachments. |

> **OpenCode 1.x is not supported.** The integration relies on the local API introduced in OpenCode 2.x (`opencode api …`) for model context limits and token/usage statistics; older releases exposed a different CLI surface (e.g. `opencode db`) that has since been removed.

### Platform requirements

The plugin is cross-platform: the chat, sessions, `/ @ !` commands, stats, and history management work on **Windows, macOS, and Linux**.

On **all** platforms:
- **Node.js** (to build the plugin) and the agent CLIs on your `PATH`.
- **sqlite3** available on your `PATH` (see the compatibility table above).

### Build & test

```bash
npm install
npm run build
npm test
```

> Building produces `main.js` in the repository. `npm test` runs the offline fixture-based test suite (`node --test` + `esbuild`) without requiring authenticated CLIs. Copy `main.js`, `manifest.json` and `styles.css` into your vault's `.obsidian/plugins/vault-agents/` folder and reload the plugin in Obsidian to apply the changes.

## Installation

1. Clone the repo and build:

```bash
git clone https://github.com/GodJeam/vault-agents.git
cd vault-agents
npm install
npm run build
```

2. Copy the generated files into your vault:

```
<vault>/.obsidian/plugins/vault-agents/
    ├── main.js
    ├── manifest.json
    └── styles.css
```

3. In Obsidian: Settings → Community plugins → enable **Vault Agents**.

## Usage

- Open the chat from the sidebar icon or the command palette (`Ctrl+P` → "New Vault Agents chat").
- In the plugin settings, verify the binary paths and models.
- Use **"Continue in a new session (by summarizing)"** to keep going when a session saturates its context.
- The interface is in **English** by default; switch to Italian in Settings → Language (reload Obsidian to apply everywhere).
- Save reusable **prompt templates** in Settings → Prompt templates and insert them in the chat with `/prompt`.

## Project Structure

```text
src/
├── core/                        # Provider descriptors, registry, settings migration, and types
├── providers/
│   ├── antigravity/             # Antigravity CLI descriptor, runner & stream parser
│   ├── opencode/                # OpenCode CLI descriptor, runner & stream parser
│   └── base.ts                  # Shared process execution, JSONL stream loop & CLI utilities
├── features/
│   ├── chat/                    # Chat view, streaming bubbles, step widgets, suggest popup & attachments
│   └── settings/                # Data-driven settings tab rendered from provider descriptors
├── shared/                      # Reusable UI modals (file suggest, model switcher, stats)
├── i18n/                        # Internationalization (English, Italian)
└── main.ts                      # Plugin lifecycle and command palette registration
test/
├── fixtures/                    # Recorded .ndjson stream fixtures for offline testing
└── suite.test.ts                # Unit tests for stream parsers, settings migration, and CLI flags
```

- `build/` — build and test tooling (`esbuild.config.mjs`, `run-tests.mjs`, `tsconfig.json`)
- `main.js` / `manifest.json` / `styles.css` — built plugin files (copy into the vault)

## License

GPL-3.0 — see [LICENSE](LICENSE).