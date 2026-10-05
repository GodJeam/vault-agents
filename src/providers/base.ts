import { spawn, type ChildProcess, type SpawnOptions } from "child_process";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { copyFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { extname, join } from "path";
import { homedir, tmpdir } from "os";
import { FileSystemAdapter } from "obsidian";
import type OpencodePlugin from "../main";

export abstract class BaseCliRunner {
  protected plugin: OpencodePlugin;
  protected resolvedBinaries = new Map<string, string | null>();
  protected activeProcs = new Set<ChildProcess>();

  constructor(plugin: OpencodePlugin) {
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
    const options: SpawnOptions = {
      cwd,
      shell: isWin && (bin.endsWith(".cmd") || bin.endsWith(".bat")),
      windowsHide: true,
      env: extraEnv ? Object.assign({}, process.env, extraEnv) : process.env,
      stdio: ["ignore", "pipe", "pipe"],
    };
    const child = spawn(bin, args, options);
    this.trackProc(child);
    return child;
  }

  /**
   * Execute a CLI binary synchronously-like via promise, returning standard output
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

    this.resolvedBinaries.set(bin, bin);
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
      const { readFileSync } = require("fs");
      const content = readFileSync(shimPath, "utf8");
      const { dirname } = require("path");
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
   * Retrieve the absolute filesystem path of the Obsidian vault
   */
  getVaultPath(): string | null {
    const adapter = this.plugin.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
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
    await new Promise<void>((resolve, reject) => {
      const child = this.spawnBinary(bin, [cleanInput, "-o", outPath]);
      let err = "";
      child.stderr?.on("data", (d: Buffer) => (err += d.toString()));
      child.on("error", (e) => reject(e));
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`anydoc exited with code ${code}: ${err.trim().slice(0, 200)}`));
      });
    });

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
