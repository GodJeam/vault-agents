# Contributing to Vault Agents

## Branches

- **`main`**: Stable releases only. Do not push or open Pull Requests directly against `main`.
- **`dev`**: Active development branch. Branch from `dev` and open Pull Requests against `dev`.

```bash
git switch dev
git pull origin dev
git switch -c feat/my-change   # or fix/*, refactor/*, docs/*
```

## Setup & Commands

```bash
npm install
npm test        # Run offline unit & mock CLI tests
npm run build   # Type-check and compile main.js
npm run dev     # Watch build during development
```

`main.js` is gitignored and compiled automatically on release by GitHub Actions; never commit it.

To test inside Obsidian, copy `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/vault-agents/`. To test the UI offline without real CLI tools installed, set an agent's **Binary path** in Settings to [`test/mock-cli.mjs`](test/mock-cli.mjs).

## Conventions

- Follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
- Add new CLI providers under `src/providers/<id>/` extending `BaseCliRunner` (`src/providers/base.ts`).
- Add new user-facing strings to `IT_TRANSLATIONS` in [`src/i18n/index.ts`](src/i18n/index.ts) (EN/IT key and placeholder parity is verified automatically by `npm test`).
- Add regression tests or NDJSON fixtures under `test/` for bug fixes and new provider behavior.
