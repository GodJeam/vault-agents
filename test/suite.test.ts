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
import { isPermissionError } from "../src/core/permissionError";
import { redact } from "../src/core/redact";
import { buildAnydocArgs } from "../src/providers/base";
import { AntigravityRunner } from "../src/providers/antigravity/runner";
import { OpencodeRunner } from "../src/providers/opencode/runner";
import { HermesRunner } from "../src/providers/hermes/runner";
import { PiRunner } from "../src/providers/pi/runner";
import { formatToolAction } from "../src/features/chat/stepWidget";
import { formatQuestionAnswers } from "../src/features/chat/questionCard";
import { translate } from "../src/i18n";

function createMockHost(
  customSettings?: Partial<PluginSettings> & Record<string, unknown>,
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
      ses_1: [{ role: "user", text: "Hello" }],
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

test("DEFAULT_SETTINGS ships secure defaults", () => {
  assert.equal(DEFAULT_SETTINGS.autoApprove, false);
  assert.equal(DEFAULT_SETTINGS.anydocEnabled, false);
  assert.equal(DEFAULT_SETTINGS.anydocHostedOcr, false);
  assert.equal(DEFAULT_SETTINGS.dbAutoCleanup, false);

  // A missing setting must fall back to the secure default...
  assert.equal(migrateSettings({}).settings.autoApprove, false);
  // ...while an explicit user choice is preserved.
  assert.equal(migrateSettings({ autoApprove: true }).settings.autoApprove, true);
});

test("isPermissionError detects actionable permission failures only", () => {
  assert.equal(isPermissionError("permission denied"), true);
  assert.equal(isPermissionError("Permission required to run this tool"), true);
  assert.equal(isPermissionError("This tool requires approval"), true);
  assert.equal(isPermissionError("auto-approve is disabled"), true);
  assert.equal(isPermissionError("access denied"), true);
  assert.equal(isPermissionError("command blocked by policy"), true);
  assert.equal(isPermissionError("denied by user"), true);
  assert.equal(isPermissionError("network timeout"), false);
  assert.equal(isPermissionError("model not found"), false);
  assert.equal(isPermissionError(""), false);
});

test("redact masks known credentials without touching normal text", () => {
  assert.equal(
    redact("request failed with sk-1234567890abcdef"),
    "request failed with sk-[REDACTED]"
  );
  assert.equal(
    redact("Authorization: Bearer abcdefgh12345"),
    "Authorization: Bearer [REDACTED]"
  );
  assert.equal(redact("api_key=supersecret123"), "api_key=[REDACTED]");
  assert.equal(redact("password: hunter2!"), "password: [REDACTED]");
  assert.equal(
    redact("ghp_abcdefghijklmnopqrstuvwxyz0123456789"),
    "gh*_[REDACTED]"
  );
  assert.equal(
    redact("https://user:pass123@example.com/x"),
    "https://user:[REDACTED]@example.com/x"
  );
  // Normal prose must survive untouched.
  assert.equal(redact("token usage: 500"), "token usage: 500");
  assert.equal(redact("network timeout"), "network timeout");
  assert.equal(
    redact(new Error("failed with sk-1234567890abcdef")).includes(
      "sk-[REDACTED]"
    ),
    true
  );
});

test("Runners only pass auto-approve flags when explicitly enabled", () => {
  const safeHost = createMockHost({ autoApprove: false });
  const safeOc = new OpencodeRunner(safeHost).buildArgs({
    prompt: "Hello",
    fileAttachments: [],
  });
  assert.equal(safeOc.includes("--auto"), false);

  const safeAgy = new AntigravityRunner(safeHost).buildArgs({
    prompt: "Hello",
    fileAttachments: [],
  });
  assert.equal(safeAgy.includes("--dangerously-skip-permissions"), false);

  const safeHermes = new HermesRunner(safeHost).buildArgs({
    prompt: "Hello",
    fileAttachments: [],
    sessionId: "",
  });
  assert.equal(safeHermes.includes("--yolo"), false);

  const autoHost = createMockHost({ autoApprove: true });
  assert.equal(
    new OpencodeRunner(autoHost)
      .buildArgs({ prompt: "Hello", fileAttachments: [] })
      .includes("--auto"),
    true
  );
  assert.equal(
    new AntigravityRunner(autoHost)
      .buildArgs({ prompt: "Hello", fileAttachments: [] })
      .includes("--dangerously-skip-permissions"),
    true
  );
  assert.equal(
    new HermesRunner(autoHost)
      .buildArgs({ prompt: "Hello", fileAttachments: [], sessionId: "" })
      .includes("--yolo"),
    true
  );
});

test("buildAnydocArgs only requests hosted OCR when enabled", () => {
  assert.deepEqual(
    buildAnydocArgs("/tmp/in.pdf", "/tmp/out.md", false),
    ["/tmp/in.pdf", "-o", "/tmp/out.md"]
  );
  assert.deepEqual(
    buildAnydocArgs("/tmp/in.pdf", "/tmp/out.md", true),
    ["/tmp/in.pdf", "--ocr", "hosted", "-o", "/tmp/out.md"]
  );
});

test("CLI spawning never enables a shell and DB cleanup is not automatic", () => {
  const baseSrc = readFileSync(
    join(process.cwd(), "src/providers/base.ts"),
    "utf-8"
  );
  assert.equal(/\bshell:\s*true\b/.test(baseSrc), false);
  assert.equal(/\buseShell\b/.test(baseSrc), false);

  const mainSrc = readFileSync(join(process.cwd(), "src/main.ts"), "utf-8");
  assert.equal(/pruneOversizedParts\?\.\(\)/.test(mainSrc), false);
});

test("ProviderRegistry resolves session-specific provider cleanly", () => {
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

  const fixturePath = join(
    process.cwd(),
    "test/fixtures/antigravity/sample-stream.ndjson"
  );
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);

  for (const line of lines) {
    runner.handleLine(line, col.cb, streamState);
  }

  assert.equal(col.sessions[0], "0da89d6e-47ea-4d39-aa41-2bd0aa103371");
  assert.equal(col.reasonings.length, 1);
  assert.equal(col.reasonings[0].text, "Analyzing vault structure...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[0].title, "Read Note.md");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.steps[1].output, "Note content");

  // Incremental delta + final synchronized response
  assert.equal(col.texts.length, 3);
  assert.equal(col.texts[0].text, "Here is the summary ");
  assert.equal(col.texts[1].text, "Here is the summary of the note.");
  assert.equal(col.texts[2].text, "Here is the complete summary of the note.");

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

  const fixturePath = join(
    process.cwd(),
    "test/fixtures/opencode/sample-stream.ndjson"
  );
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);

  for (const line of lines) {
    runner.handleLine(line, col.cb);
  }

  assert.equal(col.sessions[0], "ses_abc12345");
  assert.equal(col.reasonings.length, 1);
  assert.equal(col.reasonings[0].text, "Planning the steps...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.texts.length, 1);
  assert.equal(col.texts[0].text, "Operation completed successfully.");
  assert.equal(col.finishes.length, 1);
  assert.equal(col.finishes[0].tokens?.total, 850);
  assert.equal(col.finishes[0].cost, 0.0025);
});

test("Runners handle non-JSON, errors, and oversized lines safely", () => {
  const host = createMockHost();
  const agy = new AntigravityRunner(host);
  const oc = new OpencodeRunner(host);
  const col = createCollector();

  agy.handleLine("plain stderr/stdout warning", col.cb);
  assert.equal(col.raws.length, 1);
  assert.match(col.raws[0], /plain stderr\/stdout warning/);

  const agyErr = JSON.stringify({
    event: "error",
    error: { message: "Quota exceeded" },
  });
  agy.handleLine(agyErr, col.cb);
  assert.equal(col.errors.at(-1), "Quota exceeded");

  const ocErr = JSON.stringify({
    type: "error",
    error: { data: { message: "Invalid model" } },
  });
  oc.handleLine(ocErr, col.cb);
  assert.equal(col.errors.at(-1), "Invalid model");

  const huge = "x".repeat(20_000_005);
  oc.handleLine(huge, col.cb);
  assert.match(col.raws.at(-1) ?? "", /\[omitted event of 20000005 bytes\]/);
});

test("AntigravityRunner respects autoApprove, effort, and sessionId", () => {
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
    // Empty per-view session should NOT inherit global sessionId
    sessionId: "",
  });
  assert.equal(argsNoApprove.includes("--dangerously-skip-permissions"), false);
  assert.equal(argsNoApprove.includes("--conversation"), false);
  // Model already ends with -high
  assert.equal(argsNoApprove.includes("--effort"), false);

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

test("AntigravityRunner.getUsageStats filters time windows", async () => {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 3600 * 1000;
  const threeDaysAgo = now - 3 * 24 * 3600 * 1000;
  const twentyDaysAgo = now - 20 * 24 * 3600 * 1000;

  const histories: HistoryMap = {
    "uuid-agy-1": [
      {
        role: "assistant",
        text: "a",
        tokens: { input: 100, output: 50 },
        timestamp: twoHoursAgo,
      },
      {
        role: "assistant",
        text: "b",
        tokens: { input: 200, output: 100 },
        timestamp: threeDaysAgo,
      },
      {
        role: "assistant",
        text: "c",
        tokens: { input: 400, output: 200 },
        timestamp: twentyDaysAgo,
      },
    ],
    ses_opencode_untagged: [
      {
        role: "assistant",
        text: "oc",
        tokens: { input: 9999, output: 9999 },
        timestamp: twoHoursAgo,
      },
    ],
  };

  const host = createMockHost({ sessionEngines: {} }, histories);
  const agy = new AntigravityRunner(host);
  const stats = await agy.getUsageStats();

  assert.equal(stats.h5.input, 100);
  assert.equal(stats.week.input, 300);
  assert.equal(stats.month.input, 700);
});

test("OpencodeRunner.buildArgs resolves relative fileAttachments", () => {
  const host = createMockHost();
  const oc = new OpencodeRunner(host);
  const args = oc.buildArgs({
    prompt: "Summarize",
    fileAttachments: ["Docs/Lecture 1.pdf", "/tmp/already-abs.md"],
  });
  const firstFileIdx = args.indexOf("--file");
  assert.ok(firstFileIdx >= 0);
  assert.equal(args[firstFileIdx + 1], "/mock/vault/Docs/Lecture 1.pdf");
  const secondFileIdx = args.indexOf("--file", firstFileIdx + 1);
  assert.ok(secondFileIdx >= 0);
  assert.equal(args[secondFileIdx + 1], "/tmp/already-abs.md");
});

test("OpencodeRunner intercepts question tool and extracts tool titles", () => {
  const host = createMockHost({ language: "en" });
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
  assert.equal(col.activities.at(-1), "Analyzing and planning...");

  // 2. read tool_use with raw title "read" extracts basename from filePath
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
          input: { filePath: "/mock/vault/Notes/Architecture.md" },
          time: { start: 1000, end: 1250 },
        },
      },
    }),
    col.cb
  );
  assert.equal(col.steps.length, 1);
  assert.equal(col.steps[0].title, "Architecture.md");
  assert.equal(col.steps[0].durationMs, 250);

  // 3. question tool_use (cancelled by opencode run CLI) is intercepted cleanly
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
                header: "Format",
                question: "How would you like the summary formatted?",
                options: [
                  { label: "Bullet points", description: "Concise and quick" },
                  { label: " Narrative ", description: "Detailed explanation" },
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
  assert.equal(col.questions[0][0].header, "Format");
  assert.equal(
    col.questions[0][0].question,
    "How would you like the summary formatted?"
  );
  assert.equal(col.questions[0][0].options.length, 2);
  assert.equal(col.questions[0][0].options[0].label, "Bullet points");
  assert.equal(col.steps.at(-1)?.state, "completed"); // error suppressed!
  assert.equal(col.activities.at(-1), "Waiting for your answer...");
});

test("AntigravityRunner intercepts ask_question and deduplicates", () => {
  const host = createMockHost({ language: "en" });
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
                question: "Which sections should be included?",
                options: ["Introduction", "Practical examples"],
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
  assert.equal(
    col.questions[0][0].question,
    "Which sections should be included?"
  );
  assert.equal(col.questions[0][0].multiple, true);
  assert.deepEqual(
    col.questions[0][0].options.map((o) => o.label),
    ["Introduction", "Practical examples"]
  );
  assert.equal(col.steps.at(-1)?.state, "completed");
});

test("formatToolAction and formatQuestionAnswers format output", () => {
  const tEn = (s: string) => translate("en", s);

  const readFmt = formatToolAction("read", "Note.md", tEn);
  assert.equal(readFmt.label, "Read file");
  assert.equal(readFmt.target, "Note.md");
  assert.equal(readFmt.icon, "file-text");

  const dupFmt = formatToolAction("bash", "bash", tEn);
  assert.equal(dupFmt.label, "Run command");
  assert.equal(dupFmt.target, "");

  const questions: AgentQuestion[] = [
    {
      header: "Style",
      question: "Which tone should be used?",
      options: [{ label: "Formal" }, { label: "Informal" }],
    },
    {
      header: "Language",
      question: "Which language?",
      options: [{ label: "English" }, { label: "Italian" }],
    },
  ];
  const selected = new Map<number, Set<string>>([
    [0, new Set(["Formal"])],
    [1, new Set(["English"])],
  ]);
  const custom = new Map<number, string>([[0, "with academic references"]]);
  const formatted = formatQuestionAnswers(questions, selected, custom, tEn);
  assert.match(formatted, /Here are my answers to your questions:/);
  assert.match(
    formatted,
    /\*\*Style — Which tone should be used\?\*\*: Formal, with academic/
  );
  assert.match(formatted, /\*\*Language — Which language\?\*\*: English/);
});

test("Runners compute total tokens and read history fallback", async () => {
  const histories: HistoryMap = {
    ses_hist_ctx: [
      {
        role: "assistant",
        text: "Saved response",
        tokens: {
          input: 2400,
          output: 120,
          reasoning: 50,
          cache: { read: 150000, write: 0 },
        },
        cost: 0.0012,
      },
    ],
  };
  const host = createMockHost(
    { binaryPath: "/nonexistent/opencode" },
    histories
  );
  const oc = new OpencodeRunner(host);
  const agy = new AntigravityRunner(host);
  const col = createCollector();

  // OpenCode step_finish without tokens.total
  oc.handleLine(
    JSON.stringify({
      type: "step_finish",
      sessionID: "ses_hist_ctx",
      part: {
        type: "step-finish",
        tokens: {
          input: 300,
          output: 100,
          reasoning: 50,
          cache: { read: 1000, write: 0 },
        },
        cost: 0.0005,
      },
    }),
    col.cb
  );
  assert.equal(col.finishes.at(-1)?.tokens?.total, 450);

  // Antigravity result without usage.total_tokens
  agy.handleLine(
    JSON.stringify({
      event: "result",
      result: {
        response: "Ok",
        usage: {
          input_tokens: 500,
          output_tokens: 150,
          thinking_tokens: 50,
        },
      },
    }),
    col.cb
  );
  assert.equal(col.finishes.at(-1)?.tokens?.total, 700);

  // getSessionTokens falls back to saved history (including cache.read)
  const ctxTokens = await oc.getSessionTokens("ses_hist_ctx");
  assert.equal(ctxTokens.input, 152400);
  assert.equal(ctxTokens.output, 120);
});

test("HermesRunner parses sample-stream.ndjson and builds CLI args", () => {
  const host = createMockHost({
    autoApprove: true,
    engines: {
      hermes: {
        binary: "hermes",
        model: "deepseek-v4.1-flash",
        options: { provider: "custom", reasoning: "medium" },
      },
    },
  });
  const runner = new HermesRunner(host);
  const col = createCollector();

  const newArgs = runner.buildArgs({
    prompt: "Inspect repo",
    fileAttachments: [],
  });
  assert.equal(newArgs[0], "chat");
  assert.ok(newArgs.includes("--format"));
  assert.ok(newArgs.includes("--yolo"));
  assert.equal(newArgs[newArgs.indexOf("--model") + 1], "deepseek-v4.1-flash");
  assert.equal(newArgs[newArgs.indexOf("--provider") + 1], "custom");
  assert.equal(newArgs[newArgs.indexOf("--reasoning") + 1], "medium");

  // On resume, Hermes refuses creation overrides (--yolo, --model, --provider, --reasoning)
  const resumeArgs = runner.buildArgs({
    prompt: "Inspect repo",
    fileAttachments: [],
    sessionId: "hermes-sess-001",
  });
  assert.equal(resumeArgs[0], "chat");
  assert.ok(resumeArgs.includes("--format"));
  assert.equal(resumeArgs[resumeArgs.indexOf("--resume") + 1], "hermes-sess-001");
  assert.equal(resumeArgs.includes("--yolo"), false);
  assert.equal(resumeArgs.includes("--model"), false);
  assert.equal(resumeArgs.includes("--provider"), false);
  assert.equal(resumeArgs.includes("--reasoning"), false);

  const fixturePath = join(
    process.cwd(),
    "test/fixtures/hermes/sample-stream.ndjson"
  );
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);
  const state = { accumulatedText: "", activeToolSteps: new Map() };
  for (const line of lines) {
    runner.handleLine(line, col.cb, state);
  }

  assert.equal(col.sessions[0], "hermes-sess-001");
  assert.equal(col.reasonings[0].text, "Evaluating repository structure...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[0].title, "ls -la");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.steps[1].durationMs, 400);
  assert.equal(
    col.texts.at(-1)?.text,
    "I inspected the directory and found README.md."
  );
  assert.equal(col.finishes.length, 1);
  assert.equal(col.finishes[0].tokens?.total, 1060);
  assert.equal(col.finishes[0].cost, 0.0018);
});

test("PiRunner parses sample-stream.ndjson and builds CLI args", () => {
  const host = createMockHost();
  const runner = new PiRunner(host);
  const col = createCollector();

  const args = runner.buildArgs({
    prompt: "Check config",
    fileAttachments: [],
    sessionId: "pi-sess-001",
  });
  assert.ok(args.includes("--print"));
  assert.equal(args[args.indexOf("--mode") + 1], "json");
  assert.equal(args[args.indexOf("--session") + 1], "pi-sess-001");

  const fixturePath = join(
    process.cwd(),
    "test/fixtures/pi/sample-stream.ndjson"
  );
  const lines = readFileSync(fixturePath, "utf-8").split("\n").filter(Boolean);
  const state = {
    accumulatedText: "",
    accumulatedReasoning: "",
    toolTitles: new Map(),
  };
  for (const line of lines) {
    runner.handleLine(line, col.cb, state);
  }

  assert.equal(col.sessions[0], "pi-sess-001");
  assert.equal(col.reasonings[0].text, "Reading configuration file...");
  assert.equal(col.steps.length, 2);
  assert.equal(col.steps[0].state, "running");
  assert.equal(col.steps[0].title, "Config.md");
  assert.equal(col.steps[1].state, "completed");
  assert.equal(col.texts.at(-1)?.text, "Configuration is valid.");
  assert.equal(col.finishes.length, 1);
  assert.equal(col.finishes[0].tokens?.total, 680);
  assert.equal(col.finishes[0].cost, 0.0015);
});

test("Mock CLI Simulator executes end-to-end with runners", async () => {
  const mockCliPath = join(process.cwd(), "test/mock-cli.mjs");
  const host = createMockHost({
    engines: {
      hermes: {
        binary: mockCliPath,
        model: "deepseek-v4.1-flash",
        options: { provider: "opencode-go", reasoning: "medium" },
      },
    },
  });
  const hermes = new HermesRunner(host);
  const version = await hermes.getVersion();
  assert.match(version, /hermes-mock 1\.0\.0/);

  const col = createCollector();
  await new Promise<void>((resolve) => {
    hermes.runStream(
      { prompt: "Hello mock", fileAttachments: [], cwd: process.cwd() },
      {
        ...col.cb,
        onDone: (code) => {
          col.dones.push(code);
          resolve();
        },
      }
    );
  });

  assert.equal(col.dones[0], 0);
  assert.equal(col.sessions[0], "hermes-sess-001");
  assert.equal(
    col.texts.at(-1)?.text,
    "I inspected the directory and found README.md."
  );

  // PiRunner dynamically queries `--list-models`
  const hostPi = createMockHost({
    engines: {
      pi: {
        binary: mockCliPath,
        model: "",
        options: { provider: "" },
      },
    },
  });
  const pi = new PiRunner(hostPi);
  const piModels = await pi.listModels(true);
  assert.ok(piModels.length > 0);
});

test("execCli enforces timeout and terminates hanging processes", async () => {
  const host = createMockHost();
  const runner = new HermesRunner(host) as unknown as {
    execCli: (
      bin: string,
      args: string[],
      cwd?: string,
      env?: NodeJS.ProcessEnv,
      timeoutMs?: number
    ) => Promise<string>;
  };

  await assert.rejects(
    () =>
      runner.execCli(
        process.execPath,
        ["-e", "setTimeout(() => {}, 10000)"],
        undefined,
        undefined,
        150
      ),
    /timed out after 150ms/
  );
});

test("sqlEscape, parseHermesConfigModels, and context limit estimation work accurately", async () => {
  const host = createMockHost();
  const hermes = new HermesRunner(host);
  const agy = new AntigravityRunner(host);

  assert.equal(hermes.sqlEscape("O'Reilly's Note"), "O''Reilly''s Note");

  const parsedModels = hermes.parseHermesConfigModels(
    [
      "model:",
      "  provider: opencode-go",
      "  default: deepseek-v4.1-flash",
      "default_model: fallback-model",
    ].join("\n")
  );
  assert.deepEqual(parsedModels, ["deepseek-v4.1-flash", "fallback-model"]);

  assert.equal(
    await agy.getModelContextLimit("gemini-3.8-flash-high"),
    1_048_576
  );
  assert.equal(
    await agy.getModelContextLimit("claude-opus-5-5-high"),
    1_000_000
  );
  assert.equal(
    await agy.getModelContextLimit("claude-sonnet-4"),
    200_000
  );
  assert.equal(
    await agy.getModelContextLimit("deepseek-v4.1-flash"),
    1_000_000
  );
  assert.equal(await agy.getModelContextLimit("grok-4.7"), 500_000);
});

test("spawnJsonlStream decodes multi-byte UTF-8 split across chunks and calls onDone once", async () => {
  const host = createMockHost();
  const runner = new HermesRunner(host) as unknown as {
    spawnJsonlStream: (
      bin: string,
      args: string[],
      cwd: string | undefined,
      onLine: (line: string) => void,
      cb: StreamCallbacks
    ) => { abort: () => void };
  };

  const lines: string[] = [];
  const col = createCollector();
  // Write a 4-byte emoji (🚀 = F0 9F 9A 80) split across two separate stdout writes
  const script = [
    "const b = Buffer.from(JSON.stringify({ text: '🚀 Ciao' }) + '\\n', 'utf8');",
    "process.stdout.write(b.subarray(0, 11));",
    "setTimeout(() => process.stdout.write(b.subarray(11)), 20);",
  ].join(" ");

  await new Promise<void>((resolve) => {
    runner.spawnJsonlStream(
      process.execPath,
      ["-e", script],
      undefined,
      (line) => lines.push(line),
      {
        ...col.cb,
        onDone: (code) => {
          col.dones.push(code);
          resolve();
        },
      }
    );
  });

  assert.equal(col.dones.length, 1);
  assert.equal(col.dones[0], 0);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).text, "🚀 Ciao");
});

