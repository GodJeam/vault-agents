import { test } from "node:test";
import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_SETTINGS,
  getEngineConfig,
  migrateSettings,
  type AgentQuestion,
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
import { formatToolAction } from "../src/features/chat/stepWidget";
import { formatQuestionAnswers } from "../src/features/chat/questionCard";
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
  const questions: AgentQuestion[][] = [];
  const activities: string[] = [];
  const finishes: FinishInfo[] = [];
  const errors: string[] = [];
  const raws: string[] = [];
  const dones: number[] = [];

  const cb: StreamCallbacks = {
    onSession: (id) => sessions.push(id),
    onText: (text, partId) => texts.push({ text, partId }),
    onReasoning: (text, partId) => reasonings.push({ text, partId }),
    onStep: (step) => steps.push(step),
    onQuestion: (qs) => questions.push(qs),
    onActivity: (act) => activities.push(act),
    onFinish: (info) => finishes.push(info),
    onError: (msg) => errors.push(msg),
    onRaw: (line) => raws.push(line),
    onDone: (code) => dones.push(code),
  };

  return {
    cb,
    sessions,
    texts,
    reasonings,
    steps,
    questions,
    activities,
    finishes,
    errors,
    raws,
    dones,
  };
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

test("OpencodeRunner.buildArgs resolves relative fileAttachments against vault path", () => {
  const host = createMockHost();
  const oc = new OpencodeRunner(host);
  const args = oc.buildArgs({
    prompt: "Riassumi",
    fileAttachments: ["PDF APA/Lezione 1.pdf", "/tmp/already-abs.md"],
  });
  const firstFileIdx = args.indexOf("--file");
  assert.ok(firstFileIdx >= 0);
  assert.equal(args[firstFileIdx + 1], "/mock/vault/PDF APA/Lezione 1.pdf");
  const secondFileIdx = args.indexOf("--file", firstFileIdx + 1);
  assert.ok(secondFileIdx >= 0);
  assert.equal(args[secondFileIdx + 1], "/tmp/already-abs.md");
});

test("OpencodeRunner intercepts failed question tool_use and extracts human-friendly tool titles", () => {
  const host = createMockHost({ language: "it" });
  const oc = new OpencodeRunner(host);
  const col = createCollector();

  // 1. step_start emits live activity
  oc.handleLine(
    JSON.stringify({
      type: "step_start",
      sessionID: "ses_q123",
      part: { type: "step-start", id: "prt_1" },
    }),
    col.cb
  );
  assert.equal(col.activities.at(-1), "Analisi e pianificazione in corso...");

  // 2. read tool_use with raw title "read" extracts basename from input.filePath
  oc.handleLine(
    JSON.stringify({
      type: "tool_use",
      sessionID: "ses_q123",
      part: {
        id: "prt_read",
        callID: "call_read",
        type: "tool",
        tool: "read",
        state: {
          status: "completed",
          title: "read",
          input: { filePath: "/mock/vault/Appunti/Architettura.md" },
          time: { start: 1000, end: 1250 },
        },
      },
    }),
    col.cb
  );
  assert.equal(col.steps.length, 1);
  assert.equal(col.steps[0].title, "Architettura.md");
  assert.equal(col.steps[0].durationMs, 250);

  // 3. question tool_use (cancelled by opencode run CLI with status "error") is intercepted cleanly
  oc.handleLine(
    JSON.stringify({
      type: "tool_use",
      sessionID: "ses_q123",
      part: {
        id: "prt_q",
        callID: "call_q",
        type: "tool",
        tool: "question",
        state: {
          status: "error",
          input: {
            questions: [
              {
                header: "Formato",
                question: "Come preferisci il riassunto?",
                options: [
                  { label: "Elenco puntato", description: "Sintetico e rapido" },
                  { label: " Discorsivo ", description: "Approfondito" },
                ],
                multiple: false,
              },
            ],
          },
          error: "The question couldn't be shown to the user in this client.",
        },
      },
    }),
    col.cb
  );

  assert.equal(col.questions.length, 1);
  assert.equal(col.questions[0].length, 1);
  assert.equal(col.questions[0][0].header, "Formato");
  assert.equal(col.questions[0][0].question, "Come preferisci il riassunto?");
  assert.equal(col.questions[0][0].options.length, 2);
  assert.equal(col.questions[0][0].options[0].label, "Elenco puntato");
  assert.equal(col.steps.at(-1)?.state, "completed"); // error suppressed!
  assert.equal(col.activities.at(-1), "In attesa della tua risposta...");
});

test("AntigravityRunner intercepts ask_question tool and deduplicates across step updates", () => {
  const host = createMockHost({ language: "it" });
  const agy = new AntigravityRunner(host);
  const col = createCollector();
  const streamState = { accumulatedText: "" };

  const askEvent = (state: string) =>
    JSON.stringify({
      event: "step_update",
      step_update: {
        conversation_id: "uuid-ask-1",
        step_index: 5,
        step_type: "tool",
        state,
        tool_name: "ask_question",
        tool_info: {
          name: "ask_question",
          parameters: {
            questions: [
              {
                question: "Quali sezioni vuoi includere?",
                options: ["Introduzione", "Esempi pratici"],
                is_multi_select: true,
              },
            ],
          },
        },
      },
    });

  agy.handleLine(askEvent("RUNNING"), col.cb, streamState);
  agy.handleLine(askEvent("DONE"), col.cb, streamState);

  assert.equal(col.questions.length, 1); // deduplicated!
  assert.equal(col.questions[0][0].question, "Quali sezioni vuoi includere?");
  assert.equal(col.questions[0][0].multiple, true);
  assert.deepEqual(
    col.questions[0][0].options.map((o) => o.label),
    ["Introduzione", "Esempi pratici"]
  );
  assert.equal(col.steps.at(-1)?.state, "completed");
});

test("formatToolAction and formatQuestionAnswers produce human-readable localized output", () => {
  const tIt = (s: string) => translate("it", s);

  const readFmt = formatToolAction("read", "Nota.md", tIt);
  assert.equal(readFmt.label, "Lettura file");
  assert.equal(readFmt.target, "Nota.md");
  assert.equal(readFmt.icon, "file-text");

  const dupFmt = formatToolAction("bash", "bash", tIt);
  assert.equal(dupFmt.label, "Esecuzione comando");
  assert.equal(dupFmt.target, "");

  const questions: AgentQuestion[] = [
    {
      header: "Stile",
      question: "Quale tono usare?",
      options: [{ label: "Formale" }, { label: "Informale" }],
    },
    {
      header: "Lingua",
      question: "In che lingua?",
      options: [{ label: "Italiano" }, { label: "Inglese" }],
    },
  ];
  const selected = new Map<number, Set<string>>([
    [0, new Set(["Formale"])],
    [1, new Set(["Italiano"])],
  ]);
  const custom = new Map<number, string>([[0, "con riferimenti accademici"]]);
  const formatted = formatQuestionAnswers(questions, selected, custom, tIt);
  assert.match(formatted, /Ecco le mie risposte alle tue domande:/);
  assert.match(formatted, /\*\*Stile — Quale tono usare\?\*\*: Formale, con riferimenti accademici/);
  assert.match(formatted, /\*\*Lingua — In che lingua\?\*\*: Italiano/);
});

