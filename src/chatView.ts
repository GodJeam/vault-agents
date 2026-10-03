import { App, FileSystemAdapter, ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type OpencodePlugin from "./main";
import type { HistoryAssistant } from "./main";
import { DEFAULT_SETTINGS } from "./settings";
import type { AgentRunner, FinishInfo, RunHandle, SessionInfo, StepInfo } from "./types";
import { substitute } from "./i18n";
import { ConfirmModal, FileSuggestModal, ModelSuggestModal, RenameModal, StatsModal, type ModelItem } from "./modals";

export const CHAT_VIEW_TYPE = "opencode-chat-view";

// Cap the number of rendered suggestions so a large vault does not build
// thousands of DOM rows on every keystroke.
const MAX_SUGGEST = 50;

export interface TurnContext {
  label: string;
  content: string;
}

interface SessionStats {
  input: number;
  output: number;
  total: number;
  cost: number;
}

interface SuggestItem {
  label: string;
  desc?: string;
  action: () => void;
}

export class ChatView extends ItemView {
  plugin: OpencodePlugin;
  private messagesEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private contextBar!: HTMLElement;
  private contextLabelEl!: HTMLElement;
  private contextClearBtn!: HTMLButtonElement;
  private sessionSelect!: HTMLSelectElement;
  private pinBtn!: HTMLButtonElement;
  private renameBtn!: HTMLButtonElement;
  private deleteBtn!: HTMLButtonElement;
  private modelBtn!: HTMLButtonElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private statsBar!: HTMLElement;
  private contextEl!: HTMLElement;
  private contextFillEl!: HTMLElement;
  private attachmentsBar!: HTMLElement;
  private suggestEl!: HTMLElement;
  private attachments: { path: string; label: string; image?: boolean }[] = [];
  private viewSession: string;
  private pendingUser: { text: string; contextLabel?: string } | null = null;
  private currentProc: RunHandle | null = null;
  private running = false;
  private dispatching = false;
  private context: TurnContext | null = null;
  private renderTimer: number | null = null;
  private hadStreamError = false;
  private stoppedByUser = false;
  private lastStderr = "";
  private stats: SessionStats = { input: 0, output: 0, total: 0, cost: 0 };
  private contextLimit = 0;
  private contextUsed = 0;
  private contextBaseInput = 0;
  private contextRunInput = 0;
  private activityTimer: number | null = null;
  private suggestItems: SuggestItem[] = [];
  private suggestRows: HTMLElement[] = [];
  private suggestIndex = 0;
  private suggestOpen = false;
  private suggestTrigger: { char: string; start: number } | null = null;
  private vaultPaths: string[] | null = null;
  private vaultPathsLower: string[] | null = null;
  private activeBubble: AssistantBubble | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: OpencodePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewSession = plugin.settings.sessionId;
  }

  getRunner(): AgentRunner {
    return this.plugin.getRunnerForSession(this.viewSession);
  }

  assistantLabel(): string {
    return this.getRunner().engine === "antigravity" ? "Antigravity" : this.plugin.t("Opencode");
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.t("Vault Agents chat");
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("opencode-chat");

    this.messagesEl = container.createDiv({ cls: "opencode-messages" });
    this.buildContextBar(container);
    this.buildAttachmentsBar(container);
    this.buildStatsBar(container);
    this.buildInputArea(container);
    void this.populateSessionSelect().then(() => {
      this.loadHistoryForSession(this.viewSession);
    });
  }

  onClose(): Promise<void> {
    this.currentProc?.abort();
    this.currentProc = null;
    if (this.activityTimer !== null) {
      clearInterval(this.activityTimer);
      this.activityTimer = null;
    }
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.activeBubble?.dispose();
    this.activeBubble = null;
    return super.onClose();
  }

  setContext(ctx: TurnContext): void {
    this.context = ctx;
    this.updateContextBar();
  }

  focusInput(): void {
    this.inputEl?.focus();
  }

  sendText(text: string): void {
    if (this.inputEl) this.inputEl.value = text;
    this.send();
  }

  private buildContextBar(container: HTMLElement): void {
    this.contextBar = container.createDiv({ cls: "opencode-context-bar" });

    this.contextLabelEl = this.contextBar.createSpan({ cls: "opencode-context-label" });
    this.contextClearBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn hidden",
      attr: { title: this.plugin.t("Remove the attached context") },
    });
    setIcon(this.contextClearBtn, "x");
    this.contextClearBtn.addEventListener("click", () => {
      this.context = null;
      this.updateContextBar();
    });

    this.contextBar.createSpan({ cls: "opencode-context-spacer" });

    this.sessionSelect = this.contextBar.createEl("select", {
      cls: "opencode-session-select",
    });
    this.sessionSelect.addEventListener("change", () => {
      const v = this.sessionSelect.value;
      if (v !== this.viewSession) {
        this.viewSession = v;
        this.plugin.settings.sessionId = v;
        void this.plugin.saveSettings();
        this.loadHistoryForSession(v);
      }
      this.updateSessionBtnStates();
    });

    this.pinBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Pin/Unpin session") },
    });
    setIcon(this.pinBtn, "pin");
    this.pinBtn.addEventListener("click", () => this.togglePin());

    this.renameBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Rename session") },
    });
    setIcon(this.renameBtn, "pencil");
    this.renameBtn.addEventListener("click", () => this.renameCurrentSession());

    this.deleteBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Delete session") },
    });
    setIcon(this.deleteBtn, "trash");
    this.deleteBtn.addEventListener("click", () => this.deleteCurrentSession());

    const statsBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Token and cost statistics") },
    });
    setIcon(statsBtn, "bar-chart-3");
    statsBtn.addEventListener("click", () => new StatsModal(this.app, this.plugin).open());

    const attachBtn = this.contextBar.createEl("button", { cls: "opencode-add-note-btn" });
    attachBtn.setText("＋ " + this.plugin.t("Attach file"));
    attachBtn.addEventListener("click", () => this.openFilePicker());

    const add = this.contextBar.createEl("button", { cls: "opencode-add-note-btn" });
    add.setText("+ " + this.plugin.t("Current note"));
    add.addEventListener("click", () => this.attachCurrentNote());

    this.updateContextBar();
  }

  private buildAttachmentsBar(container: HTMLElement): void {
    this.attachmentsBar = container.createDiv({ cls: "opencode-attachments-bar hidden" });
    this.updateAttachmentsBar();
  }

  private updateAttachmentsBar(): void {
    if (!this.attachmentsBar) return;
    this.attachmentsBar.empty();
    if (this.attachments.length === 0) {
      this.attachmentsBar.addClass("hidden");
      return;
    }
    this.attachmentsBar.removeClass("hidden");
    for (const a of this.attachments) {
      const chip = this.attachmentsBar.createSpan({ cls: "opencode-attachment-chip" });
      const icon = chip.createSpan({ cls: "opencode-attachment-icon" });
      setIcon(icon, a.image ? "image" : "file-text");
      chip.createSpan({ text: a.label, cls: "opencode-attachment-label" });
      const rm = chip.createEl("button", { cls: "opencode-icon-btn" });
      setIcon(rm, "x");
      rm.addEventListener("click", () => {
        this.attachments = this.attachments.filter((x) => x.path !== a.path);
        this.updateAttachmentsBar();
      });
    }
  }

  private openFilePicker(): void {
    new FileSuggestModal(this.app, this.plugin, (file) => this.addAttachment(file.path)).open();
  }

  private addAttachment(path: string): void {
    if (this.attachments.some((a) => a.path === path)) return;
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
    this.attachments.push({ path, label: path, image: isImage });
    this.updateAttachmentsBar();
    if (isImage) {
      new Notice(
        this.plugin.t("Image attached: check that the selected model supports images (vision).")
      );
    }
  }

  private togglePin(): void {
    const id = this.viewSession;
    if (!id) {
      new Notice(this.plugin.t("Select a session to pin."));
      return;
    }
    const pinned = this.plugin.settings.pinned ?? [];
    const idx = pinned.indexOf(id);
    if (idx >= 0) pinned.splice(idx, 1);
    else pinned.push(id);
    this.plugin.settings.pinned = pinned;
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    new Notice(idx >= 0 ? this.plugin.t("Session unpinned.") : this.plugin.t("Session pinned."));
  }

  private renameCurrentSession(): void {
    const id = this.viewSession;
    if (!id) {
      new Notice(this.plugin.t("Select a session to rename."));
      return;
    }
    const current = this.sessionSelect.selectedOptions[0]?.textContent ?? id;
    new RenameModal(this.app, this.plugin, current, (newTitle) => {
      this.getRunner()
        .renameSession(id, newTitle)
        .then(() => {
          void this.populateSessionSelect();
          new Notice(this.plugin.t("Session renamed."));
        })
        .catch((e) => new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`));
    }).open();
  }

  private deleteCurrentSession(): void {
    const id = this.viewSession;
    if (!id) {
      new Notice(this.plugin.t("Select a session to delete."));
      return;
    }
    const title = this.sessionSelect.selectedOptions[0]?.textContent ?? id;
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("Delete session"),
      this.plugin.t('Do you want to delete the session "$1"? The history saved in Obsidian will also be removed.').replace("$1", title),
      this.plugin.t("Delete"),
      () => {
        this.getRunner()
          .deleteSession(id)
          .then(async () => {
            await this.plugin.deleteHistory(id);
            const pinned = this.plugin.settings.pinned ?? [];
            const pi = pinned.indexOf(id);
            if (pi >= 0) pinned.splice(pi, 1);
            this.plugin.settings.pinned = pinned;
            if (this.viewSession === id) {
              this.viewSession = "";
              this.plugin.settings.sessionId = "";
            }
            await this.plugin.saveSettings();
            await this.populateSessionSelect();
            this.loadHistoryForSession(this.viewSession);
            new Notice(this.plugin.t("Session deleted."));
          })
          .catch((e) => new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`));
      }
    ).open();
  }

  private updateContextBar(): void {
    if (this.context) {
      this.contextLabelEl.setText(`${this.plugin.t("Context:")} ${this.context.label}`);
      this.contextLabelEl.show();
      this.contextClearBtn.removeClass("hidden");
    } else {
      this.contextLabelEl.setText("");
      this.contextLabelEl.hide();
      this.contextClearBtn.addClass("hidden");
    }
  }

  private async populateSessionSelect(): Promise<void> {
    const sel = this.sessionSelect;
    sel.empty();
    const newOpt = sel.createEl("option");
    newOpt.value = "";
    newOpt.textContent = "＋ " + this.plugin.t("New session");
    try {
      const [agySess, ocSess] = await Promise.allSettled([
        this.plugin.antigravityRunner.listSessions(),
        this.plugin.opencodeRunner.listSessions(),
      ]);
      const all: SessionInfo[] = [];
      const seen = new Set<string>();
      const add = (arr: SessionInfo[], engine: "antigravity" | "opencode") => {
        for (const s of arr) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            all.push({ ...s, engine: s.engine || engine });
            if (!this.plugin.settings.sessionEngines) this.plugin.settings.sessionEngines = {};
            if (!this.plugin.settings.sessionEngines[s.id]) {
              this.plugin.settings.sessionEngines[s.id] = s.engine || engine;
            }
          }
        }
      };
      if (agySess.status === "fulfilled") add(agySess.value, "antigravity");
      if (ocSess.status === "fulfilled") add(ocSess.value, "opencode");
      all.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
      const pinnedSet = new Set(this.plugin.settings.pinned ?? []);
      const pinned = all.filter((s) => pinnedSet.has(s.id));
      const recent = all.filter((s) => !pinnedSet.has(s.id)).slice(0, 15);
      for (const s of [...pinned, ...recent]) {
        const o = sel.createEl("option");
        o.value = s.id;
        const title = s.title || s.id;
        const mark = pinnedSet.has(s.id) ? "● " : "";
        o.textContent = mark + (title.length > 40 ? title.slice(0, 37) + "⬦" : title);
        o.title = title;
      }
    } catch {
      // Keep only "New session"
    }
    sel.value = this.viewSession || "";
    this.updateSessionBtnStates();
  }

  private updateSessionBtnStates(): void {
    const hasSession = !!this.viewSession;
    this.renameBtn.disabled = !hasSession;
    this.deleteBtn.disabled = !hasSession;
    this.pinBtn.disabled = !hasSession;
    const pinned = (this.plugin.settings.pinned ?? []).includes(this.viewSession);
    this.pinBtn.toggleClass("is-active", pinned);
  }

  private buildStatsBar(container: HTMLElement): void {
    this.statsBar = container.createDiv({ cls: "opencode-stats-bar" });
    const ctx = this.statsBar.createSpan({ cls: "opencode-context" });
    const track = ctx.createSpan({ cls: "opencode-context-track" });
    this.contextFillEl = track.createSpan({ cls: "opencode-context-fill" });
    this.contextEl = ctx.createSpan({ cls: "opencode-context-text" });
    this.updateContextUsage();
    this.updateStatsBar();
  }

  private updateStatsBar(): void {
    if (!this.statsBar) return;
    const existing = this.statsBar.querySelector(".opencode-stats-text");
    if (existing) existing.remove();
    this.statsBar.createSpan({
      text: this.fmtTokens(this.stats.total, this.stats.input, this.stats.output, this.stats.cost),
      cls: "opencode-stats-text",
    });
  }

  private updateContextUsage(): void {
    if (!this.contextEl) return;
    const used = this.contextUsed;
    const limit = this.contextLimit;
    if (!limit) {
      this.contextEl.setText(this.plugin.t("Context:") + " —");
      this.contextFillEl.style.width = "0%";
      return;
    }
    const pct = Math.min(100, Math.round((used / limit) * 100));
    this.contextFillEl.style.width = pct + "%";
    this.contextEl.setText(
      `${this.plugin.t("Context:")} ${pct}% (${Math.round(used / 1000)}K / ${Math.round(limit / 1000)}K)`
    );
  }

  private async refreshContext(): Promise<void> {
    const sid = this.viewSession;
    if (!sid) {
      this.contextUsed = 0;
      this.contextLimit = 0;
      this.updateContextUsage();
      return;
    }
    try {
      const tokens = await this.getRunner().getSessionTokens(sid);
      this.contextBaseInput = tokens.input;
      this.contextUsed = tokens.input;
      if (!this.contextLimit) {
        const isAgy = this.getRunner().engine === "antigravity";
        const m = isAgy
          ? (this.plugin.settings.antigravityModel || "gemini-3.8-flash-high")
          : (this.plugin.settings.model || DEFAULT_SETTINGS.model);
        this.contextLimit = await this.getRunner().getModelContextLimit(m);
      }
    } catch (e) {
      console.error("[opencode-vault] refreshContext error:", e);
    }
    this.updateContextUsage();
  }

  private addStats(info: FinishInfo): void {
    if (info.tokens) {
      this.stats.input += info.tokens.input ?? 0;
      this.stats.output += info.tokens.output ?? 0;
      this.stats.total += info.tokens.total ?? 0;
    }
    this.stats.cost += info.cost ?? 0;
    this.updateStatsBar();
  }

  private resetStats(): void {
    this.stats = { input: 0, output: 0, total: 0, cost: 0 };
    this.updateStatsBar();
  }

  private async attachCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice(this.plugin.t("No active note"));
      return;
    }
    const content = await this.app.vault.cachedRead(file);
    this.context = { label: file.path, content };
    this.updateContextBar();
    new Notice(this.plugin.t("Note added to context."));
  }

  private buildInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "opencode-input-area" });

    this.suggestEl = inputArea.createDiv({ cls: "opencode-suggest hidden" });

    this.inputEl = inputArea.createEl("textarea", {
      cls: "opencode-input",
      attr: {
        placeholder:
          this.plugin.t("Type a message for the agent... (Enter to send, Shift+Enter for a new line)"),
      },
    });
    this.inputEl.addEventListener("keydown", (e) => this.onInputKeydown(e));
    this.inputEl.addEventListener("input", () => this.onInputChange());

    const buttons = inputArea.createDiv({ cls: "opencode-buttons" });

    this.modelBtn = buttons.createEl("button", { cls: "opencode-model-btn" });
    this.updateModelBtn();
    this.modelBtn.addEventListener("click", () => this.openModelList());

    buttons.createSpan({ cls: "opencode-buttons-spacer" });

    this.sendBtn = buttons.createEl("button", { cls: "opencode-send-btn" });
    this.sendBtn.setText(this.plugin.t("Send"));
    this.sendBtn.addEventListener("click", () => this.send());

    this.stopBtn = buttons.createEl("button", { cls: "opencode-stop-btn" });
    this.stopBtn.setText(this.plugin.t("Stop"));
    this.stopBtn.addClass("hidden");
    this.stopBtn.addEventListener("click", () => {
      this.stoppedByUser = true;
      this.currentProc?.abort();
      // Fallback: if the process does not terminate cleanly (hung process),
      // release the UI anyway so the chat is not stuck forever.
      window.setTimeout(() => {
        if (!this.running) return;
        this.currentProc?.abort();
        this.running = false;
        this.pendingUser = null;
        if (this.activityTimer !== null) {
          clearInterval(this.activityTimer);
          this.activityTimer = null;
        }
        this.setRunningUI(false);
      }, 3000);
    });
  }

  private updateModelBtn(): void {
    if (!this.modelBtn) return;
    const isAgy = this.getRunner().engine === "antigravity";
    const m = isAgy
      ? (this.plugin.settings.antigravityModel || "gemini-3.8-flash-high")
      : (this.plugin.settings.model || DEFAULT_SETTINGS.model);
    this.modelBtn.setText(m.length > 30 ? m.slice(0, 27) + "⬦" : m);
    this.modelBtn.setAttribute(
      "title",
      isAgy ? `${m} (Google AI Pro)` : `${m} (OpenCode)`
    );
  }

  private async openModelList(): Promise<void> {
    const isAgyActive = this.getRunner().engine === "antigravity";
    const cur = isAgyActive
      ? (this.plugin.settings.antigravityModel || "gemini-3.8-flash-high")
      : (this.plugin.settings.model || DEFAULT_SETTINGS.model);

    try {
      const [agyRes, ocRes] = await Promise.allSettled([
        this.plugin.antigravityRunner.listModels(),
        this.plugin.opencodeRunner.listModels(),
      ]);

      const agyModels = agyRes.status === "fulfilled" ? agyRes.value : [];
      const ocModels = ocRes.status === "fulfilled" ? ocRes.value : [];

      const items: ModelItem[] = [];

      // Prioritize active engine models at the top
      if (isAgyActive) {
        for (const m of agyModels) {
          items.push({
            id: m,
            engine: "antigravity",
            provider: "Google AI Pro",
            isActive: m === cur,
          });
        }
        for (const m of ocModels) {
          items.push({
            id: m,
            engine: "opencode",
            provider: "OpenCode",
            isActive: false,
          });
        }
      } else {
        for (const m of ocModels) {
          items.push({
            id: m,
            engine: "opencode",
            provider: "OpenCode",
            isActive: m === cur,
          });
        }
        for (const m of agyModels) {
          items.push({
            id: m,
            engine: "antigravity",
            provider: "Google AI Pro",
            isActive: false,
          });
        }
      }

      new ModelSuggestModal(this.app, this.plugin, items, (item) => {
        this.plugin.settings.engine = item.engine;
        if (item.engine === "antigravity") {
          this.plugin.settings.antigravityModel = item.id;
          this.plugin.settings.model = item.id;
        } else {
          this.plugin.settings.model = item.id;
        }
        if (this.viewSession) {
          if (!this.plugin.settings.sessionEngines) this.plugin.settings.sessionEngines = {};
          this.plugin.settings.sessionEngines[this.viewSession] = item.engine;
        }
        void this.plugin.saveSettings();
        this.updateModelBtn();
        this.contextLimit = 0;
        void this.refreshContext();
        new Notice(`${this.plugin.t("Model set:")} ${item.id} (${item.provider})`);
      }).open();
    } catch (e) {
      new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`);
    }
  }

  private startNewSession(): void {
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    this.loadHistoryForSession("");
    new Notice(this.plugin.t("New session: the next message will start from scratch."));
  }

  continueInNewSession(): void {
    if (this.running) {
      new Notice(this.plugin.t("There is already a request in progress."));
      return;
    }
    const oldSession = this.viewSession;
    if (!oldSession) {
      new Notice(this.plugin.t("Select first the session to summarize."));
      return;
    }

    const bubble = this.addAssistantMessage();
    bubble.status.setText(this.plugin.t("Generating session summary..."));

    this.running = true;
    this.hadStreamError = false;
    this.stoppedByUser = false;
    this.lastStderr = "";
    this.setRunningUI(true);

    const summaryPrompt =
      this.plugin.t("Summarize in detail this conversation: goals, decisions made, work done, current state and next steps. Write the summary so the work can continue in a new session without losing context.");
    const proc = this.getRunner().runStream(summaryPrompt, [], {
      onSession: () => {},
      onRaw: (chunk) => {
        this.lastStderr += chunk;
      },
      onText: (text) => {
        bubble.setText(text);
        if (bubble.status.getText() !== "") bubble.status.setText("");
      },
      onReasoning: (text) => bubble.setReasoning(text),
      onStep: (step) => {
        bubble.addStep(step);
        bubble.status.setText("");
      },
      onFinish: (info) => {
        this.addStats(info);
        bubble.setFinish(info);
      },
      onError: (msg) => {
        this.hadStreamError = true;
        bubble.finalize();
        this.addErrorBubble(this.friendlyError(msg));
      },
      onDone: (code) => {
        const isCurrent = this.currentProc === proc;
        if (isCurrent) this.currentProc = null;
        bubble.finalize();
        if (!isCurrent) return;
        this.running = false;
        this.setRunningUI(false);
        const failed = code !== 0 || this.hadStreamError;
        if (failed && !this.stoppedByUser) {
          if (!this.hadStreamError) {
            const detail = this.lastStderr.trim().replace(/\s+/g, " ").slice(0, 300);
            const base = `${this.plugin.t("The session summary could not be generated.")} (${code}).`;
            this.addErrorBubble(detail ? `${base} ${detail}` : base);
          }
          this.finishContinuation(
            this.buildLocalContinuation(oldSession),
            this.plugin.t("Session at the limit: new session created with the recent history.")
          );
          return;
        }
        const summary = bubble.getSnapshot().text.trim();
        const prompt = summary
          ? this.plugin.t("[SUMMARY OF THE PREVIOUS SESSION]") + "\n" + summary + "\n\n---\n\n" + this.plugin.t("Continue the work from here.")
          : this.plugin.t("Continue the work from the previous session.");
        this.finishContinuation(
          prompt,
          this.plugin.t("New session created with the summary of the previous one.")
        );
      },
    });
    this.currentProc = proc;
  }

  private finishContinuation(prompt: string, notice: string): void {
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    this.loadHistoryForSession("");
    this.inputEl.value = prompt;
    this.inputEl.focus();
    new Notice(notice);
  }

  private buildLocalContinuation(sessionId: string): string {
    const history = this.plugin.getHistory(sessionId);
    const recent = history.slice(-24);
    if (recent.length === 0) {
      return this.plugin.t("The previous session has no saved history. Continue the work from here.");
    }
    const lines: string[] = [];
    for (const rec of recent) {
      const who = rec.role === "user" ? this.plugin.t("User") : "Opencode";
      const text = rec.text.length > 800 ? rec.text.slice(0, 800) + "⬦" : rec.text;
      lines.push(`${who}: ${text}`);
    }
    return (
      this.plugin.t("[RECENT HISTORY OF THE PREVIOUS SESSION]") + "\n" + lines.join(
        "\n\n"
      ) + "\n\n---\n\n" + this.plugin.t("Continue the work from here, keeping the context above in mind.")
    );
  }

  // ===== Commands / @ ! =====

  private onInputKeydown(e: KeyboardEvent): void {
    if (this.suggestOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.suggestIndex = Math.min(this.suggestIndex + 1, this.suggestItems.length - 1);
        this.highlightSuggest();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.suggestIndex = Math.max(this.suggestIndex - 1, 0);
        this.highlightSuggest();
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        this.chooseSuggest(this.suggestIndex);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeSuggest();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  }

  private onInputChange(): void {
    if (this.suggestOpen && !this.suggestTrigger) {
      this.closeSuggest();
    }
    const tr = this.detectTrigger();
    if (!tr) {
      this.closeSuggest();
      return;
    }
    const items = this.buildSuggestItems(tr.char, tr.query);
    if (items.length === 0) {
      this.closeSuggest();
      return;
    }
    this.suggestTrigger = { char: tr.char, start: tr.start };
    this.suggestItems = items;
    this.suggestIndex = 0;
    this.suggestOpen = true;
    this.renderSuggest();
  }

  private detectTrigger(): { char: string; start: number; query: string } | null {
    const v = this.inputEl.value;
    const pos = this.inputEl.selectionStart ?? v.length;
    let i = pos - 1;
    while (i >= 0 && !/\s/.test(v[i])) i--;
    const start = i + 1;
    const token = v.slice(start, pos);
    if (!token) return null;
    const ch = token[0];
    if (ch !== "/" && ch !== "@" && ch !== "!") return null;
    return { char: ch, start, query: token.slice(1).toLowerCase() };
  }

  private buildSuggestItems(char: string, query: string): SuggestItem[] {
    const q = query.toLowerCase();
    if (char === "/") {
      if (q.startsWith("prompt")) return this.promptItems(query.slice(6));
      return this.filterItems(this.commandItems(), q);
    }
    if (char === "@") {
      return this.fileItems(query);
    }
    return this.filterItems(this.actionItems(), q);
  }

  private filterItems(items: SuggestItem[], q: string): SuggestItem[] {
    if (!q) return items;
    return items.filter(
      (x) => x.label.toLowerCase().includes(q) || (x.desc ?? "").toLowerCase().includes(q)
    );
  }

  // /prompt: pick a saved prompt template; its text is inserted into the composer.
  private promptItems(sub: string): SuggestItem[] {
    const prompts = this.plugin.settings.prompts ?? [];
    if (prompts.length === 0) {
      return [
        {
          label: "/prompt",
          desc: this.plugin.t("No saved prompts — add them in Settings"),
          action: () => this.removeTrigger(),
        },
      ];
    }
    const q = sub.trim().toLowerCase();
    const list = q ? prompts.filter((p) => p.name.toLowerCase().includes(q)) : prompts;
    return list.map((p) => ({
      label: p.name,
      desc: p.text.length > 80 ? p.text.slice(0, 77) + "…" : p.text,
      action: () => this.insertPromptText(p.text),
    }));
  }

  private insertPromptText(text: string): void {
    const tr = this.suggestTrigger;
    if (tr) {
      const v = this.inputEl.value;
      const end = this.inputEl.selectionStart ?? v.length;
      this.inputEl.value = v.slice(0, tr.start) + text + v.slice(end);
      const pos = tr.start + text.length;
      this.inputEl.setSelectionRange(pos, pos);
    }
    this.closeSuggest();
    this.inputEl.focus();
  }

  private startPromptSelection(): void {
    this.closeSuggest();
    this.inputEl.value = "/prompt";
    this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
    this.inputEl.focus();
    this.onInputChange();
  }

  private commandItems(): SuggestItem[] {
    return [
      {
        label: this.plugin.t("/model"),
        desc: this.plugin.t("Change the model"),
        action: () => {
          this.removeTrigger();
          this.openModelList();
        },
      },
      {
        label: this.plugin.t("/new"),
        desc: this.plugin.t("New session"),
        action: () => {
          this.removeTrigger();
          this.startNewSession();
        },
      },
      {
        label: this.plugin.t("/note"),
        desc: this.plugin.t("Attach the current note"),
        action: () => {
          this.removeTrigger();
          void this.attachCurrentNote();
        },
      },
      {
        label: this.plugin.t("/attach"),
        desc: this.plugin.t("Attach a file"),
        action: () => {
          this.removeTrigger();
          this.openFilePicker();
        },
      },
      {
        label: this.plugin.t("/stats"),
        desc: this.plugin.t("Token and cost statistics"),
        action: () => {
          this.removeTrigger();
          new StatsModal(this.app, this.plugin).open();
        },
      },
      {
        label: "/pin",
        desc: this.plugin.t("Pin/Unpin session"),
        action: () => {
          this.removeTrigger();
          this.togglePin();
        },
      },
      {
        label: this.plugin.t("/rename"),
        desc: this.plugin.t("Rename session"),
        action: () => {
          this.removeTrigger();
          this.renameCurrentSession();
        },
      },
      {
        label: this.plugin.t("/prompt"),
        desc: this.plugin.t("Insert a saved prompt"),
        action: () => {
          this.removeTrigger();
          this.startPromptSelection();
        },
      },
    ];
  }

  private fileItems(query: string): SuggestItem[] {
    if (!this.vaultPaths) {
      this.vaultPaths = this.app.vault
        .getFiles()
        .map((f) => f.path)
        .sort((a, b) => a.localeCompare(b));
      this.vaultPathsLower = this.vaultPaths.map((p) => p.toLowerCase());
    }
    const paths = this.vaultPaths;
    const lower = this.vaultPathsLower ?? [];
    const q = query.toLowerCase();
    const desc = this.plugin.t("Attached");
    const items: SuggestItem[] = [];
    // Filter on the (precomputed lowercase) paths first and build SuggestItem
    // objects only for the capped result, instead of allocating one per file in
    // the vault on every keystroke.
    for (let i = 0; i < paths.length && items.length < MAX_SUGGEST; i++) {
      if (q && !lower[i].includes(q)) continue;
      const p = paths[i];
      items.push({
        label: p,
        desc,
        action: () => {
          this.removeTrigger();
          this.addAttachment(p);
        },
      });
    }
    return items;
  }

  private actionItems(): SuggestItem[] {
    return [
      {
        label: this.plugin.t("current note"),
        desc: this.plugin.t("Attach the open note as context"),
        action: () => {
          this.removeTrigger();
          void this.attachCurrentNote();
        },
      },
      {
        label: this.plugin.t("attach file"),
        desc: this.plugin.t("Pick a file to attach"),
        action: () => {
          this.removeTrigger();
          this.openFilePicker();
        },
      },
      {
        label: this.plugin.t("new session"),
        desc: this.plugin.t("Start from an empty session"),
        action: () => {
          this.removeTrigger();
          this.startNewSession();
        },
      },
      {
        label: this.plugin.t("statistics"),
        desc: this.plugin.t("Tokens and costs (5h, week, month)"),
        action: () => {
          this.removeTrigger();
          new StatsModal(this.app, this.plugin).open();
        },
      },
      {
        label: this.plugin.t("pin/unpin session"),
        desc: this.plugin.t("Pin the session in the list"),
        action: () => {
          this.removeTrigger();
          this.togglePin();
        },
      },
    ];
  }

  private renderSuggest(): void {
    this.suggestEl.empty();
    this.suggestEl.removeClass("hidden");
    this.suggestRows = [];
    this.suggestItems.forEach((item, i) => {
      const row = this.suggestEl.createDiv({
        cls: "opencode-suggest-item" + (i === this.suggestIndex ? " is-active" : ""),
      });
      row.createDiv({ cls: "opencode-suggest-label", text: item.label });
      if (item.desc) row.createDiv({ cls: "opencode-suggest-desc", text: item.desc });
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.chooseSuggest(i);
      });
      row.addEventListener("mouseenter", () => {
        this.suggestIndex = i;
        this.highlightSuggest();
      });
      this.suggestRows.push(row);
    });
  }

  private highlightSuggest(): void {
    this.suggestRows.forEach((row, i) =>
      row.toggleClass("is-active", i === this.suggestIndex)
    );
  }

  private closeSuggest(): void {
    this.suggestTrigger = null;
    this.suggestOpen = false;
    this.suggestItems = [];
    this.suggestEl?.addClass("hidden");
    this.suggestEl?.empty();
  }

  private chooseSuggest(index: number): void {
    const item = this.suggestItems[index];
    if (item) item.action();
  }

  private removeTrigger(): void {
    const tr = this.suggestTrigger;
    if (!tr) return;
    const v = this.inputEl.value;
    const end = this.inputEl.selectionStart ?? v.length;
    this.inputEl.value = v.slice(0, tr.start) + v.slice(end);
    const pos = Math.min(tr.start, this.inputEl.value.length);
    this.inputEl.setSelectionRange(pos, pos);
    this.closeSuggest();
    this.inputEl.focus();
  }

  private addWelcome(): void {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant",
    });
    const text =
      this.plugin.t("Hi! I am Vault Agents, connecting AI agents directly to your notes. Write a message below. Try the commands: / for commands, @ to attach a file, ! for quick actions.");
    this.metaWithCopy(row, this.assistantLabel(), () => text);
    row.createDiv({ text, cls: "opencode-bubble" });
  }

  private async send(): Promise<void> {
    const raw = this.inputEl.value.trim();
    if (!raw || this.running || this.dispatching) return;

    let prompt = raw;
    const ctxLabel = this.context?.label;
    if (this.context) {
      prompt =
        `[CONTEXT FROM OBSIDIAN - ${this.context.label}]\n${this.context.content}\n\n---\n\n` + raw;
      this.context = null;
      this.updateContextBar();
    }

    this.addUserMessage(raw, ctxLabel);
    this.inputEl.value = "";

    this.pendingUser = { text: raw, contextLabel: ctxLabel };
    const currentSession = this.viewSession;
    if (currentSession) {
      void this.plugin.appendHistory(currentSession, {
        role: "user",
        text: raw,
        contextLabel: ctxLabel,
      });
      this.pendingUser = null;
    }

    this.dispatching = true;
    try {
      const filePaths = await this.prepareAttachments();
      this.dispatching = false;
      this.doRun(prompt, filePaths);
    } catch (e) {
      this.dispatching = false;
      new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`);
    }
  }

  // Convert document attachments (PDF, Word, Excel, ...) to Markdown via anydoc
  // before sending, so any model can read them regardless of image/format support.
  private async prepareAttachments(): Promise<string[]> {
    const useAnydoc = this.plugin.settings.anydocEnabled;
    // Convert in parallel: with several attachments, serial conversions made
    // the send wait for the sum of every conversion.
    const resolved = await Promise.all(
      this.attachments.map((a) => this.resolveAttachment(a.path, useAnydoc))
    );
    return resolved.filter((p): p is string => p !== null);
  }

  // Returns the path to attach, or null if the attachment must be skipped.
  private async resolveAttachment(path: string, useAnydoc: boolean): Promise<string | null> {
    const abs = this.toAbsolutePath(path);
    if (!(useAnydoc && this.isDocument(path))) return abs;
    try {
      return await this.getRunner().convertDocument(abs);
    } catch (e) {
      new Notice(`${this.plugin.t("anydoc conversion failed")}: ${(e as Error).message}`);
      // If the original file is huge, attaching it raw would store an
      // unusable base64 copy in the opencode database. Skip it instead.
      const maxMB = this.plugin.settings.maxAttachMB || 20;
      const size = await this.fileSize(path);
      if (size !== null && size > maxMB * 1024 * 1024) {
        new Notice(
          substitute(
            this.plugin.t("Attachment skipped: the file is larger than $1 MB and could not be converted, so it was not attached."),
            maxMB
          )
        );
        return null;
      }
      return abs;
    }
  }

  private isDocument(p: string): boolean {
    return /\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|rtf|epub|csv)$/i.test(p);
  }

  private async fileSize(vaultPath: string): Promise<number | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(vaultPath);
      return file instanceof TFile ? file.stat.size : null;
    } catch {
      return null;
    }
  }

  private toAbsolutePath(vaultPath: string): string {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      // Use the native path separators for Windows/macOS/Linux compatibility
      const sep = process.platform === "win32" ? "\\" : "/";
      return `${adapter.getBasePath()}${sep}${vaultPath.split("/").join(sep)}`;
    }
    return vaultPath;
  }

  private friendlyError(msg: string): string {
    if (
      /does not support image input|image input is not supported|images? are not supported/i.test(
        msg
      )
    ) {
      return this.plugin.t("The selected model does not support images. Remove the attached image or choose a multimodal (vision) model from the Model menu.");
    }
    return msg;
  }

  // A saved session can disappear (deleted from another client). Clear it and
  // ask the user to resend; returns true when the message was handled here.
  private handleSessionNotFound(text: string): boolean {
    if (!this.viewSession || !/session not found/i.test(text)) return false;
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    this.addErrorBubble(
      this.plugin.t("The saved session no longer exists: a new one will be created, resend the message.")
    );
    return true;
  }

  private doRun(prompt: string, filePaths: string[] = []): void {
    const bubble = this.addAssistantMessage();
    bubble.status.setText(this.plugin.t("Starting..."));

    this.running = true;
    this.hadStreamError = false;
    this.stoppedByUser = false;
    this.lastStderr = "";
    this.setRunningUI(true);

    // Activity indicator: shows how many events are arriving and how long it
    // has been since the last one, so it is easy to tell whether the model is
    // still working or actually stuck.
    let eventCount = 0;
    let lastEventAt = Date.now();
    this.contextRunInput = 0;
    void this.refreshContext();
    const touch = () => {
      eventCount++;
      lastEventAt = Date.now();
    };
    const updateActivity = () => {
      const since = Date.now() - lastEventAt;
      const secs = Math.round(since / 1000);
      if (since < 4000) {
        bubble.status.setText(`… ${eventCount} ${this.plugin.t("events")}`);
      } else if (since < 30000) {
        bubble.status.setText(
          `… ${eventCount} ${this.plugin.t("events")} · ${substitute(this.plugin.t("last update $1s ago"), secs)}`
        );
      } else {
        bubble.status.setText(
          `⚠ ${this.plugin.t("Possibly stuck")} · ${substitute(this.plugin.t("last update $1s ago"), secs)}`
        );
      }
    };
    this.activityTimer = window.setInterval(updateActivity, 1500);

    const runner = this.getRunner();
    const proc = runner.runStream(prompt, filePaths, {
      onSession: (sid) => {
        if (sid && sid !== this.viewSession) {
          this.viewSession = sid;
          this.plugin.settings.sessionId = sid;
          if (!this.plugin.settings.sessionEngines) this.plugin.settings.sessionEngines = {};
          this.plugin.settings.sessionEngines[sid] = runner.engine;
          void this.plugin.saveSettings();
          void this.refreshContext();
          if (this.pendingUser) {
            void this.plugin.appendHistory(sid, {
              role: "user",
              text: this.pendingUser.text,
              contextLabel: this.pendingUser.contextLabel,
            });
            this.pendingUser = null;
          }
        }
      },
      onRaw: (chunk) => {
        this.lastStderr += chunk;
      },
      onText: (text) => {
        if (/does not support image input|image input is not supported/i.test(text)) {
          this.hadStreamError = true;
          bubble.finalize();
          this.addErrorBubble(this.friendlyError(text));
          return;
        }
        bubble.setText(text);
        touch();
      },
      onReasoning: (text) => {
        bubble.setReasoning(text);
        touch();
      },
      onStep: (step) => {
        bubble.addStep(step);
        touch();
      },
      onFinish: (info) => {
        this.addStats(info);
        bubble.setFinish(info);
        if (info.tokens?.input) {
          this.contextRunInput += info.tokens.input;
          this.contextUsed = this.contextBaseInput + this.contextRunInput;
          this.updateContextUsage();
        }
        touch();
      },
      onError: (msg) => {
        this.hadStreamError = true;
        bubble.finalize();
        if (!this.handleSessionNotFound(msg)) {
          this.addErrorBubble(this.friendlyError(msg));
        }
      },
      onDone: (code) => {
        if (this.activityTimer !== null) {
          clearInterval(this.activityTimer);
          this.activityTimer = null;
        }
        const isCurrent = this.currentProc === proc;
        if (isCurrent) this.currentProc = null;
        bubble.finalize();
        const snap = bubble.getSnapshot();
        const sid = this.viewSession;
        if (sid && (snap.text.trim() || snap.reasoning.trim())) {
          void this.plugin.appendHistory(sid, {
            role: "assistant",
            text: snap.text,
            reasoning: snap.reasoning || undefined,
            tokens: snap.tokens,
            cost: snap.cost,
          });
        }
        if (!isCurrent) return;
        this.pendingUser = null;
        if (code !== 0 && !this.hadStreamError && !this.stoppedByUser) {
          if (!this.handleSessionNotFound(this.lastStderr)) {
            const detail = this.lastStderr.trim().replace(/\s+/g, " ").slice(0, 300);
            const base = substitute(
              this.plugin.t(
                "The opencode process exited with code $1. Check the binary path and the model in the settings."
              ),
              code
            );
            this.addErrorBubble(this.friendlyError(detail ? `${base} ${detail}` : base));
          }
        }
        this.running = false;
        this.setRunningUI(false);
        void this.populateSessionSelect();
        void this.refreshContext();
      },
    });
    this.currentProc = proc;
  }

  private addUserMessage(text: string, ctxLabel?: string): void {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--user",
    });
    this.metaWithCopy(row, this.plugin.t("You"), () => text);
    if (ctxLabel) {
      row.createDiv({ cls: "opencode-context-hint", text: `${this.plugin.t("with context:")} ${ctxLabel}` });
    }
    row.createDiv({ cls: "opencode-bubble", text });
    this.scrollToBottom();
  }

  private addAssistantMessage(): AssistantBubble {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant",
    });
    const bubble = new AssistantBubble(row, this.app, this);
    this.activeBubble = bubble;
    this.scrollToBottom();
    return bubble;
  }

  private addErrorBubble(msg: string): void {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--error",
    });
    this.metaWithCopy(row, this.plugin.t("Error"), () => msg);
    row.createDiv({ cls: "opencode-bubble", text: msg });
    this.scrollToBottom();
  }

  metaWithCopy(row: HTMLElement, label: string, getText: () => string): void {
    const meta = row.createDiv({ cls: "opencode-meta" });
    meta.createSpan({ text: label });
    meta.createSpan({ cls: "opencode-meta-spacer" });
    const btn = meta.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Copy text") },
    });
    setIcon(btn, "copy");
    btn.addEventListener("click", () => this.copyText(getText()));
  }

  private async copyText(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    new Notice(this.plugin.t("Text copied."));
  }

  // Format the token/cost statistics line according to the selected language.
  fmtTokens(total: number, input: number, output: number, cost: number): string {
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const isAgy = this.getRunner().engine === "antigravity";
    const costStr = isAgy ? "Google AI Pro" : `${cost.toFixed(4)} $`;
    return `${this.plugin.t("Token:")} ${total.toLocaleString(locale)} (${this.plugin.t("in")} ${input.toLocaleString(locale)} · ${this.plugin.t("out")} ${output.toLocaleString(locale)}) · ${this.plugin.t("Cost:")} ${costStr}`;
  }

  private setRunningUI(running: boolean): void {
    this.sendBtn.disabled = running;
    this.sendBtn.setText(running ? "..." : this.plugin.t("Send"));
    this.stopBtn.toggleClass("hidden", !running);
    this.sessionSelect.disabled = running;
    this.updateSessionBtnStates();
    if (running) {
      this.pinBtn.disabled = true;
      this.renameBtn.disabled = true;
      this.deleteBtn.disabled = true;
    }
  }

  private loadHistoryForSession(sessionId: string): void {
    this.messagesEl.empty();
    this.resetStats();
    this.contextRunInput = 0;
    this.contextUsed = 0;
    this.contextLimit = 0;
    this.updateContextUsage();
    void this.refreshContext();
    const history = this.plugin.getHistory(sessionId);
    if (history.length === 0) {
      this.addWelcome();
    } else {
      for (const rec of history) {
        if (rec.role === "user") {
          this.addUserMessage(rec.text, rec.contextLabel);
        } else {
          this.renderHistoryAssistant(rec);
        }
      }
    }
    this.scrollToBottom();
  }

  private renderHistoryAssistant(rec: HistoryAssistant): void {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant",
    });
    this.metaWithCopy(row, this.assistantLabel(), () => rec.text);
    if (rec.reasoning && rec.reasoning.trim()) {
      const det = row.createEl("details", { cls: "opencode-reasoning" });
      det.createEl("summary").setText(this.plugin.t("Reasoning"));
      det.createDiv({ cls: "opencode-reasoning-content", text: rec.reasoning });
    }
    const content = row.createDiv({ cls: "opencode-bubble opencode-bubble--assistant" });
    if (rec.text.trim()) {
      MarkdownRenderer.render(this.app, rec.text, content, "", this).then(() =>
        this.scrollToBottom()
      );
    }
    if (rec.tokens || rec.cost !== undefined) {
      const total =
        rec.tokens?.total ??
        (rec.tokens ? (rec.tokens.input ?? 0) + (rec.tokens.output ?? 0) : 0);
      const inp = rec.tokens?.input ?? 0;
      const out = rec.tokens?.output ?? 0;
      const cost = rec.cost ?? 0;
      row.createDiv({
        cls: "opencode-msg-stats",
        text: this.fmtTokens(total, inp, out, cost),
      });
    }
  }

  scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  scheduleScroll(): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.scrollToBottom(), 150);
  }
}

class AssistantBubble {
  private reasoningEl: HTMLDetailsElement;
  private reasoningContent: HTMLElement;
  private stepsEl: HTMLElement;
  private steps = new Map<string, { row: HTMLElement; icon: HTMLElement; status: string }>();
  private contentEl: HTMLElement;
  private statsEl: HTMLElement;
  status: HTMLElement;
  private rawText = "";
  private rawReasoning = "";
  private lastTokens?: { total?: number; input?: number; output?: number };
  private lastCost?: number;
  private renderTimer: number | null = null;
  private reasoningTimer: number | null = null;

  constructor(
    private row: HTMLElement,
    private app: App,
    private view: ChatView
) {
    this.view.metaWithCopy(this.row, this.view.assistantLabel(), () => this.rawText);
    this.reasoningEl = this.row.createEl("details", { cls: "opencode-reasoning hidden" });
    const summary = this.reasoningEl.createEl("summary");
    summary.setText(this.view.plugin.t("Reasoning"));
    this.reasoningContent = this.reasoningEl.createDiv({ cls: "opencode-reasoning-content" });

    this.stepsEl = this.row.createDiv({ cls: "opencode-steps" });
    this.contentEl = this.row.createDiv({ cls: "opencode-bubble opencode-bubble--assistant" });
    this.statsEl = this.row.createDiv({ cls: "opencode-msg-stats hidden" });
    this.status = this.row.createDiv({ cls: "opencode-status" });
  }

  setText(text: string): void {
    this.rawText = text;
    // Below 30k chars the streaming markdown rendering is used
    // (as in the original behavior). Above that threshold re-rendering
    // markdown would be O(n²) and freeze the UI: we fall back to raw text.
    if (text.length <= 30000) {
      this.scheduleRender();
    } else {
      if (this.renderTimer !== null) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
      this.contentEl.empty();
      this.contentEl.textContent = text;
    }
    this.view.scheduleScroll();
  }

  private scheduleRender(): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.flushRender(), 120);
  }

  private flushRender(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.rawText.length > 30000) {
      this.contentEl.empty();
      this.contentEl.textContent = this.rawText;
      return;
    }
    this.contentEl.empty();
    if (this.rawText.trim()) {
      MarkdownRenderer.render(this.app, this.rawText, this.contentEl, "", this.view);
    }
  }

  setReasoning(text: string): void {
    this.rawReasoning = text;
    this.reasoningEl.removeClass("hidden");
    // Reasoning blocks can grow very large and arrive frequently: updating the
    // DOM on every event would saturate the main thread and freeze the UI (the
    // Stop button included). Throttle and cap the rendered text.
    this.scheduleReasoningRender();
    this.view.scheduleScroll();
  }

  private scheduleReasoningRender(): void {
    if (this.reasoningTimer !== null) clearTimeout(this.reasoningTimer);
    this.reasoningTimer = window.setTimeout(() => this.flushReasoningRender(), 120);
  }

  private flushReasoningRender(): void {
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
    const MAX = 50000;
    const shown =
      this.rawReasoning.length > MAX
        ? "… " + this.rawReasoning.slice(this.rawReasoning.length - MAX)
        : this.rawReasoning;
    this.reasoningContent.textContent = shown;
  }

  addStep(step: StepInfo): void {
    const showIO = this.view.plugin.settings.showToolIO;
    const existing = this.steps.get(step.id);

    if (step.state === "running") {
      if (existing) return;
      const row = this.stepsEl.createDiv({ cls: "opencode-step opencode-step--running" });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      icon.createDiv({ cls: "opencode-step-spinner" });
      const main = row.createDiv({ cls: "opencode-step-main" });
      const title = main.createDiv({ cls: "opencode-step-title" });
      title.setText(`${step.tool}: ${this.stepTitle(step)}`);
      if (showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, { row, icon, status: "running" });
      this.view.scheduleScroll();
      return;
    }

    const rec = existing;
    if (rec) {
      rec.status = step.state;
      rec.row.removeClass("opencode-step--running");
      rec.row.addClass(step.state === "error" ? "opencode-step--error" : "opencode-step--done");
      rec.icon.empty();
      setIcon(rec.icon, step.state === "error" ? "x" : "check");
      if (showIO) {
        const details = rec.row.querySelector("details");
        if (details) {
          const pre = details.querySelector("pre");
          if (pre) pre.setText(this.serializeStep(step));
        }
      }
    } else {
      const row = this.stepsEl.createDiv({
        cls: `opencode-step ${step.state === "error" ? "opencode-step--error" : "opencode-step--done"}`,
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      setIcon(icon, step.state === "error" ? "x" : "check");
      const main = row.createDiv({ cls: "opencode-step-main" });
      const title = main.createDiv({ cls: "opencode-step-title" });
      title.setText(`${step.tool}: ${this.stepTitle(step)}`);
      if (showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, { row, icon, status: step.state });
    }
    this.view.scheduleScroll();
  }

  private buildStepDetails(main: HTMLElement, step: StepInfo): void {
    const det = main.createEl("details", { cls: "opencode-step-details" });
    det.createEl("summary").setText(this.view.plugin.t("Details"));
    const pre = det.createEl("pre", { cls: "opencode-step-io" });
    pre.setText(this.serializeStep(step));
  }

  private serializeStep(step: StepInfo): string {
    const parts: string[] = [];
    const fmt = (v: unknown): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
      return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
    };
    if (step.input !== undefined && step.input !== null) {
      parts.push(this.view.plugin.t("INPUT:") + "\n" + fmt(step.input));
    }
    if (step.output !== undefined && step.output !== null) {
      parts.push(this.view.plugin.t("OUTPUT:") + "\n" + fmt(step.output));
    }
    return parts.join("\n\n---\n\n") || this.view.plugin.t("(no details)");
  }

  private stepTitle(step: StepInfo): string {
    const t = String(step.title || step.tool || this.view.plugin.t("Tool"));
    return t.length > 120 ? t.slice(0, 117) + "…" : t;
  }

  setFinish(info: FinishInfo): void {
    this.lastTokens = info.tokens;
    this.lastCost = info.cost;
    if (info.tokens) {
      const total = info.tokens.total ?? 0;
      const input = info.tokens.input ?? 0;
      const output = info.tokens.output ?? 0;
      const cost = info.cost ?? 0;
      this.statsEl.removeClass("hidden");
      this.statsEl.setText(
        this.view.fmtTokens(total, input, output, cost)
      );
    }
  }

  getSnapshot(): { text: string; reasoning: string; tokens?: FinishInfo["tokens"]; cost?: number } {
    return {
      text: this.rawText,
      reasoning: this.rawReasoning,
      tokens: this.lastTokens,
      cost: this.lastCost,
    };
  }

  finalize(): void {
    this.contentEl.empty();
    // Render markdown once, but only if the text is not huge (rendering
    // hundreds of KB would freeze the UI). Above the threshold keep raw text.
    if (this.rawText.trim() && this.rawText.length <= 30000) {
      MarkdownRenderer.render(this.app, this.rawText, this.contentEl, "", this.view);
    } else if (this.rawText.trim()) {
      this.contentEl.textContent = this.rawText;
    }
    this.status.setText("");
    for (const rec of this.steps.values()) {
      if (rec.status === "running") {
        rec.status = "done";
        rec.row.removeClass("opencode-step--running");
        rec.row.addClass("opencode-step--done");
        rec.icon.empty();
        setIcon(rec.icon, "check");
      }
    }
  }

  // Cancel pending renders so no timer fires after the view is closed.
  dispose(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
  }
}


