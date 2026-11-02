# Contributing to Vault Agents

Thank you for contributing to **Vault Agents**! Please follow the branching strategy and workflow below when submitting changes.

## 1. Branching Strategy (`dev` → `main`)

- **`main`**: Stable release branch. Direct commits or external PRs to `main` are not accepted.
- **`dev`**: Active development branch. **All contributor Pull Requests must target `dev`.**

```bash
git switch dev
git pull origin dev
git switch -c feat/my-change   # or fix/*, refactor/*, docs/*
```

> **Note**: `main.js` is ignored in Git (`.gitignore`) and compiled automatically by GitHub Actions on release. Do not commit `main.js`.

## 2. Development Workflow

1. **Separate Commits by Concern**: Keep UI/icon polish (`feat(ui)`), structural refactoring (`refactor(...)`), and feature/provider logic (`feat(...)` / `fix(...)`) in separate atomic commits.
2. **Universal Provider Design**: Providers in `src/providers/<id>/` extend `BaseCliRunner` (`src/providers/base.ts`). Query each CLI's native runtime/API dynamically for models and context window limits rather than hardcoding user-specific values.
3. **Localization (`i18n`)**: Add any new user-facing string to both English and Italian dictionaries in [`src/i18n/index.ts`](src/i18n/index.ts).
4. **Build & Test**:
   ```bash
   npm test
   npm run build
   ```
   - Add or update `.ndjson` fixtures in `test/fixtures/`, [`test/mock-cli.mjs`](test/mock-cli.mjs), and [`test/suite.test.ts`](test/suite.test.ts).
   - Test live in an Obsidian vault by copying `main.js`, `manifest.json`, and `styles.css` to `<vault>/.obsidian/plugins/vault-agents/`.

## 3. Conventional Commits & PR Checklist

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `refactor`, `build`, `test`, `docs`, `chore`) and verify before opening a PR into **`dev`**:

- [ ] Target branch is `dev` (and `main.js` is not staged)
- [ ] `npm test` and `npm run build` pass with zero errors
- [ ] Translations in `src/i18n/index.ts` are updated (`en` & `it`)
- [ ] Verified live inside an Obsidian vault
