import { test } from "node:test";
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SETTINGS,
  getEngineConfig,
  migrateSettings,
  type FinishInfo,
  type HistoryMap,
  type PluginSettings,
  type StepInfo,
  type StreamCallbacks,
} from "../src/core/types";
import type { RunnerHost } from "../src/core/provider";
import { ProviderRegistry } from "../src/core/registry";
import { AntigravityRunner } from "../src/providers/antigravity/runner";
import { OpencodeRunner } from "../src/providers/opencode/runner";
import { translate } from "../src/i18n";

function createMockHost(
  customSettings?: Partial<PluginSettings>,
  histories: HistoryMap = {}
): RunnerHost {
  const { settings } = migrateSettings(customSettings ?? {});
  return {
    settings,
    histories,
    getHistory: (sid: string) => histories[sid] ?? [],
    getEngineConfig: (engineId: string) => getEngineConfig(settings, engineId),
    getVaultPath: () => "/mock/vault",
    t: (text: string) => translate(settings.language, text),
  };
}

function createCollector() {
  const sessions: string[] = [];
  const texts: Array<{ text: string; partId: string }> = [];
  const reasonings: Array<{ text: string; partId: string }> = [];
  const steps: StepInfo[] = [];
  const finishes: FinishInfo[] = [];
  const errors: string[] = [];
  const raws: string[] = [];
  const dones: number[] = [];

  const cb: StreamCallbacks = {
    onSession: (id) => sessions.push(id),
    onText: (text, partId) => texts.push({ text, partId }),
    onReasoning: (text, partId) => reasonings.push({ text, partId }),
    onStep: (step) => steps.push(step),
    onFinish: (info) => finishes.push(info),
    onError: (msg) => errors.push(msg),
    onRaw: (line) => raws.push(line),
    onDone: (code) => dones.push(code),
  };

  return { cb, sessions, texts, reasonings, steps, finishes, errors, raws, dones };
}

test("migrateSettings migrates legacy flat fields into engines map", () => {
  const raw = {
    language: "it",
    engine: "opencode",
    binaryPath: "/custom/opencode",
    model: "anthropic/claude-sonnet-4",
    agent: "architect",
    antigravityBinary: "/custom/agy",
    antigravityModel: "claude-opus-5-5-high",
    antigravityEffort: "max",
    autoApprove: false,
    histories: {
      ses_1: [{ role: "user", text: "Ciao" }],
    },
  };

  const { settings, histories } = migrateSettings(raw);

  assert.equal(settings.language, "it");
  assert.equal(settings.engine, "opencode");
  assert.equal(settings.autoApprove, false);
  assert.equal(settings.engines.opencode.binary, "/custom/opencode");
  assert.equal(settings.engines.opencode.model, "anthropic/claude-sonnet-4");
  assert.equal(settings.engines.opencode.options.agent, "architect");
  assert.equal(settings.engines.antigravity.binary, "/custom/agy");
  assert.equal(settings.engines.antigravity.model, "claude-opus-5-5-high");
  assert.equal(settings.engines.antigravity.options.effort, "max");
  assert.equal(histories.ses_1.length, 1);
});

test("ProviderRegistry resolves session-specific provider and falls back cleanly", () => {
  const host = createMockHost();
  const agy = new AntigravityRunner(host);
  const oc = new OpencodeRunner(host);
  const reg = new ProviderRegistry();
  reg.register(oc);
  reg.register(agy);

  assert.equal(reg.getDescriptors().length, 2);
  assert.equal(reg.resolveProvider("antigravity").id, "antigravity");
  assert.equal(
    reg.resolveProvider("antigravity", "ses_123", { ses_123: "opencode" }).id,
    "opencode"
  );
  assert.equal(reg.resolveProvider("unknown-engine").id, "opencode");
});

test("AntigravityRunner parses sample-stream.ndjson fixture accurately", () => {
  const host = createMockHost();
  const runner = new AntigravityRunner(host);
  const col = createCollector();
  const streamState = { accumulatedText: "" };

  const fixturePath = join(process.cwd(), "test/fixtures/antigravity/sample-stream.ndjson");
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);

  for (const line of lines) {
    runner.handleLine(line, col.cb, streamState);
  }

  assert.equal(col.sessions[0], "0da89d6e-47ea-4d39-aa41-2bd0aa103371");
  assert.equal(col.reasonings.length, 1);
  assert.equal(col.reasonings[0].text, "Analizzo la struttura del vault...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[0].title, "Read Nota.md");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.steps[1].output, "Contenuto della nota");

  // Incremental delta + final synchronized response
  assert.equal(col.texts.length, 3);
  assert.equal(col.texts[0].text, "Ecco il riassunto ");
  assert.equal(col.texts[1].text, "Ecco il riassunto della nota.");
  assert.equal(col.texts[2].text, "Ecco il riassunto completo della nota.");

  assert.equal(col.finishes.length, 1);
  assert.deepEqual(col.finishes[0].tokens, {
    total: 1500,
    input: 1200,
    output: 200,
    reasoning: 100,
  });
  assert.equal(col.finishes[0].cost, 0);
});

test("OpencodeRunner parses sample-stream.ndjson fixture accurately", () => {
  const host = createMockHost();
  const runner = new OpencodeRunner(host);
  const col = createCollector();

  const fixturePath = join(process.cwd(), "test/fixtures/opencode/sample-stream.ndjson");
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);

  for (const line of lines) {
    runner.handleLine(line, col.cb);
  }

  assert.equal(col.sessions[0], "ses_abc12345");
  assert.equal(col.reasonings.length, 1);
  assert.equal(col.reasonings[0].text, "Pianifico i passaggi...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.texts.length, 1);
  assert.equal(col.texts[0].text, "Operazione completata con successo.");
  assert.equal(col.finishes.length, 1);
  assert.equal(col.finishes[0].tokens?.total, 850);
  assert.equal(col.finishes[0].cost, 0.0025);
});

test("AntigravityRunner and OpencodeRunner handle non-JSON, errors, and oversized lines safely", () => {
  const host = createMockHost();
  const agy = new AntigravityRunner(host);
  const oc = new OpencodeRunner(host);
  const col = createCollector();

  agy.handleLine("plain stderr/stdout warning", col.cb);
  assert.equal(col.raws.length, 1);
  assert.match(col.raws[0], /plain stderr\/stdout warning/);

  agy.handleLine(JSON.stringify({ event: "error", error: { message: "Quota exceeded" } }), col.cb);
  assert.equal(col.errors.at(-1), "Quota exceeded");

  oc.handleLine(JSON.stringify({ type: "error", error: { data: { message: "Invalid model" } } }), col.cb);
  assert.equal(col.errors.at(-1), "Invalid model");

  const huge = "x".repeat(20_000_005);
  oc.handleLine(huge, col.cb);
  assert.match(col.raws.at(-1) ?? "", /\[omitted event of 20000005 bytes\]/);
});

test("AntigravityRunner respects autoApprove toggle, effort suffix, and explicit sessionId", () => {
  const hostSafe = createMockHost({
    autoApprove: false,
    sessionId: "global-uuid-1111",
    antigravityModel: "gemini-3.8-flash-high",
    antigravityEffort: "high",
  });
  const agySafe = new AntigravityRunner(hostSafe);

  const argsNoApprove = agySafe.buildArgs({
    prompt: "Hello",
    fileAttachments: [],
    sessionId: "", // Empty per-view session should NOT inherit global sessionId
  });
  assert.equal(argsNoApprove.includes("--dangerously-skip-permissions"), false);
  assert.equal(argsNoApprove.includes("--conversation"), false);
  assert.equal(argsNoApprove.includes("--effort"), false); // model already ends with -high

  const hostAuto = createMockHost({
    autoApprove: true,
    antigravityModel: "custom-model-without-suffix",
    antigravityEffort: "xhigh",
  });
  const agyAuto = new AntigravityRunner(hostAuto);
  const argsAuto = agyAuto.buildArgs({
    prompt: "Hello",
    fileAttachments: [],
    sessionId: "view-uuid-2222",
  });
  assert.equal(argsAuto.includes("--dangerously-skip-permissions"), true);
  const convIdx = argsAuto.indexOf("--conversation");
  assert.ok(convIdx >= 0);
  assert.equal(argsAuto[convIdx + 1], "view-uuid-2222");
  const effortIdx = argsAuto.indexOf("--effort");
  assert.ok(effortIdx >= 0);
  assert.equal(argsAuto[effortIdx + 1], "xhigh");
});

test("AntigravityRunner.getUsageStats filters untagged sessions and time windows", async () => {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 3600 * 1000;
  const threeDaysAgo = now - 3 * 24 * 3600 * 1000;
  const twentyDaysAgo = now - 20 * 24 * 3600 * 1000;

  const histories: HistoryMap = {
    "uuid-agy-1": [
      { role: "assistant", text: "a", tokens: { input: 100, output: 50 }, timestamp: twoHoursAgo },
      { role: "assistant", text: "b", tokens: { input: 200, output: 100 }, timestamp: threeDaysAgo },
      { role: "assistant", text: "c", tokens: { input: 400, output: 200 }, timestamp: twentyDaysAgo },
    ],
    ses_opencode_untagged: [
      { role: "assistant", text: "oc", tokens: { input: 9999, output: 9999 }, timestamp: twoHoursAgo },
    ],
  };

  const host = createMockHost({ sessionEngines: {} }, histories);
  const agy = new AntigravityRunner(host);
  const stats = await agy.getUsageStats();

  assert.equal(stats.h5.input, 100);
  assert.equal(stats.week.input, 300);
  assert.equal(stats.month.input, 700);
});
