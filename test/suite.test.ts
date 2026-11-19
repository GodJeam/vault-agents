import { test } from "node:test";
import * as assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { chmod, mkdtemp, mkdir, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Component, type App } from "obsidian";
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
import { pruneHistoryMap } from "../src/core/history";
import { neutralizeRemoteMarkdown } from "../src/features/chat/sanitize";
import {
  MAX_STREAM_LINE_BYTES,
  buildAnydocArgs,
  chooseAttachmentMode,
  ensurePrivateTempDir,
  getAnydocTempDir,
  isExecutableFile,
  parseCmdNodeScript,
  parseSqliteChanges,
  restrictFilePermissions,
} from "../src/providers/base";
import { AntigravityRunner } from "../src/providers/antigravity/runner";
import { OpencodeRunner } from "../src/providers/opencode/runner";
import { HermesRunner } from "../src/providers/hermes/runner";
import { PiRunner } from "../src/providers/pi/runner";
import { formatToolAction, serializeStepDetails } from "../src/features/chat/stepWidget";
import { formatQuestionAnswers } from "../src/features/chat/questionCard";
import { AssistantBubble } from "../src/features/chat/messageBubble";
import {
  AGENT_ICON_IDS,
  AGENT_ICON_SVGS,
  buildAgentSvgMarkup,
} from "../src/shared/agentIcons";
import { fuzzyMatchScore } from "../src/shared/suggestModals";
import {
  IT_TRANSLATIONS,
  hasTranslation,
  substitute,
  translate,
} from "../src/i18n";

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
  assert.equal(DEFAULT_SETTINGS.saveHistory, true);
  assert.equal(DEFAULT_SETTINGS.historyMaxSessions, 50);
  assert.equal(DEFAULT_SETTINGS.historyMaxBytes, 5_000_000);

  // A missing setting must fall back to the secure default...
  assert.equal(migrateSettings({}).settings.autoApprove, false);
  // ...while an explicit user choice is preserved.
  assert.equal(migrateSettings({ autoApprove: true }).settings.autoApprove, true);
});

test("pruneHistoryMap keeps active/pinned sessions and enforces limits", () => {
  const entry = (text: string, timestamp: number) => [
    { role: "user" as const, text, timestamp },
  ];
  const histories: HistoryMap = {
    active: entry("a", 10),
    pinned: entry("b", 20),
    older: entry("c", 30),
    newest: entry("d", 40),
  };

  const pruned = pruneHistoryMap(histories, {
    maxSessions: 3,
    maxBytes: 0,
    keepIds: ["active", "pinned"],
  });
  assert.deepEqual(Object.keys(pruned).sort(), [
    "active",
    "newest",
    "pinned",
  ]);

  // keepIds survive even when they alone exceed the configured limits.
  const keepOnly = pruneHistoryMap(histories, {
    maxSessions: 1,
    maxBytes: 1,
    keepIds: ["active", "pinned"],
  });
  assert.deepEqual(Object.keys(keepOnly).sort(), ["active", "pinned"]);

  // Byte limit drops sessions that do not fit.
  const tiny = pruneHistoryMap(histories, {
    maxSessions: 10,
    maxBytes: 1,
    keepIds: [],
  });
  assert.deepEqual(tiny, {});
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

test("substitute leaves $0 untouched and replaces numbered placeholders", () => {
  assert.equal(substitute("$1 ($0.00)", "X"), "X ($0.00)");
  assert.equal(substitute("$1 and $2", "a", "b"), "a and b");
});

test("attachment budget and sqlite changes helpers behave correctly", () => {
  assert.equal(chooseAttachmentMode(100, 1000, 1000), "inline");
  assert.equal(chooseAttachmentMode(1001, 1000, 1000), "path");
  assert.equal(chooseAttachmentMode(100, 1000, 50), "path");
  assert.equal(parseSqliteChanges("0\n1\n"), 1);
  assert.equal(parseSqliteChanges("0"), 0);
  assert.equal(parseSqliteChanges(""), 0);
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

test("neutralizeRemoteMarkdown blocks remote media but keeps links", () => {
  const markdown = [
    "remote ![a](https://evil.example/a.png)",
    "proto ![b](//evil.example/b.png)",
    'title ![c](https://evil.example/c.png "cap")',
    "angle ![d](<https://evil.example/d.png>)",
    "local ![ok](attachments/local.png)",
    '<img src="https://evil.example/x.png" alt="x">',
    '<video src="https://evil.example/v.mp4"></video>',
    '<audio src="https://evil.example/a.mp3"></audio>',
    '<div style="background: url(https://evil.example/bg.png)">x</div>',
    '<video poster="https://evil.example/p.png"></video>',
    "[ref]: https://evil.example/r.png",
    "![r][ref]",
    "[normal link](https://example.com/page)",
  ].join("\n");

  const out = neutralizeRemoteMarkdown(markdown);
  assert.equal(/evil\.example/.test(out), false);
  assert.equal(out.includes("<img"), false);
  assert.equal(out.includes('src="https://evil'), false);
  assert.ok(out.includes("![ok](attachments/local.png)"));
  assert.ok(out.includes("[normal link](https://example.com/page)"));
});

test("temp conversion directory and files are private", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX permissions only");
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "vault-agents-perm-"));
  try {
    const dir = join(root, "cache");
    // Simulate a cache directory created by an older version with loose perms.
    await mkdir(dir, { recursive: true, mode: 0o755 });
    await ensurePrivateTempDir(dir);
    assert.equal((await stat(dir)).mode & 0o777, 0o700);

    const file = join(dir, "converted.md");
    await writeFile(file, "# converted");
    await restrictFilePermissions(file);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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

test("migrateSettings rejects malformed untrusted data", () => {
  const { settings, histories } = migrateSettings({
    language: "de",
    engine: {},
    autoApprove: "yes",
    anydocEnabled: 1,
    anydocBinary: "   ",
    anydocHostedOcr: "true",
    sessionId: 123,
    sessionEngines: { ses_1: "opencode", ses_2: 42, ses_3: "" },
    pinned: ["a", "a", 3, " b "],
    prompts: [
      { name: "ok", text: "hello" },
      { name: "", text: "x" },
      { name: "bad", text: 5 },
      null,
    ],
    dbCleanupMaxMB: -5,
    dbCleanupAgeDays: 9999,
    maxAttachMB: 1e9,
    historyMaxSessions: 0,
    historyMaxBytes: -1,
    engines: {
      opencode: {
        binary: 42,
        model: 7,
        options: { agent: "build", bad: 5 },
      },
      unknown: "x",
    },
    histories: {
      ses_1: [
        { role: "user", text: "hi", timestamp: "yesterday" },
        { role: "system", text: "nope" },
        {
          role: "assistant",
          text: "ok",
          tokens: { input: 10, output: "x", cache: { read: 5 } },
          cost: "free",
        },
        "junk",
      ],
      ses_bad: "nope",
      ses_empty: [],
    },
  } as unknown as Record<string, unknown>);

  assert.equal(settings.language, "en");
  assert.equal(settings.engine, "antigravity");
  assert.equal(settings.autoApprove, false);
  assert.equal(settings.anydocEnabled, false);
  assert.equal(settings.anydocBinary, "anydoc");
  assert.equal(settings.anydocHostedOcr, false);
  assert.equal(settings.sessionId, "");
  assert.deepEqual(settings.sessionEngines, {
    ses_1: "opencode",
    ses_3: "",
  });
  assert.deepEqual(settings.pinned, ["a", "b"]);
  assert.equal(settings.prompts.length, 1);
  assert.equal(settings.prompts[0].name, "ok");
  assert.equal(settings.dbCleanupMaxMB, 1);
  assert.equal(settings.dbCleanupAgeDays, 365);
  assert.equal(settings.maxAttachMB, 500);
  assert.equal(settings.historyMaxSessions, 1);
  assert.equal(settings.historyMaxBytes, 1_048_576);
  assert.equal(settings.engines.opencode.binary, "opencode");
  assert.equal(
    settings.engines.opencode.model,
    "opencode-go/deepseek-v4.1-flash"
  );
  assert.equal(settings.engines.opencode.options.agent, "build");
  assert.equal(settings.engines.opencode.options.bad, undefined);
  assert.equal(settings.engines.unknown, undefined);

  assert.equal(histories.ses_1.length, 2);
  assert.equal(histories.ses_1[0].role, "user");
  assert.equal(histories.ses_1[0].timestamp, undefined);
  const assistant = histories.ses_1[1];
  assert.equal(assistant.role, "assistant");
  if (assistant.role === "assistant") {
    assert.equal(assistant.tokens?.input, 10);
    assert.equal(assistant.tokens?.output, undefined);
    assert.equal(assistant.tokens?.cache?.read, 5);
    assert.equal(assistant.cost, undefined);
  }
  assert.equal(histories.ses_bad, undefined);
  assert.equal(histories.ses_empty, undefined);
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
    "0da89d6e-47ea-4d39-aa41-2bd0aa103371": [
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
  assert.equal(args[firstFileIdx + 1], join("/mock/vault", "Docs/Lecture 1.pdf"));
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
    /\*\*Style: Which tone should be used\?\*\*: Formal, with academic/
  );
  assert.match(formatted, /\*\*Language: Which language\?\*\*: English/);
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

  // Resume forwards the same per-run overrides; Hermes accepts them on
  // resumed sessions (CLI args win over the stored session config).
  const resumeArgs = runner.buildArgs({
    prompt: "Inspect repo",
    fileAttachments: [],
    sessionId: "hermes-sess-001",
  });
  assert.equal(resumeArgs[0], "chat");
  assert.ok(resumeArgs.includes("--format"));
  assert.equal(resumeArgs[resumeArgs.indexOf("--resume") + 1], "hermes-sess-001");
  assert.equal(resumeArgs.includes("--yolo"), true);
  assert.equal(resumeArgs[resumeArgs.indexOf("--model") + 1], "deepseek-v4.1-flash");
  assert.equal(resumeArgs[resumeArgs.indexOf("--provider") + 1], "custom");
  assert.equal(resumeArgs[resumeArgs.indexOf("--reasoning") + 1], "medium");

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

test("Runners accumulate multi-part text and reasoning without overwriting", () => {
  const host = createMockHost();
  const oc = new OpencodeRunner(host);
  const ocState = { textParts: new Map<string, string>(), reasoningParts: new Map<string, string>() };
  const ocCol = createCollector();

  oc.handleLine(
    JSON.stringify({ type: "reasoning", sessionID: "ses_1", part: { id: "r1", type: "reasoning", text: "Step 1 thought" } }),
    ocCol.cb,
    ocState
  );
  oc.handleLine(
    JSON.stringify({ type: "text", sessionID: "ses_1", part: { id: "p1", type: "text", text: "Checking file..." } }),
    ocCol.cb,
    ocState
  );
  oc.handleLine(
    JSON.stringify({ type: "reasoning", sessionID: "ses_1", part: { id: "r2", type: "reasoning", text: "Step 2 thought" } }),
    ocCol.cb,
    ocState
  );
  oc.handleLine(
    JSON.stringify({ type: "text", sessionID: "ses_1", part: { id: "p2", type: "text", text: "All done." } }),
    ocCol.cb,
    ocState
  );

  assert.equal(ocCol.texts.at(-1)?.text, "Checking file...\n\nAll done.");
  assert.equal(ocCol.reasonings.at(-1)?.text, "Step 1 thought\n\nStep 2 thought");

  const agy = new AntigravityRunner(host);
  const agyState = { accumulatedText: "", reasoningParts: new Map<string, string>() };
  const agyCol = createCollector();
  agy.handleLine(
    JSON.stringify({ event: "step_update", step_update: { step_index: 1, thought: "First" } }),
    agyCol.cb,
    agyState
  );
  agy.handleLine(
    JSON.stringify({ event: "step_update", step_update: { step_index: 3, thought: "Second" } }),
    agyCol.cb,
    agyState
  );
  assert.equal(agyCol.reasonings.at(-1)?.text, "First\n\nSecond");

  const hermes = new HermesRunner(host);
  const hermesState = {
    accumulatedText: "",
    accumulatedReasoning: "",
    hadToolSinceReasoning: false,
    activeToolSteps: new Map(),
  };
  const hCol = createCollector();
  hermes.handleLine(JSON.stringify({ type: "reasoning", text: "Part A" }), hCol.cb, hermesState);
  hermes.handleLine(JSON.stringify({ type: "tool_use", call_id: "c1", name: "read", input: { path: "a.md" } }), hCol.cb, hermesState);
  hermes.handleLine(JSON.stringify({ type: "reasoning", text: "Part B" }), hCol.cb, hermesState);
  assert.equal(hCol.reasonings.at(-1)?.text, "Part A\n\nPart B");
});

test("neutralizeRemoteMarkdown preserves code blocks and blocks unquoted/SVG/paren media", () => {
  const md = [
    "```markdown",
    "![example](https://evil.example/inside-code.png)",
    "[ref]: https://evil.example/code-ref.png",
    "```",
    "Inline code `![inline](https://evil.example/inline.png)` stays intact.",
    "Balanced parens ![wiki](https://evil.example/Image_(2026).png)",
    "<object data=https://evil.example/obj.swf></object>",
    "<svg><image href=\"https://evil.example/svg.png\"/></svg>",
    "<video src=https://evil.example/v.mp4></video>",
    "[multiline]:\n  https://evil.example/multi-line-ref.png",
  ].join("\n");

  const out = neutralizeRemoteMarkdown(md);
  assert.ok(out.includes("![example](https://evil.example/inside-code.png)"));
  assert.ok(out.includes("[ref]: https://evil.example/code-ref.png"));
  assert.ok(out.includes("`![inline](https://evil.example/inline.png)`"));
  assert.equal(out.includes("Image_(2026).png"), false);
  assert.equal(out.includes("obj.swf"), false);
  assert.equal(out.includes("svg.png"), false);
  assert.equal(out.includes("v.mp4"), false);
  assert.equal(out.includes("multi-line-ref.png"), false);
});

test("redact masks JSON credentials and additional provider prefixes", () => {
  assert.equal(
    redact('{"apiKey": "my-secret-value-123"}'),
    '{"apiKey": "[REDACTED]"}'
  );
  assert.equal(
    redact("failed with xai-1234567890abcdef and gsk_1234567890abcdef and hf_1234567890abcdef"),
    "failed with xai-[REDACTED] and gsk_[REDACTED] and hf_[REDACTED]"
  );
});

test("ensurePrivateTempDir rejects symlinks and parseCmdNodeScript handles %dp0% and %~dp0", async (t) => {
  assert.equal(
    parseCmdNodeScript('"%_prog%" "%dp0%\\node_modules\\pkg\\cli.js" %*', "C:\\npm"),
    join("C:\\npm", "node_modules", "pkg", "cli.js")
  );
  assert.equal(
    parseCmdNodeScript('node "%~dp0\\bin\\tool.mjs" %*', "C:\\npm"),
    join("C:\\npm", "bin", "tool.mjs")
  );

  if (process.platform === "win32") {
    t.skip("POSIX symlink check");
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "vault-agents-sym-"));
  try {
    const target = join(root, "real");
    const link = join(root, "link");
    await mkdir(target);
    await symlink(target, link);
    await assert.rejects(() => ensurePrivateTempDir(link), /Unsafe temp directory|File exists/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AntigravityRunner does not claim Hermes/Pi IDs and stats skip undated messages in 5h/week", async () => {
  const histories: HistoryMap = {
    "hermes-sess-001": [
      { role: "assistant", text: "h", tokens: { input: 500, output: 50 }, timestamp: Date.now() },
    ],
    "pi-sess-001": [
      { role: "assistant", text: "p", tokens: { input: 600, output: 60 }, timestamp: Date.now() },
    ],
    "0da89d6e-47ea-4d39-aa41-2bd0aa103371": [
      { role: "assistant", text: "undated", tokens: { input: 100, output: 10 } },
      { role: "assistant", text: "recent", tokens: { input: 25, output: 5 }, timestamp: Date.now() },
    ],
  };
  const host = createMockHost({ sessionEngines: {} }, histories);
  const agy = new AntigravityRunner(host);
  const agySessions = await agy.listSessions();
  const ids = agySessions.map((s) => s.id);
  assert.equal(ids.includes("hermes-sess-001"), false);
  assert.equal(ids.includes("pi-sess-001"), false);
  assert.equal(ids.includes("0da89d6e-47ea-4d39-aa41-2bd0aa103371"), true);

  const stats = await agy.getUsageStats();
  assert.equal(stats.h5.input, 25);
  assert.equal(stats.week.input, 25);
  assert.equal(stats.month.input, 125);
});

test("PiRunner.buildArgs separates options from prompt with -- and spawnJsonlStream recovers after oversized line", async () => {
  const host = createMockHost();
  const pi = new PiRunner(host);
  const args = pi.buildArgs({ prompt: "- leading dash", fileAttachments: ["a.md"] });
  const sepIdx = args.indexOf("--");
  assert.ok(sepIdx >= 0);
  assert.equal(args[sepIdx + 1], `@${join("/mock/vault", "a.md")}`);
  assert.equal(args[sepIdx + 2], "- leading dash");

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
  const script = [
    `const big = "x".repeat(${MAX_STREAM_LINE_BYTES + 100});`,
    "process.stdout.write(big + '\\n' + JSON.stringify({ text: 'ok' }) + '\\n');",
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

  assert.equal(col.errors.length, 1);
  assert.match(col.errors[0], /exceeded maximum buffer size/);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).text, "ok");
});

test("Official SVG agent icons are defined for all providers in original brand colors", () => {
  const host = createMockHost();
  const runners = [
    new AntigravityRunner(host),
    new OpencodeRunner(host),
    new HermesRunner(host),
    new PiRunner(host),
  ];
  for (const r of runners) {
    const iconId = r.descriptor.icon;
    assert.ok(iconId && iconId in AGENT_ICON_SVGS, `missing icon SVG for ${r.id}`);
    assert.equal(iconId, AGENT_ICON_IDS[r.id as keyof typeof AGENT_ICON_IDS]);
    const svg = AGENT_ICON_SVGS[iconId];
    assert.equal(svg.includes("<svg"), false);
    assert.equal(svg.includes("currentColor"), false);
    assert.ok(svg.includes("<path"));

    const fullMarkup = buildAgentSvgMarkup(iconId);
    assert.ok(fullMarkup && fullMarkup.startsWith("<svg ") && fullMarkup.endsWith("</svg>"));
  }

  assert.equal(buildAgentSvgMarkup("bot"), null);

  const agy1 = buildAgentSvgMarkup(AGENT_ICON_IDS.antigravity) || "";
  const agy2 = buildAgentSvgMarkup(AGENT_ICON_IDS.antigravity) || "";
  const id1 = agy1.match(/id="(va-agy-\d+-m)"/)?.[1];
  const id2 = agy2.match(/id="(va-agy-\d+-m)"/)?.[1];
  assert.ok(id1 && id2 && id1 !== id2, "Antigravity mask IDs should be unique per render");
  assert.ok(agy1.includes(`mask="url(#${id1})"`));
  assert.ok(agy2.includes(`mask="url(#${id2})"`));
});

test("fuzzyMatchScore ranks exact/prefix matches above fuzzy matches and rejects misses", () => {
  const exact = fuzzyMatchScore("sonnet", "anthropic/claude-sonnet-4");
  const fuzzy = fuzzyMatchScore("cs4", "anthropic/claude-sonnet-4");
  assert.ok(exact > fuzzy);
  assert.ok(fuzzy > 0);
  assert.equal(fuzzyMatchScore("gemini gpt", "anthropic/claude-sonnet-4"), -1);

  const migrated = migrateSettings({
    sessionTitles: { ses_1: "Architecture review", bad: 42 },
    autoContinueOnLimit: false,
  } as unknown as Record<string, unknown>);
  assert.deepEqual(migrated.settings.sessionTitles, { ses_1: "Architecture review" });
  assert.equal(migrated.settings.autoContinueOnLimit, false);
});

test("PiRunner deduplicates message_end/agent_end usage and joins multi-block content", () => {
  const host = createMockHost();
  const pi = new PiRunner(host);
  const col = createCollector();
  const state = {
    accumulatedText: "",
    accumulatedReasoning: "",
    toolTitles: new Map(),
    emittedUsage: false,
  };

  const assistantMsg = {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "Plan A" },
      { type: "thinking", thinking: "Plan B" },
      { type: "text", text: "First paragraph." },
      { type: "text", text: "Second paragraph." },
    ],
    usage: { input: 100, output: 40, totalTokens: 140, cost: { total: 0.002 } },
  };

  pi.handleLine(JSON.stringify({ type: "message_end", message: assistantMsg }), col.cb, state);
  pi.handleLine(JSON.stringify({ type: "agent_end", messages: [assistantMsg] }), col.cb, state);

  assert.equal(col.finishes.length, 1, "agent_end must not double-count message_end usage");
  assert.equal(col.finishes[0].tokens?.total, 140);
  assert.equal(col.finishes[0].cost, 0.002);
  assert.equal(col.texts.at(-1)?.text, "First paragraph.\n\nSecond paragraph.");
  assert.equal(col.reasonings.at(-1)?.text, "Plan A\n\nPlan B");

  // When only agent_end is emitted, usage must still be recorded once
  const col2 = createCollector();
  const state2 = {
    accumulatedText: "",
    accumulatedReasoning: "",
    toolTitles: new Map(),
    emittedUsage: false,
  };
  pi.handleLine(JSON.stringify({ type: "agent_end", messages: [assistantMsg] }), col2.cb, state2);
  assert.equal(col2.finishes.length, 1);
});

test("inlinePromptAttachments preserves attachment order and Antigravity/Hermes caches behave cleanly", async () => {
  const root = await mkdtemp(join(tmpdir(), "vault-agents-order-"));
  try {
    const f1 = join(root, "alpha.md");
    const f2 = join(root, "beta.md");
    const f3 = join(root, "gamma.md");
    await writeFile(f1, "ALPHA_CONTENT", "utf8");
    await writeFile(f2, "BETA_CONTENT", "utf8");
    await writeFile(f3, "GAMMA_CONTENT", "utf8");

    const host = createMockHost();
    const hermes = new HermesRunner(host) as unknown as {
      inlinePromptAttachments: (
        prompt: string,
        files: string[],
        cwd?: string
      ) => string;
    };
    const combined = hermes.inlinePromptAttachments(
      "MAIN_PROMPT",
      [f1, f2, f3],
      root
    );
    const i1 = combined.indexOf("ALPHA_CONTENT");
    const i2 = combined.indexOf("BETA_CONTENT");
    const i3 = combined.indexOf("GAMMA_CONTENT");
    const ip = combined.indexOf("MAIN_PROMPT");
    assert.ok(i1 >= 0 && i2 > i1 && i3 > i2 && ip > i3, "attachments must keep [1, 2, 3] order before prompt");
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  // AntigravityRunner ignores foreign session IDs and does not cache fallback models on failure
  const agyHost = createMockHost();
  const agy = new AntigravityRunner(agyHost);
  for (const foreignId of ["ses_abc123", "hermes-123", "pi-456"]) {
    const args = agy.buildArgs({ prompt: "hi", fileAttachments: [], sessionId: foreignId });
    assert.equal(args.includes("--resume"), false, `Antigravity should ignore ${foreignId}`);
  }

  let agyShouldFail = true;
  (agy as unknown as { execCli: () => Promise<string> }).execCli = async () => {
    if (agyShouldFail) throw new Error("CLI offline");
    return "gemini-live-test  Gemini Live\n";
  };
  const fallbackModels = await agy.listModels(false);
  assert.ok(fallbackModels.length > 0);
  agyShouldFail = false;
  const liveModels = await agy.listModels(false);
  assert.equal(liveModels.includes("gemini-live-test"), true, "fallback models must not stick in cache");

  // HermesRunner cache key respects options.provider
  const hermesHost = createMockHost();
  const hermes2 = new HermesRunner(hermesHost);
  let hermesCalls = 0;
  (
    hermes2 as unknown as {
      execHermesPython: (_script: string, extraArgs?: string[]) => Promise<string | null>;
    }
  ).execHermesPython = async (_script, extraArgs = []) => {
    hermesCalls++;
    const prov = extraArgs[0] || "default";
    return JSON.stringify({ models: [`${prov}/model-${hermesCalls}`] });
  };

  hermesHost.getEngineConfig("hermes").options = { provider: "openai" };
  const m1 = await hermes2.listModels(false);
  const m1Cached = await hermes2.listModels(false);
  assert.equal(hermesCalls, 1);
  assert.deepEqual(m1, m1Cached);
  assert.equal(m1.includes("openai/model-1"), true);

  hermesHost.getEngineConfig("hermes").options = { provider: "anthropic" };
  const m2 = await hermes2.listModels(false);
  assert.equal(hermesCalls, 2);
  assert.equal(m2.includes("anthropic/model-2"), true);
  assert.equal(m2.includes("openai/model-1"), false);
});

test("isExecutableFile rejects directories and invalidateBinaryCache clears cached resolutions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vault-agents-exec-"));
  try {
    assert.equal(isExecutableFile(dir), false);
    assert.equal(isExecutableFile(join(dir, "does-not-exist")), false);
    assert.equal(isExecutableFile(process.execPath), true);

    const host = createMockHost();
    const runner = new HermesRunner(host) as unknown as {
      resolvedBinaries: Map<string, string | null>;
      resolveBinaryPath: (bin: string) => string;
      invalidateBinaryCache: () => void;
    };
    runner.resolveBinaryPath(process.execPath);
    assert.equal(runner.resolvedBinaries.has(process.execPath), true);
    runner.invalidateBinaryCache();
    assert.equal(runner.resolvedBinaries.size, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("execCli enforces maxOutputBytes and convertDocument enforces timeout and UID-scoped unique temp files", async () => {
  const host = createMockHost();
  const runner = new HermesRunner(host) as unknown as {
    execCli: (
      bin: string,
      args: string[],
      cwd?: string,
      env?: NodeJS.ProcessEnv,
      timeoutMs?: number,
      maxOutputBytes?: number
    ) => Promise<string>;
  };

  await assert.rejects(
    () =>
      runner.execCli(
        process.execPath,
        ["-e", "process.stdout.write('A'.repeat(2048))"],
        undefined,
        undefined,
        5000,
        512
      ),
    /exceeded maximum buffer size/
  );

  const anydocDir = getAnydocTempDir();
  if (typeof process.getuid === "function") {
    assert.ok(anydocDir.endsWith(`vault-agents-anydoc-${process.getuid()}`));
  }

  const root = await mkdtemp(join(tmpdir(), "vault-agents-anydoc-test-"));
  const createdOutputs: string[] = [];
  try {
    const samplePdf = join(root, "sample.pdf");
    await writeFile(samplePdf, "dummy pdf payload", "utf8");

    // 1. Hanging anydoc script must time out
    const hangScript = join(root, "hang-anydoc.mjs");
    await writeFile(
      hangScript,
      "#!/usr/bin/env node\nsetTimeout(() => {}, 10000);\n",
      "utf8"
    );
    await chmod(hangScript, 0o755);

    const hangHost = createMockHost({ anydocBinary: hangScript });
    const hangRunner = new HermesRunner(hangHost);
    await assert.rejects(
      () => hangRunner.convertDocument(samplePdf, 150),
      /anydoc timed out after 150ms/
    );

    // 2. Concurrent conversions of the same file must use unique temp inputs and succeed cleanly
    const okScript = join(root, "ok-anydoc.mjs");
    await writeFile(
      okScript,
      [
        "#!/usr/bin/env node",
        "import { readFileSync, writeFileSync } from 'node:fs';",
        "const args = process.argv.slice(2);",
        "const input = args[0];",
        "const outIdx = args.indexOf('-o');",
        "const output = args[outIdx + 1];",
        "setTimeout(() => {",
        "  const content = readFileSync(input, 'utf8');",
        "  writeFileSync(output, '# Converted\\n' + content, 'utf8');",
        "}, 40);",
      ].join("\n"),
      "utf8"
    );
    await chmod(okScript, 0o755);

    const okHost = createMockHost({ anydocBinary: okScript });
    const okRunner = new HermesRunner(okHost);
    const [out1, out2] = await Promise.all([
      okRunner.convertDocument(samplePdf, 5000),
      okRunner.convertDocument(samplePdf, 5000),
    ]);
    createdOutputs.push(out1, out2);
    assert.equal(out1, out2);
    assert.match(readFileSync(out1, "utf8"), /# Converted\ndummy pdf payload/);

    // Verify no leftover temp input/output artifacts remain for this conversion
    const dirEntries = await readdir(anydocDir);
    const leftovers = dirEntries.filter(
      (f) => f.startsWith("in-") || f.startsWith("out-")
    );
    assert.equal(leftovers.length, 0, "temporary input/output files should be cleaned up");
  } finally {
    for (const p of new Set(createdOutputs)) {
      await rm(p, { force: true }).catch(() => {});
    }
    await rm(root, { recursive: true, force: true });
  }
});

test("redact and stepWidget redact new key prefixes and tool I/O details", () => {
  const sample =
    "keys: fc-1234567890abcdef tvly-abcdef1234567890 npm_1234567890abcdefghij pypi-1234567890abcdefghij";
  const cleaned = redact(sample);
  assert.equal(cleaned.includes("1234567890"), false);
  assert.ok(cleaned.includes("fc-[REDACTED]"));
  assert.ok(cleaned.includes("tvly-[REDACTED]"));
  assert.ok(cleaned.includes("npm_[REDACTED]"));
  assert.ok(cleaned.includes("pypi-[REDACTED]"));

  const stepDetails = serializeStepDetails(
    {
      id: "step-1",
      tool: "bash",
      title: "curl -H 'Authorization: Bearer secret_token_999999' https://user:pass123@example.com",
      state: "completed",
      input: {
        cmd: "curl https://api.example.com",
        apiKey: "sk-proj-supersecret123456",
      },
      output: "Token: fc-firecrawlsecretkey12345",
    },
    (s) => s
  );
  assert.equal(stepDetails.includes("supersecret123456"), false);
  assert.equal(stepDetails.includes("firecrawlsecretkey12345"), false);
  assert.ok(stepDetails.includes("[REDACTED]"));

  const action = formatToolAction(
    "bash",
    "curl -H 'Authorization: Bearer secret_token_999999' https://user:pass123@example.com",
    (s) => s
  );
  assert.equal(action.target.includes("secret_token_999999"), false);
  assert.equal(action.target.includes("pass123"), false);
});

test("neutralizeRemoteMarkdown preserves reference links while blocking image refs and remote style blocks", () => {
  const md = [
    "Read the [API docs][docs], [guide][], or [home].",
    "Mixed ref: [click][both] and ![tracker][both].",
    "Pure image ref: ![banner][imgref].",
    "<style>@import url('https://evil.example/track.css');</style>",
    "<style>.x { background: url(//evil.example/bg.png); }</style>",
    "<style>.local { color: red; }</style>",
    "",
    "[docs]: https://example.com/docs",
    "[guide]: https://example.com/guide",
    "[home]: https://example.com/home",
    "[both]: https://evil.example/both.png",
    "[imgref]: https://evil.example/banner.png",
  ].join("\n");

  const out = neutralizeRemoteMarkdown(md);
  assert.ok(out.includes("[docs]: https://example.com/docs"));
  assert.ok(out.includes("[guide]: https://example.com/guide"));
  assert.ok(out.includes("[home]: https://example.com/home"));
  assert.ok(out.includes("<style>.local { color: red; }</style>"));
  assert.equal(out.includes("evil.example"), false);
  assert.equal(out.includes("track.css"), false);
  assert.equal(out.includes("bg.png"), false);
  assert.equal(out.includes("both.png"), false);
  assert.equal(out.includes("banner.png"), false);
});

test("sqlEscape strips NUL bytes and OpencodeRunner backupSqliteDb handles WAL vacuum and fallback", async () => {
  const host = createMockHost();
  const oc = new OpencodeRunner(host);

  assert.equal(oc.sqlEscape("a\0b'c\0"), "ab''c");

  const root = await mkdtemp(join(tmpdir(), "vault-agents-bak-"));
  try {
    const dbPath = join(root, "opencode.db");
    const bakPath = dbPath + ".bak";
    await writeFile(dbPath, "SQLITE_DATA", "utf8");

    const runner = oc as unknown as {
      execSqlite: (db: string, sql: string) => Promise<string>;
      backupSqliteDb: (db: string, bak: string) => Promise<void>;
    };

    // 1. WAL-safe VACUUM INTO path
    let seenSql = "";
    runner.execSqlite = async (_db, sql) => {
      seenSql = sql;
      const m = sql.match(/VACUUM INTO '([^']+)'/);
      assert.ok(m, "expected VACUUM INTO SQL");
      await writeFile(m[1], "VACUUMED_SNAPSHOT", "utf8");
      return "";
    };
    await runner.backupSqliteDb(dbPath, bakPath);
    assert.match(seenSql, /^VACUUM INTO '/);
    assert.equal(readFileSync(bakPath, "utf8"), "VACUUMED_SNAPSHOT");

    // 2. Fallback to copyFile when sqlite3 fails
    runner.execSqlite = async () => {
      throw new Error("sqlite3 not found");
    };
    await runner.backupSqliteDb(dbPath, bakPath);
    assert.equal(readFileSync(bakPath, "utf8"), "SQLITE_DATA");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("i18n dictionary maintains EN/IT parity, placeholder consistency, and prototype safety", () => {
  const entries = Object.entries(IT_TRANSLATIONS);
  assert.ok(entries.length > 200);

  for (const [en, it] of entries) {
    assert.ok(en.trim().length > 0, "English key must be non-empty");
    assert.ok(it.trim().length > 0, `Italian translation missing for: ${en}`);
    const enPlaceholders = [...en.matchAll(/\$[1-9]\d*/g)].map((m) => m[0]).sort();
    const itPlaceholders = [...it.matchAll(/\$[1-9]\d*/g)].map((m) => m[0]).sort();
    assert.deepEqual(
      itPlaceholders,
      enPlaceholders,
      `Placeholder mismatch for key "${en}" -> "${it}"`
    );
  }

  // Prototype keys must never resolve to Object.prototype functions
  for (const key of ["constructor", "toString", "valueOf", "__proto__"]) {
    assert.equal(hasTranslation(key), false);
    assert.equal(translate("it", key), key);
  }

  // All provider descriptor descriptions & option labels must have IT translations
  const host = createMockHost();
  const runners = [
    new AntigravityRunner(host),
    new OpencodeRunner(host),
    new HermesRunner(host),
    new PiRunner(host),
  ];
  for (const r of runners) {
    const d = r.descriptor;
    assert.equal(hasTranslation(d.binaryDesc), true, `missing binaryDesc translation for ${r.id}`);
    assert.equal(hasTranslation(d.modelDesc), true, `missing modelDesc translation for ${r.id}`);
    for (const opt of d.options) {
      assert.equal(hasTranslation(opt.label), true, `missing option label translation: ${opt.label}`);
      assert.equal(hasTranslation(opt.desc), true, `missing option desc translation: ${opt.desc}`);
      if (opt.placeholder) {
        assert.equal(
          hasTranslation(opt.placeholder),
          true,
          `missing option placeholder translation: ${opt.placeholder}`
        );
      }
      for (const ch of opt.choices ?? []) {
        assert.equal(hasTranslation(ch.label), true, `missing choice label translation: ${ch.label}`);
      }
    }
  }

  // Verify every single-literal t("...") call across src/ has an IT translation
  const walkTs = (dir: string): string[] => {
    const res: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) res.push(...walkTs(p));
      else if (p.endsWith(".ts")) res.push(p);
    }
    return res;
  };
  for (const file of walkTs("src")) {
    if (file.endsWith(join("i18n", "index.ts"))) continue;
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?:\.|\b)t\(\s*"([^"\\\n]+)"\s*\)/g)) {
      const key = m[1];
      assert.equal(
        hasTranslation(key),
        true,
        `Missing IT translation for literal "${key}" in ${file}`
      );
    }
  }
});

test("AssistantBubble unloads previous MarkdownRenderer child components on re-render", () => {
  type MockEl = {
    textContent: string;
    classes: Set<string>;
    children: MockEl[];
    createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
    createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
    createEl: (_tag: string, opts?: { cls?: string; text?: string }) => MockEl;
    addClass: (c: string) => void;
    removeClass: (c: string) => void;
    toggleClass: (c: string, on: boolean) => void;
    setText: (s: string) => void;
    setAttribute: () => void;
    addEventListener: () => void;
    querySelector: () => null;
    empty: () => void;
  };

  const makeEl = (text = ""): MockEl => {
    const el: MockEl = {
      textContent: text,
      classes: new Set(),
      children: [],
      createDiv(opts) {
        const c = makeEl(opts?.text ?? "");
        this.children.push(c);
        return c;
      },
      createSpan(opts) {
        const c = makeEl(opts?.text ?? "");
        this.children.push(c);
        return c;
      },
      createEl(_tag, opts) {
        const c = makeEl(opts?.text ?? "");
        this.children.push(c);
        return c;
      },
      addClass(c) { this.classes.add(c); },
      removeClass(c) { this.classes.delete(c); },
      toggleClass(c, on) { if (on) this.classes.add(c); else this.classes.delete(c); },
      setText(s) { this.textContent = s; },
      setAttribute() {},
      addEventListener() {},
      querySelector() { return null; },
      empty() { this.children = []; this.textContent = ""; },
    };
    return el;
  };

  const prevWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
  };

  try {
    const parent = new Component() as Component & { _children: Set<Component & { _loaded: boolean }> };
    parent.load();
    const mockApp = { workspace: { getActiveFile: () => null } } as unknown as App;
    const bubble = new AssistantBubble(
      makeEl() as unknown as HTMLElement,
      mockApp,
      parent,
      "Agent",
      (s) => s,
      false,
      () => {},
      () => {},
      () => ""
    );

    const flush = () => (bubble as unknown as { flushRender: () => void }).flushRender();
    const seenChildren = new Set<Component & { _loaded: boolean }>();

    for (let i = 1; i <= 5; i++) {
      bubble.setText(`chunk ${i}`);
      flush();
      assert.equal(parent._children.size, 1, "only one active renderChild should remain attached");
      for (const c of parent._children) seenChildren.add(c);
    }

    assert.equal(seenChildren.size, 5, "each render cycle should create a fresh child component");
    const unloadedCount = [...seenChildren].filter((c) => !c._loaded).length;
    assert.equal(unloadedCount, 4, "all 4 previous render children must have been unloaded");

    bubble.finalize();
    assert.equal(parent._children.size, 1);
    const finalChild = [...parent._children][0];
    assert.equal(finalChild._loaded, true);

    parent.unload();
    assert.equal(parent._children.size, 0);
    assert.equal(finalChild._loaded, false, "unloading session component must unload finalized bubble child");
    bubble.dispose();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});

test("Settings tab and modals use native Obsidian setHeading/setTitle APIs", () => {
  const settingsSrc = readFileSync(join("src", "features", "settings", "settingsTab.ts"), "utf8");
  assert.equal(/createEl\(["']h[234]["']/.test(settingsSrc), false, "settingsTab should use Setting.setHeading()");
  assert.ok(settingsSrc.includes(".setHeading()"));
  assert.ok(settingsSrc.includes("hide(): void"));

  const modalsSrc = readFileSync(join("src", "shared", "modals.ts"), "utf8");
  assert.equal(/createEl\(["']h[234]["']/.test(modalsSrc), false, "modals should use Modal.setTitle() and Setting.setHeading()");
  assert.ok(modalsSrc.includes("this.setTitle("));
});


