#!/usr/bin/env node
/**
 * Mock CLI Simulator for Vault Agents.
 *
 * Allows testing any registered AI agent provider live inside Obsidian (or from
 * automated tests) without installing or authenticating the real CLI binary.
 *
 * Usage in Obsidian Settings -> Binary path:
 *   /absolute/path/to/vault-agents/test/mock-cli.mjs
 *
 * Or create symlinks named `claude`, `codex`, `hermes`, `pi`, `agy`, `opencode`
 * pointing to this script, or pass `MOCK_ENGINE=claude` in the environment.
 */
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const invokedName = basename(process.argv[1] || "").replace(/\.(mjs|cjs|js)$/i, "");

function detectEngine() {
  if (process.env.MOCK_ENGINE) {
    return process.env.MOCK_ENGINE.toLowerCase();
  }
  const known = ["antigravity", "agy", "opencode", "claude", "codex", "hermes", "pi"];
  for (const k of known) {
    if (invokedName.toLowerCase().includes(k)) {
      return k === "agy" ? "antigravity" : k;
    }
  }
  // Heuristics based on CLI flags passed by each runner:
  if (args[0] === "exec" && args.includes("--json")) return "codex";
  if (args[0] === "chat" && args.includes("-q")) return "hermes";
  if (args.includes("--mode") && args.includes("json")) return "pi";
  if (args[0] === "run" && args.includes("--format")) return "opencode";
  if (args.includes("--verbose") && args.includes("stream-json")) return "claude";
  if (args.includes("stream-json")) return "antigravity";
  return "claude";
}

const engine = detectEngine();

// 1. Handle `--version`
if (args.includes("--version") || args.includes("-v")) {
  console.log(`${engine}-mock 1.0.0 (Vault Agents Mock CLI Simulator)`);
  process.exit(0);
}

// 2. Handle `models` subcommand or `--list-models` flag
if (args[0] === "models" || args.includes("--list-models")) {
  const modelsByEngine = {
    antigravity: ["gemini-3.8-flash-high", "claude-sonnet-5-5-high"],
    opencode: ["opencode-go/deepseek-v4.1-flash", "anthropic/claude-sonnet-4"],
    claude: ["sonnet", "opus", "haiku"],
    codex: ["o3", "o4-mini"],
    hermes: ["nous/hermes-4-405b", "anthropic/claude-sonnet-4"],
    pi: ["claude-sonnet-4-5", "gpt-5"],
  };
  for (const m of modelsByEngine[engine] || modelsByEngine.claude) {
    console.log(m);
  }
  process.exit(0);
}

// 3. Stream NDJSON fixture lines with a realistic delay
const fixturePath =
  process.env.MOCK_FIXTURE ||
  join(__dirname, "fixtures", engine, "sample-stream.ndjson");

if (!existsSync(fixturePath)) {
  console.error(`Mock fixture not found for engine '${engine}': ${fixturePath}`);
  process.exit(1);
}

const lines = readFileSync(fixturePath, "utf-8")
  .split(/\r?\n/)
  .filter((l) => l.trim().length > 0);

const delayMs = Number(process.env.MOCK_DELAY_MS ?? 80);

async function replay() {
  for (const line of lines) {
    process.stdout.write(line + "\n");
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

replay().catch((err) => {
  console.error(err);
  process.exit(1);
});
