# Contributing to Vault Agents

Thank you for your interest in contributing to **Vault Agents**! This document outlines the branching model, development workflow, architectural rules, and Pull Request requirements used to develop and maintain the project.

---

## 1. Branching Strategy (`dev` → `main`)

Vault Agents follows a two-track branching workflow:

- **`main` (Stable / Release Branch)**
  - Contains production-ready releases (`main.js`, `manifest.json`, `package.json`, `versions.json`).
  - Direct commits or external Pull Requests targeting `main` are **not** accepted (except for documentation hotfixes or official `dev` → `main` release merges).
- **`dev` (Integration & Development Branch)**
  - All active development happens here.
  - **All contributor Pull Requests must target the `dev` branch.**

### Working on a Contribution

1. Fork the repository and clone it locally.
2. Checkout the `dev` branch and make sure it is up to date:
   ```bash
   git checkout dev
   git pull origin dev
   ```
3. Create a dedicated topic branch from `dev`:
   - `feat/<short-name>` — for new features or new CLI agent providers
   - `fix/<short-name>` — for bug fixes
   - `refactor/<short-name>` — for structural code cleanup without behavior changes
   - `docs/<short-name>` — for documentation updates
4. When ready, open a Pull Request from your branch into **`dev`**.

---

## 2. Development Methodology

To keep the codebase modular, maintainable, and consistent across all supported agents, contributions should follow the iterative workflow used throughout the project:

### Step 1 — Separate UI, Refactoring, and Feature Logic
Do not mix unrelated changes into a single monolithic commit. When implementing a large improvement:
1. **UI / UX & Icon Polish**: Keep visual changes coherent with Obsidian's native GUI (use Obsidian CSS variables like `--background-primary`, `--interactive-accent`, and native Lucide icons via `setIcon`).
2. **Refactoring**: If existing files grow too large, split responsibilities into focused modules under `src/shared/` or `src/features/` in a dedicated `refactor(...)` commit before adding new functionality.
3. **Feature / Provider Implementation**: Implement the new feature or CLI runner in its own `feat(...)` commit(s).

### Step 2 — Universal & Dynamic Provider Design
Every AI CLI integration lives in `src/providers/<engine-id>/` (`runner.ts` and `types.ts`) and extends `BaseCliRunner` (`src/providers/base.ts`):
- **No user-specific hardcoding**: Model discovery (`listModels`) and context window resolution (`getModelContextLimit`) must dynamically query the CLI's native runtime, local API, or catalog so that every user gets their own authenticated providers and accurate context limits automatically.
- **Safe session resumption**: Ensure `--resume` / `--session` flags respect each CLI's rules (e.g., stripping creation-only flags when resuming an existing session).
- **Human-readable tool steps**: Map raw CLI tool names and payloads into clean `StepInfo` actions (`read`, `write`, `bash`, `search`, `todo`, `question`, etc.) via `formatToolAction`.

### Step 3 — Bilingual Internationalization (`i18n`)
- All UI labels, tooltips, settings descriptions, and status messages must be defined in [`src/i18n/index.ts`](src/i18n/index.ts) for both **English (`en`)** and **Italian (`it`)**.

### Step 4 — Offline Fixture Tests & Mock CLI Simulator
Every new feature or provider must be covered by automated tests before opening a Pull Request:
1. **Stream Fixtures**: Add recorded JSONL/NDJSON output samples in `test/fixtures/<provider>/sample-stream.ndjson`.
2. **Mock CLI Simulator**: Update [`test/mock-cli.mjs`](test/mock-cli.mjs) if introducing a new CLI engine so end-to-end process spawning can be tested offline without requiring API keys.
3. **Unit & E2E Test Suite**: Add test cases in [`test/suite.test.ts`](test/suite.test.ts) covering stream parsing, CLI argument building (`buildArgs`), and error handling.

### Step 5 — Build & Live Obsidian Verification
Run the full test and build pipeline locally:

```bash
npm test
npm run build
```

- `npm test` must pass 100% of unit and mock-CLI end-to-end suites.
- `npm run build` runs `tsc --noEmit` (strict TypeScript check) and bundles `main.js` via `esbuild`.
- Copy `main.js`, `manifest.json`, and `styles.css` into a test Obsidian vault (`<vault>/.obsidian/plugins/vault-agents/`) and verify the changes live in Obsidian.

---

## 3. Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/) for clear history and release notes:

- `feat(providers): add <agent> runner and stream parser`
- `feat(ui): improve model switcher grouping and filter chips`
- `fix(hermes): resolve context window limit from native metadata`
- `refactor(chat): extract session controls into dedicated module`
- `docs: update README and contribution guidelines`
- `chore(release): bump version to x.y.z`

---

## 4. Pull Request Checklist

When opening a Pull Request targeting **`dev`**, document your changes clearly using the following structure:

- **Summary**: High-level explanation of what the PR solves or introduces.
- **Key Changes**: Grouped breakdown of provider changes, UI updates, or refactorings.
- **Commits Included**: List of atomic commits in the PR.
- **Verification**:
  - [ ] Target branch is `dev`
  - [ ] `npm test` passes all offline fixture and Mock CLI Simulator tests
  - [ ] `npm run build` completes with zero TypeScript or bundler errors
  - [ ] English and Italian translations (`src/i18n/index.ts`) are updated
  - [ ] Tested live inside an Obsidian vault
