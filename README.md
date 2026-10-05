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

- Obsidian (desktop, Windows/macOS/Linux)
- At least one supported agent CLI on your machine (e.g. **Antigravity CLI** `agy`, **OpenCode CLI** `opencode`, etc.)
- [anydoc](https://github.com/firecrawl/anydoc) (optional, for document conversion): `npm install -g @firecrawl/anydoc`

### Platform requirements

The plugin is cross-platform: the chat, sessions, `/ @ !` commands, stats, and history management work on **Windows, macOS, and Linux**.

On **all** platforms:
- **Node.js** (to build the plugin) and the agent CLIs on your `PATH`.

### Build requirements

```bash
npm install
npm run build
```

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
├── core/                        # Provider contracts, registry, and execution types
├── providers/
│   ├── antigravity/             # Antigravity CLI runner & stream parser
│   ├── opencode/                # OpenCode CLI runner & stream parser
│   └── base.ts                  # Shared process execution and CLI utilities
├── features/
│   ├── chat/                    # Chat view, streaming bubbles, step widgets
│   └── settings/                # Settings tab and engine configuration
├── shared/                      # Reusable UI modals (file suggest, stats)
├── i18n/                        # Internationalization (English, Italian)
└── main.ts                      # Plugin lifecycle and command palette registration
```

- `build/` — build tooling (esbuild config, tsconfig)
- `main.js` / `manifest.json` / `styles.css` — built plugin files (copy into the vault)

## License

GPL-3.0 — see [LICENSE](LICENSE).