import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { dirname, extname, join } from "path";
import { homedir, tmpdir } from "os";
import type { RunnerHost } from "../core/provider";
import type { RunHandle, RunRequest, StreamCallbacks } from "../core/types";

export const MAX_STREAM_LINE_BYTES = 20_000_000;

export abstract class BaseCliRunner {
  protected plugin: RunnerHost;
  protected resolvedBinaries = new Map<string, string | null>();
  protected activeProcs = new Set<ChildProcess>();

  constructor(plugin: RunnerHost) {
    this.plugin = plugin;
  }

  /**
   * Terminate all currently active child processes
   */
  killAll(): void {
    for (const child of [...this.activeProcs]) {
      this.killNow(child);
    }
    this.activeProcs.clear();
  }

  /**
   * Forcibly terminate a specific child process
   */
  killNow(child: ChildProcess): void {
    if (!child || child.pid === undefined) return;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      // ignore
    }
    try {
      child.kill();
    } catch {
      // ignore
    }
  }

  /**
   * Terminate process with optional watchdog to ensure exit
   */
  killProc(child: ChildProcess, watch = false): void {
    this.killNow(child);
    if (!watch) return;
    const deadline = Date.now() + 6000;
    const timer = setInterval(() => {
      if (child.exitCode !== null || child.signalCode !== null || Date.now() > deadline) {
        clearInterval(timer);
        return;
      }
      this.killNow(child);
    }, 1000);
  }

  /**
   * Register a spawned process for tracking and automatic cleanup
   */
  protected trackProc(child: ChildProcess): void {
    this.activeProcs.add(child);
    child.once("close", () => this.activeProcs.delete(child));
    child.once("error", () => this.activeProcs.delete(child));
  }

  /**
   * Spawn a CLI process with proper platform flags and environment
   */
  protected spawnBinary(
    bin: string,
    args: string[],
    cwd?: string,
    extraEnv?: NodeJS.ProcessEnv
  ): ChildProcess {
    const isWin = process.platform === "win32";
    const env: NodeJS.ProcessEnv =
      cwd || extraEnv
        ? Object.assign({}, process.env, cwd ? { PWD: cwd } : undefined, extraEnv)
        : process.env;
    const options: SpawnOptions = {
      cwd,
      shell: isWin && (bin.endsWith(".cmd") || bin.endsWith(".bat")),
      windowsHide: true,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(bin, args, options);
    this.trackProc(child);
    return child;
  }

  /**
   * Normalize both `runStream(req, cb)` and legacy `runStream(prompt, files, cb)` signatures
   */
  protected normalizeRunArgs(
    reqOrPrompt: RunRequest | string,
    fileAttachmentsOrCb?: string[] | StreamCallbacks,
    maybeCb?: StreamCallbacks
  ): { req: RunRequest; cb: StreamCallbacks } {
    if (typeof reqOrPrompt === "string") {
      return {
        req: {
          prompt: reqOrPrompt,
          fileAttachments: Array.isArray(fileAttachmentsOrCb) ? fileAttachmentsOrCb : [],
        },
        cb: maybeCb as StreamCallbacks,
      };
    }
    return {
      req: reqOrPrompt,
      cb: fileAttachmentsOrCb as StreamCallbacks,
    };
  }

  /**
   * Shared JSONL streaming execution loop for CLI providers
   */
  protected spawnJsonlStream(
    bin: string,
    args: string[],
    cwd: string | undefined,
    onLine: (line: string) => void,
    cb: StreamCallbacks
  ): RunHandle {
    const child = this.spawnBinary(bin, args, cwd);

    let buffer = "";
    child.stdout?.on("data", (d: Buffer) => {
      buffer += d.toString();
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          onLine(line);
        } catch (e) {
          console.error("[vault-agents] error handling stream event:", e);
        }
      }
    });

    child.stdout?.on("end", () => {
      const remaining = buffer.trim();
      if (remaining) {
        try {
          onLine(remaining);
        } catch (e) {
          console.error("[vault-agents] error handling final stream event:", e);
        }
      }
    });

    child.stderr?.on("data", (d: Buffer) => {
      cb.onRaw?.(d.toString());
    });

    child.on("error", (e) => cb.onError(e.message));
    child.on("close", (code) => {
      cb.onDone(code ?? -1);
    });

    return {
      abort: () => this.killProc(child, true),
    };
  }

  /**
   * Execute a CLI binary via promise, returning standard output
   */
  protected execCli(
    bin: string,
    args: string[],
    cwd?: string,
    extraEnv?: NodeJS.ProcessEnv
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = this.spawnBinary(bin, args, cwd, extraEnv);
      let out = "";
      let err = "";
      child.stdout?.on("data", (d: Buffer) => (out += d.toString()));
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err.trim() || out.trim() || `exit code ${code}`));
      });
    });
  }

  /**
   * Resolve full path to a CLI executable, checking PATH and common candidate directories
   */
  protected resolveBinaryPath(bin: string, candidatePaths: string[] = []): string {
    const cached = this.resolvedBinaries.get(bin);
    if (cached !== undefined && cached !== null) return cached;

    if (process.platform === "win32") {
      const winResolved = this.findWindowsBinary(bin);
      if (winResolved) {
        this.resolvedBinaries.set(bin, winResolved);
        return winResolved;
      }
    }

    if (existsSync(bin)) {
      this.resolvedBinaries.set(bin, bin);
      return bin;
    }

    const defaultCandidates = [
      join(homedir(), ".local", "bin", bin),
      join(homedir(), ".opencode", "bin", bin),
      join(homedir(), ".gemini", "antigravity-cli", "bin", bin),
      `/usr/local/bin/${bin}`,
      `/usr/bin/${bin}`,
    ];

    const allCandidates = [...candidatePaths, ...defaultCandidates];
    for (const p of allCandidates) {
      if (existsSync(p)) {
        this.resolvedBinaries.set(bin, p);
        return p;
      }
    }

    return bin;
  }

  private findWindowsBinary(bin: string): string | null {
    if (bin.toLowerCase().endsWith(".exe")) return bin;
    const hasPath = bin.includes("\\") || bin.includes("/");
    if (hasPath) {
      const resolved = this.resolveCmdShim(bin);
      if (resolved) return resolved;
      const dir = join(bin, "..");
      const exe = join(dir, bin.replace(/\.(cmd|bat|ps1)$/i, "") + ".exe");
      return existsSync(exe) ? exe : null;
    }
    const dirs = (process.env.PATH ?? "").split(";").filter(Boolean);
    for (const dir of dirs) {
      const cmdPath = join(dir, bin + ".cmd");
      const exePath = join(dir, bin + ".exe");
      if (existsSync(cmdPath)) {
        const resolved = this.resolveCmdShim(cmdPath);
        if (resolved) return resolved;
      }
      if (existsSync(exePath)) return exePath;
    }
    return null;
  }

  private resolveCmdShim(shimPath: string): string | null {
    try {
      const content = readFileSync(shimPath, "utf8");
      const dir = dirname(shimPath);
      const m = content.match(/"([^"]+\.exe)"/i);
      if (m) {
        const target = m[1].replace(/%dp0%/gi, dir).replace(/%base%/gi, dir);
        if (existsSync(target)) return target;
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Retrieve the absolute filesystem path of the Obsidian vault via RunnerHost
   */
  getVaultPath(): string | null {
    return this.plugin.getVaultPath();
  }

  /**
   * Convert a document (PDF, Word, Excel, etc.) to Markdown using anydoc
   */
  async convertDocument(absPath: string): Promise<string> {
    const hash = createHash("sha256").update(absPath).digest("hex").slice(0, 16);
    const dir = join(tmpdir(), "vault-agents-anydoc");
    await mkdir(dir, { recursive: true });
    const outPath = join(dir, hash + ".md");

    try {
      const [src, out] = await Promise.all([stat(absPath), stat(outPath)]);
      if (out.mtimeMs >= src.mtimeMs) return outPath;
    } catch {
      // Not yet cached
    }

    const ext = extname(absPath) || ".pdf";
    const cleanInput = join(dir, "in-" + hash + ext);
    await copyFile(absPath, cleanInput);
    await this.cleanupTempFiles(dir);

    const bin = this.resolveBinaryPath(this.plugin.settings.anydocBinary || "anydoc");
    try {
      await new Promise<void>((resolve, reject) => {
        const child = this.spawnBinary(bin, [cleanInput, "--ocr", "hosted", "-o", outPath]);
        let err = "";
        child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
        child.on("error", (e) => reject(e));
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`anydoc exited with code ${code}: ${err.trim().slice(0, 200)}`));
        });
      });
    } finally {
      await unlink(cleanInput).catch(() => {});
    }

    return outPath;
  }

  /**
   * Delete stale temporary files older than maxAgeMs (default 24h)
   */
  protected async cleanupTempFiles(dir: string, maxAgeMs = 24 * 3600 * 1000): Promise<void> {
    try {
      const files = await readdir(dir);
      const now = Date.now();
      for (const f of files) {
        try {
          const p = join(dir, f);
          const st = await stat(p);
          if (now - st.mtimeMs > maxAgeMs) {
            await unlink(p);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }
}
