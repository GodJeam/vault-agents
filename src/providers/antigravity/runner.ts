import { existsSync, readFileSync } from "fs";
import { basename, isAbsolute, join } from "path";
import { homedir } from "os";
import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "../../main";
import type { AgentProvider } from "../../core/provider";
import type {
  EngineType,
  RunHandle,
  SessionInfo,
  StreamCallbacks,
  UsageStats,
} from "../../core/types";
import { BaseCliRunner } from "../base";
import type { AntigravityEvent } from "./types";

// Legacy Antigravity conversation ids are UUID-style (they contain "-"), while
// opencode session ids use the "ses_..." form. Used to attribute untagged
// history entries that pre-date `sessionEngines`.
const ANTIGRAVITY_ID_HINT = /-/;

export class AntigravityRunner extends BaseCliRunner implements AgentProvider {
  readonly id: EngineType = "antigravity";
  readonly displayName = "Antigravity CLI";
  readonly engine: EngineType = "antigravity";
  readonly included = true;
  readonly costNote = "Google AI Pro";

  private cachedModels: string[] | null = null;

  constructor(plugin: OpencodePlugin) {
    super(plugin);
  }

  async getVersion(): Promise<string> {
    const bin = this.resolveBinaryPath(this.plugin.settings.antigravityBinary || "agy");
    const out = await this.execCli(bin, ["--version"]);
    const first = out.trim().split("\n")[0];
    if (!first) throw new Error("Empty output from agy --version");
    return first;
  }

  async listModels(forceRefresh = false): Promise<string[]> {
    if (!forceRefresh && this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels;
    }
    const bin = this.resolveBinaryPath(this.plugin.settings.antigravityBinary || "agy");
    try {
      const out = await this.execCli(bin, ["models"]);
      const models: string[] = [];
      for (const line of out.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^([a-zA-Z0-9_.-]+)\s+/);
        if (match) {
          const id = match[1];
          if (id !== "Fetching" && id !== "Usage" && !models.includes(id)) {
            models.push(id);
          }
        } else if (/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
          if (trimmed !== "Fetching" && !models.includes(trimmed)) {
            models.push(trimmed);
          }
        }
      }
      if (models.length > 0) {
        this.cachedModels = models;
        return models;
      }
    } catch (e) {
      console.warn("[vault-agents] Failed to fetch agy models dynamically:", e);
    }

    // Default fallback models for Antigravity (Google AI Pro)
    const defaults = [
      "gemini-3.8-flash-high",
      "gemini-3.8-flash-medium",
      "gemini-3.8-flash-low",
      "claude-opus-5-5-high",
      "claude-opus-5-5-medium",
      "claude-opus-5-5-low",
      "claude-sonnet-5-5-high",
      "claude-sonnet-5-5-medium",
      "claude-sonnet-5-5-low",
      "gpt-oss-120b-medium",
    ];
    this.cachedModels = defaults;
    return defaults;
  }

  async listSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    const seenIds = new Set<string>();

    // 1. Try querying conversation_summaries.db via sqlite3
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const query =
          "SELECT conversation_id, title, strftime('%s', last_modified_time) FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 50";
        const out = await this.execSqlite(dbPath, query);
        for (const line of out.trim().split("\n")) {
          const parts = line.split("|");
          const id = parts[0]?.trim();
          if (!id) continue;
          const title = parts[1]?.trim() || id;
          const sec = parseInt(parts[2]?.trim() || "", 10);
          const updated = !isNaN(sec) && sec > 0 ? sec * 1000 : Date.now();
          sessions.push({
            id,
            title,
            updated,
            engine: "antigravity",
          });
          seenIds.add(id);
        }
      } catch {
        // Sqlite query not available or error, fall through to history
      }
    }

    // 2. Add any Antigravity sessions saved in Obsidian histories
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (seenIds.has(id)) continue;
      if (sessionEngines[id] === "antigravity" || (!sessionEngines[id] && ANTIGRAVITY_ID_HINT.test(id))) {
        const firstUser = msgs.find((m) => m.role === "user");
        const title = firstUser?.text ? firstUser.text.slice(0, 40) : id;
        sessions.push({
          id,
          title,
          updated: Date.now(),
          engine: "antigravity",
        });
        seenIds.add(id);
      }
    }

    return sessions;
  }

  async renameSession(sessionId: string, title: string): Promise<void> {
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const safeTitle = title.replace(/'/g, "''");
        const safeId = sessionId.replace(/'/g, "''");
        await this.execSqlite(
          dbPath,
          `UPDATE conversation_summaries SET title = '${safeTitle}' WHERE conversation_id = '${safeId}'`
        );
      } catch {
        // Best effort
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const dbPath = this.getDbPath();
    if (existsSync(dbPath)) {
      try {
        const safeId = sessionId.replace(/'/g, "''");
        await this.execSqlite(
          dbPath,
          `DELETE FROM conversation_summaries WHERE conversation_id = '${safeId}'`
        );
      } catch {
        // Best effort
      }
    }
  }

  async getModelContextLimit(model: string): Promise<number> {
    const m = model.toLowerCase();
    if (m.includes("gemini")) return 1_048_576; // 1M tokens
    if (m.includes("claude")) return 200_000; // 200K tokens
    return 128_000;
  }

  async getSessionTokens(sessionId: string): Promise<{ input: number; output: number }> {
    // The context bar needs the *current* context size, which is the prompt size
    // of the last turn, not the sum over the whole conversation.
    const history = this.plugin.getHistory(sessionId);
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === "assistant" && msg.tokens) {
        return { input: msg.tokens.input ?? 0, output: msg.tokens.output ?? 0 };
      }
    }
    return { input: 0, output: 0 };
  }

  async getUsageStats(): Promise<UsageStats> {
    let totalIn = 0;
    let totalOut = 0;
    const histories = this.plugin.histories ?? {};
    const sessionEngines = this.plugin.settings.sessionEngines ?? {};
    for (const [id, msgs] of Object.entries(histories)) {
      if (sessionEngines[id] === "antigravity" || !sessionEngines[id]) {
        for (const msg of msgs) {
          if (msg.role === "assistant" && msg.tokens) {
            totalIn += msg.tokens.input ?? 0;
            totalOut += msg.tokens.output ?? 0;
          }
        }
      }
    }
    const win = { input: totalIn, output: totalOut, cost: 0 };
    return {
      h5: win,
      week: win,
      month: win,
    };
  }

  runStream(prompt: string, fileAttachments: string[], cb: StreamCallbacks): RunHandle {
    const s = this.plugin.settings;
    const adapter = this.plugin.app.vault.adapter;
    const cwd = adapter instanceof FileSystemAdapter ? adapter.getBasePath() : undefined;

    let finalPrompt = prompt;

    // Attach contents of text/markdown files directly so Antigravity can reason over them.
    // Avoid reading binary files (images, PDFs, archives) as raw UTF-8 strings to prevent token explosion.
    const BINARY_EXT_REGEX =
      /\.(png|jpe?g|gif|webp|bmp|svg|ico|pdf|zip|tar|gz|7z|rar|bin|exe|dmg|iso|mp3|wav|ogg|mp4|mov|avi|mkv|wasm)$/i;

    for (const p of fileAttachments) {
      const fullPath = !isAbsolute(p) && cwd ? join(cwd, p) : p;
      if (BINARY_EXT_REGEX.test(fullPath)) {
        finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
      } else {
        try {
          const content = readFileSync(fullPath, "utf-8");
          const filename = basename(fullPath);
          finalPrompt = `[ATTACHMENT: ${filename}]\n${content}\n\n---\n\n` + finalPrompt;
        } catch {
          finalPrompt = `[ATTACHMENT PATH: ${fullPath}]\n\n---\n\n` + finalPrompt;
        }
      }
    }

    const args = ["-p", finalPrompt, "--output-format", "stream-json"];

    // Automatically approve tool execution and file modification permissions
    args.push("--dangerously-skip-permissions");

    const sid = s.sessionId;
    if (sid && !sid.startsWith("ses_")) {
      args.push("--conversation", sid);
    }

    const model = s.antigravityModel || s.model;
    if (model) {
      args.push("--model", model);
    }

    // Antigravity model ids already encode the reasoning effort (e.g.
    // "gemini-3.8-flash-low"); passing --effort as well makes the CLI reject the
    // combination. Only send --effort for models without an effort suffix.
    const modelEncodesEffort = /-(low|medium|high|xhigh|max)$/i.test(model || "");
    if (!modelEncodesEffort && s.antigravityEffort) {
      args.push("--effort", s.antigravityEffort);
    }

    const bin = this.resolveBinaryPath(s.antigravityBinary || "agy");
    const child = this.spawnBinary(bin, args, cwd);

    const streamState = { accumulatedText: "" };

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          this.handleLine(line, cb, streamState);
        } catch (e) {
          console.error("vault-agents: error handling antigravity event:", e);
        }
      }
    });

    child.stdout?.on("end", () => {
      if (buffer.trim()) this.handleLine(buffer.trim(), cb, streamState);
    });

    child.stderr?.on("data", (d: Buffer) => {
      if (cb.onRaw) cb.onRaw(d.toString());
    });

    child.on("error", (e) => cb.onError(e.message));
    child.on("close", (code) => {
      cb.onDone(code ?? -1);
    });

    return {
      abort: () => this.killProc(child, true),
    };
  }

  private handleLine(
    line: string,
    cb: StreamCallbacks,
    streamState: { accumulatedText: string }
  ): void {
    if (line.length > 20_000_000) {
      cb.onRaw?.(`[omitted event of ${line.length} bytes]\n`);
      return;
    }
    let ev: AntigravityEvent;
    try {
      ev = JSON.parse(line);
    } catch {
      cb.onRaw?.(line + "\n");
      return;
    }

    // 1. Init event
    if (ev.event === "init") {
      const cid = ev.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }
      return;
    }

    // 2. Step update event
    if (ev.event === "step_update" && ev.step_update) {
      const su = ev.step_update;
      const cid = su.conversation_id;
      if (typeof cid === "string" && cid) {
        cb.onSession(cid);
      }

      const stepType = su.step_type;
      const stepIndex = su.step_index;

      // Accumulate incremental text chunks (delta)
      if (typeof su.text_delta === "string" && su.text_delta) {
        streamState.accumulatedText += su.text_delta;
        cb.onText(streamState.accumulatedText, String(stepIndex ?? 0));
      }

      // Reasoning / thought block if present
      if (typeof su.thought === "string" && su.thought) {
        cb.onReasoning(su.thought, String(stepIndex ?? 0));
      } else if (typeof su.reasoning === "string" && su.reasoning) {
        cb.onReasoning(su.reasoning, String(stepIndex ?? 0));
      }

      // Tool execution: extract descriptive title from parameters for the UI
      if (stepType === "tool") {
        const toolName = String(su.tool_name || su.tool_info?.name || "tool");
        const isDone = su.state === "DONE";
        const isError = su.status === "ERROR" || Boolean(su.error);
        const params = su.tool_info?.parameters;

        let title = "";
        if (params && typeof params === "object") {
          if (params.toolSummary && typeof params.toolSummary === "string") {
            title = params.toolSummary;
          } else if (params.CommandLine && typeof params.CommandLine === "string") {
            title = params.CommandLine;
          } else if (params.TargetFile && typeof params.TargetFile === "string") {
            title = basename(params.TargetFile);
          } else if (params.AbsolutePath && typeof params.AbsolutePath === "string") {
            title = basename(params.AbsolutePath);
          } else if (params.toolAction && typeof params.toolAction === "string") {
            title = params.toolAction;
          } else if (params.query && typeof params.query === "string") {
            title = params.query;
          }
        }
        if (!title) {
          title = toolName;
        }

        cb.onStep({
          id: `step-${stepIndex ?? Date.now()}-${toolName}`,
          tool: toolName,
          title,
          state: isDone ? (isError ? "error" : "completed") : "running",
          input: params,
          output: su.tool_info?.output,
        });
      }

      return;
    }

    // 3. Result event: synchronize full final response and token usage
    if (ev.event === "result" && ev.result) {
      const res = ev.result;
      if (typeof res.response === "string" && res.response.trim()) {
        streamState.accumulatedText = res.response;
        cb.onText(streamState.accumulatedText, "final");
      }
      const u = res.usage ?? {};
      cb.onFinish({
        tokens: {
          total: u.total_tokens ?? 0,
          input: u.input_tokens ?? 0,
          output: u.output_tokens ?? 0,
          reasoning: u.thinking_tokens ?? 0,
        },
        cost: 0, // Included with Google AI Pro!
      });
      return;
    }

    // 4. Error event
    if (ev.event === "error" || ev.error) {
      const msg = ev.error?.message || JSON.stringify(ev.error || ev);
      cb.onError(String(msg));
    }
  }

  private execSqlite(dbPath: string, query: string): Promise<string> {
    return this.execCli("sqlite3", [dbPath, query]);
  }

  private getDbPath(): string {
    return join(homedir(), ".gemini", "antigravity-cli", "conversation_summaries.db");
  }
}
