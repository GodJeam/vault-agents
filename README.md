# Vault Agents

An **Obsidian** plugin that integrates local AI agents into your vault: chat with AI agents, analyze notes, attach files, and manage sessions without leaving Obsidian.

> **Note**: this project was entirely generated using large language models (LLMs). The code received **little personal review**: use it with due caution, test it, and report or fix any issues you find.

## Features

- **Multi-Agent Architecture**: Seamless support for **4 local AI CLI agents** (**Antigravity**, **OpenCode**, **Hermes Agent**, and **Pi**), easily switchable directly from the interface with distinct provider icons.
- **Dedicated Agent & Grouped Model Switchers**:
  - **Agent Switcher** (`/agent` or the agent header pill): switch the active CLI engine per session and inspect each engine's current model.
  - **Grouped Model Switcher** (`/model` or the model header pill): collapsible provider groups, quick provider filter chips, real-time fuzzy search, live **Refresh** from the CLI, and **Custom model ID** entry for unlisted or custom endpoints.
- **Universal Dynamic Model & Context Discovery**: Queries each CLI's native runtime/catalog (`hermes_cli.models` & `agent.model_metadata`, `pi --list-models`, `opencode models` & `/api/model`, `agy`, etc.) so any provider or subscription configured by the user works out of the box with accurate context window limits (including `1M` / `500K` / `256K` / `200K` models).
- **Interactive Agent Questions**: When an agent asks clarifying questions (`question` in OpenCode, `ask_question` in Antigravity, `AskUserQuestion` in Hermes/Pi), an interactive card is rendered directly in the chat with single/multi-select options and custom answer inputs.
- **Live Activity & Human-Readable Tool Steps**: Animated live status pill with phase descriptions, elapsed timer, and human-friendly tool badges (with target file/command, duration, and visual task checklists) instead of raw CLI tool keywords.
- **Tool Inspection**: Interactive display of tool and command executions directly in the chat with expandable input/output details.
- **Chat in Obsidian**: Fast pane chat with streaming responses and reasoning indicators.
- **Identical UX & Workflow**: The exact same UI, Lucide icon system, shortcuts, attachments, session controls, and tool inspection work seamlessly across all supported agents.
- **Slash commands**: `/` for actions (`/model`, `/agent`, `/new`, `/stats`, `/prompt`, ...), `@` to attach vault files, `!` for quick actions.
- **Reusable prompt templates** inserted in the chat with `/prompt`.
- **Multiple chat windows**, each with its own session and independent agent/model selection, to work on several sessions at the same time.
- **Session management**: pin, rename, and delete sessions across engines.
- **Document conversion**: PDF, Word, Excel, etc. are converted to Markdown with [anydoc](https://github.com/firecrawl/anydoc) before being sent, so any model can read them.
- **Context and cost awareness**: session context usage bar, token/cost stats, and a live indicator of whether the model is still working or stuck.
- **Continue past the context limit**: when a session saturates, summarize and continue in a new session.

## Requirements

- **Obsidian** desktop **1.5.0** or newer (Windows/macOS/Linux).
- At least **one** supported agent CLI installed and available on your `PATH`:
  - **Antigravity CLI** (`agy`), **1.3.x** (tested with 1.3.5).
  - **OpenCode CLI** (`opencode`), **2.x** (tested with 2.0.29).
  - **Hermes Agent CLI** (`hermes`), **0.22+** (tested with 0.22.5).
  - **Pi Coding Agent CLI** (`pi` — `@mariozechner/pi-coding-agent`), **0.60+** (tested with 0.68.0).
- **[sqlite3](https://sqlite.org/)** on your `PATH` — used by the Antigravity session manager and by the OpenCode database self-cleanup.
- [anydoc](https://github.com/firecrawl/anydoc) (optional, for document conversion): `npm install -g @firecrawl/anydoc`.

### Agent CLI compatibility

| Component | Tested with | Minimum | Notes |
| --- | --- | --- | --- |
| Obsidian | 1.5.7 | 1.5.0 | Desktop only (`isDesktopOnly: true`). |
| Antigravity CLI (`agy`) | 1.3.5 | 1.3.x | Runs `agy --print --output-format stream-json --model … --effort …`. Model IDs already embed the reasoning effort (e.g. `gemini-3.8-flash-low`), so `--effort` is only sent for models without a suffix. |
| OpenCode CLI (`opencode`) | 2.0.29 | 2.x | Uses `opencode run --format json`, `opencode models`, `opencode session …`, `opencode debug paths`, `sqlite3` on `opencode.db` for fast session context token lookups, and the local API (`opencode api GET /api/model`, `/api/experimental/session/stats`). |
| Hermes Agent CLI (`hermes`) | 0.22.5 | 0.22.x | Runs `hermes chat -q … --format stream-json`, supports `--resume`, `--provider`, `--reasoning`, `--yolo`, and dynamically queries `hermes_cli.models` & `agent.model_metadata` for any authenticated provider (`openrouter`, `nous`, `anthropic`, `openai-codex`, `copilot`, `opencode-go`, `opencode-zen`, `ollama`, `lmstudio`, `custom`, etc.). |
| Pi CLI (`pi`) | 0.68.0 | 0.60+ | Runs `pi --mode json -p …`, discovers models and exact context limits via `pi --list-models`, and supports `--provider`, `--model`, `--thinking`, and `--session` resumption. |
| sqlite3 | 3.51.2 | any recent | Session management for Antigravity, context token lookups and database cleanup for OpenCode. |
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

> Building produces `main.js` in the repository. `npm test` runs the offline fixture-based test suite (`node --test` + `esbuild`) and end-to-end tests against the built-in Mock CLI Simulator (`test/mock-cli.mjs`) without requiring authenticated CLIs. Copy `main.js`, `manifest.json` and `styles.css` into your vault's `.obsidian/plugins/vault-agents/` folder and reload the plugin in Obsidian to apply the changes.

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
- Switch agents anytime from the top header pill or via `/agent`, and switch models via the model pill or `/model`.
- In the plugin settings, verify the binary paths, provider options, and models for the agents you use.
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
│   ├── hermes/                  # Hermes Agent CLI descriptor, runner & stream parser
│   ├── pi/                      # Pi Coding Agent CLI descriptor, runner & stream parser
│   └── base.ts                  # Shared process execution, JSONL stream loop & CLI utilities
├── features/
│   ├── chat/                    # Chat view, session controls, streaming bubbles, question cards, step widgets & attachments
│   └── settings/                # Data-driven settings tab rendered from provider descriptors
├── shared/                      # Reusable UI modals (agent switcher, grouped model switcher, file suggest, stats)
├── i18n/                        # Internationalization (English, Italian)
└── main.ts                      # Plugin lifecycle and command palette registration
test/
├── fixtures/                    # Recorded .ndjson stream fixtures for all 4 agents
├── mock-cli.mjs                 # Standalone Mock CLI Simulator for end-to-end testing
└── suite.test.ts                # Unit & integration tests for stream parsers, settings migration, and CLI flags
```

- `build/` — build and test tooling (`esbuild.config.mjs`, `run-tests.mjs`, `tsconfig.json`)
- `main.js` / `manifest.json` / `styles.css` — built plugin files (copy into the vault)

## Contributing

Contributions, bug fixes, and new agent CLI integrations are welcome!
All development takes place on the **`dev`** branch using an iterative, test-driven workflow. Before opening a Pull Request, please read [**CONTRIBUTIONS.md**](CONTRIBUTIONS.md) for full details on our branching strategy (`dev` → `main`), code organization, commit conventions, and testing requirements.

## License

GPL-3.0 — see [LICENSE](LICENSE).
