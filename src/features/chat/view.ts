import {
  ItemView,
  MarkdownRenderer,
  Notice,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import type OpencodePlugin from "../../main";
import type { AgentProvider } from "../../core/provider";
import type {
  FinishInfo,
  RunHandle,
  SessionInfo,
  EngineType,
} from "../../core/types";
import { substitute } from "../../i18n";
import {
  ConfirmModal,
  ModelSuggestModal,
  RenameModal,
  StatsModal,
  type ModelItem,
} from "../../shared/modals";
import type { TurnContext, SessionStats } from "./types";
import {
  AssistantBubble,
  renderUserBubble,
  renderErrorBubble,
  metaWithCopy,
} from "./messageBubble";
import { SuggestPopup } from "./suggestPopup";
import { AttachmentManager } from "./attachmentManager";

export const CHAT_VIEW_TYPE = "opencode-chat-view";

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
  private attachmentManager!: AttachmentManager;
  private suggestPopup!: SuggestPopup;
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
  private activeBubble: AssistantBubble | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: OpencodePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.viewSession = plugin.settings.sessionId;
  }

  getRunner(): AgentProvider {
    return this.plugin.getRunnerForSession(this.viewSession);
  }

  /** Engine for the shown session (falls back to the global engine). */
  private sessionEngine(): EngineType {
    const id = this.viewSession;
    const map = this.plugin.settings.sessionEngines;
    return (id && map?.[id]) || this.plugin.settings.engine;
  }

  /** Active model id for the given engine via its EngineConfig. */
  private activeModelFor(engine: EngineType): string {
    const cfg = this.plugin.getEngineConfig(engine);
    const provider = this.plugin.registry.get(engine);
    return cfg.model || provider?.descriptor.defaultModel || "";
  }

  /** Human-readable label for an engine from the provider descriptor. */
  private engineLabel(engine: EngineType): string {
    const provider = this.plugin.registry.get(engine);
    return provider?.costNote || provider?.displayName || engine;
  }

  assistantLabel(): string {
    const desc = this.getRunner().descriptor;
    return desc.id === "opencode"
      ? this.plugin.t(desc.shortName)
      : desc.shortName;
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
    this.attachmentManager = new AttachmentManager(
      container,
      this.app,
      this.plugin
    );
    this.buildStatsBar(container);
    this.buildInputArea(container);

    // Keep @ file suggestions reactive when vault files change
    const inv = () => this.suggestPopup?.invalidateVaultCache();
    this.registerEvent(this.app.vault.on("create", inv));
    this.registerEvent(this.app.vault.on("delete", inv));
    this.registerEvent(this.app.vault.on("rename", inv));

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
    void this.send();
  }

  startNewSession(silent = false): void {
    this.viewSession = "";
    this.plugin.settings.sessionId = "";
    void this.plugin.saveSettings();
    void this.populateSessionSelect();
    this.loadHistoryForSession("");
    if (!silent) {
      new Notice(
        this.plugin.t("New session: the next message will start from scratch.")
      );
    }
  }

  private buildContextBar(container: HTMLElement): void {
    this.contextBar = container.createDiv({ cls: "opencode-context-bar" });

    this.contextLabelEl = this.contextBar.createSpan({
      cls: "opencode-context-label",
    });
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
    this.renameBtn.addEventListener("click", () =>
      this.renameCurrentSession()
    );

    this.deleteBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Delete session") },
    });
    setIcon(this.deleteBtn, "trash");
    this.deleteBtn.addEventListener("click", () =>
      this.deleteCurrentSession()
    );

    const statsBtn = this.contextBar.createEl("button", {
      cls: "opencode-icon-btn",
      attr: { title: this.plugin.t("Token and cost statistics") },
    });
    setIcon(statsBtn, "bar-chart-3");
    statsBtn.addEventListener("click", () =>
      new StatsModal(this.app, this.plugin, this.sessionEngine()).open()
    );

    const attachBtn = this.contextBar.createEl("button", {
      cls: "opencode-add-note-btn",
    });
    attachBtn.setText("＋ " + this.plugin.t("Attach file"));
    attachBtn.addEventListener("click", () =>
      this.attachmentManager.openFilePicker()
    );

    const add = this.contextBar.createEl("button", {
      cls: "opencode-add-note-btn",
    });
    add.setText("+ " + this.plugin.t("Current note"));
    add.addEventListener("click", () => this.attachCurrentNote());

    this.updateContextBar();
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
    const msg =
      idx >= 0
        ? this.plugin.t("Session unpinned.")
        : this.plugin.t("Session pinned.");
    new Notice(msg);
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
        .catch((e) =>
          new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`)
        );
    }).open();
  }

  private deleteCurrentSession(): void {
    const id = this.viewSession;
    if (!id) {
      new Notice(this.plugin.t("Select a session to delete."));
      return;
    }
    const title = this.sessionSelect.selectedOptions[0]?.textContent ?? id;
    const confirmTpl = this.plugin.t(
      'Do you want to delete the session "$1"? ' +
        "The history saved in Obsidian will also be removed."
    );
    new ConfirmModal(
      this.app,
      this.plugin,
      this.plugin.t("Delete session"),
      confirmTpl.replace("$1", title),
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
            if (this.plugin.settings.sessionEngines) {
              delete this.plugin.settings.sessionEngines[id];
            }
            if (this.viewSession === id) {
              this.viewSession = "";
              this.plugin.settings.sessionId = "";
            }
            await this.plugin.saveSettings();
            await this.populateSessionSelect();
            this.loadHistoryForSession(this.viewSession);
            new Notice(this.plugin.t("Session deleted."));
          })
          .catch((e) =>
            new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`)
          );
      }
    ).open();
  }

  private updateContextBar(): void {
    if (this.context) {
      this.contextLabelEl.setText(
        `${this.plugin.t("Context:")} ${this.context.label}`
      );
      this.contextLabelEl.show();
      this.contextClearBtn.removeClass("hidden");
    } else {
      this.contextLabelEl.setText("");
      this.contextLabelEl.hide();
      this.contextClearBtn.addClass("hidden");
    }
  }

  private async populateSessionSelect(): Promise<void> {
    if (!this.sessionSelect) return;
    const sel = this.sessionSelect;
    sel.empty();
    const newOpt = sel.createEl("option");
    newOpt.value = "";
    newOpt.textContent = "＋ " + this.plugin.t("New session");
    try {
      const providers = this.plugin.registry.getAll();
      const results = await Promise.allSettled(
        providers.map((p) => p.listSessions())
      );
      const all: SessionInfo[] = [];
      const seen = new Set<string>();

      results.forEach((res, i) => {
        if (res.status === "fulfilled") {
          const providerId = providers[i].id;
          for (const s of res.value) {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              const engine = s.engine || providerId;
              all.push({ ...s, engine });
              if (!this.plugin.settings.sessionEngines) {
                this.plugin.settings.sessionEngines = {};
              }
              if (!this.plugin.settings.sessionEngines[s.id]) {
                this.plugin.settings.sessionEngines[s.id] = engine;
              }
            }
          }
        }
      });

      all.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
      const pinnedSet = new Set(this.plugin.settings.pinned ?? []);
      const pinned = all.filter((s) => pinnedSet.has(s.id));
      const recent = all.filter((s) => !pinnedSet.has(s.id)).slice(0, 20);
      const displayed = [...pinned, ...recent];

      // Always include the currently active session so its name is shown
      const hasActive = displayed.some((s) => s.id === this.viewSession);
      if (this.viewSession && !hasActive) {
        const found = all.find((s) => s.id === this.viewSession);
        if (found) {
          displayed.push(found);
        } else {
          const hist = this.plugin.getHistory(this.viewSession);
          const firstUser = hist.find(
            (m) => m.role === "user" && m.text.trim()
          );
          const fallbackTitle = firstUser
            ? firstUser.text.trim().replace(/\s+/g, " ").slice(0, 40)
            : this.viewSession;
          displayed.push({
            id: this.viewSession,
            title: fallbackTitle,
            updated: Date.now(),
            engine: this.sessionEngine(),
          });
        }
      }

      for (const s of displayed) {
        const o = sel.createEl("option");
        o.value = s.id;
        const title = s.title || s.id;
        const mark = pinnedSet.has(s.id) ? "● " : "";
        const short = title.length > 40 ? title.slice(0, 37) + "⬦" : title;
        o.textContent = mark + short;
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
    const sessionMode = this.getRunner().descriptor.supportsSessions;
    const supportsSessions = sessionMode !== "none";
    this.renameBtn.disabled = !hasSession || !supportsSessions;
    this.deleteBtn.disabled = !hasSession || !supportsSessions;
    this.pinBtn.disabled = !hasSession || !supportsSessions;
    const pinnedList = this.plugin.settings.pinned ?? [];
    const pinned = pinnedList.includes(this.viewSession);
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
      text: this.fmtTokens(
        this.stats.total,
        this.stats.input,
        this.stats.output,
        this.stats.cost,
        this.sessionEngine()
      ),
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
    const usedK = Math.round(used / 1000);
    const limitK = Math.round(limit / 1000);
    this.contextEl.setText(
      `${this.plugin.t("Context:")} ${pct}% (${usedK}K / ${limitK}K)`
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
      const runner = this.getRunner();
      const tokens = await runner.getSessionTokens(sid);
      this.contextBaseInput = tokens.input;
      this.contextUsed = tokens.input;
      if (!this.contextLimit) {
        const activeMod = this.activeModelFor(runner.id);
        this.contextLimit = await runner.getModelContextLimit(activeMod);
      }
    } catch (e) {
      console.error("[vault-agents] refreshContext error:", e);
    }
    this.updateContextUsage();
  }

  private addStats(info: FinishInfo): void {
    if (info.tokens) {
      const input = info.tokens.input ?? 0;
      const output = info.tokens.output ?? 0;
      const reasoning = info.tokens.reasoning ?? 0;
      const total = input + output + reasoning;
      this.stats.input += input;
      this.stats.output += output;
      this.stats.total += total;
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

    const placeholderKey =
      "Type a message for the agent... " +
      "(Enter to send, Shift+Enter for a new line)";
    this.inputEl = inputArea.createEl("textarea", {
      cls: "opencode-input",
      attr: {
        placeholder: this.plugin.t(placeholderKey),
      },
    });

    this.suggestPopup = new SuggestPopup(
      inputArea,
      this.inputEl,
      this.app,
      this.plugin,
      {
        onOpenModelList: () => void this.openModelList(),
        onStartNewSession: () => this.startNewSession(),
        onAttachCurrentNote: () => void this.attachCurrentNote(),
        onOpenFilePicker: () => this.attachmentManager.openFilePicker(),
        onOpenStats: () =>
          new StatsModal(this.app, this.plugin, this.sessionEngine()).open(),
        onTogglePin: () => this.togglePin(),
        onRenameSession: () => this.renameCurrentSession(),
        onAddAttachment: (path) => this.attachmentManager.addAttachment(path),
      }
    );

    this.inputEl.addEventListener("keydown", (e) => {
      if (this.suggestPopup.handleKeydown(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.send();
      }
    });
    this.inputEl.addEventListener("input", () =>
      this.suggestPopup.onInputChange()
    );

    const buttons = inputArea.createDiv({ cls: "opencode-buttons" });

    this.modelBtn = buttons.createEl("button", { cls: "opencode-model-btn" });
    this.updateModelBtn();
    this.modelBtn.addEventListener("click", () => void this.openModelList());

    buttons.createSpan({ cls: "opencode-buttons-spacer" });

    this.sendBtn = buttons.createEl("button", { cls: "opencode-send-btn" });
    this.sendBtn.setText(this.plugin.t("Send"));
    this.sendBtn.addEventListener("click", () => void this.send());

    this.stopBtn = buttons.createEl("button", { cls: "opencode-stop-btn" });
    this.stopBtn.setText(this.plugin.t("Stop"));
    this.stopBtn.addClass("hidden");
    this.stopBtn.addEventListener("click", () => {
      this.stoppedByUser = true;
      this.currentProc?.abort();
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
    const engine = this.sessionEngine();
    const m = this.activeModelFor(engine);
    this.modelBtn.setText(m.length > 30 ? m.slice(0, 27) + "⬦" : m);
    this.modelBtn.setAttribute("title", `${m} (${this.engineLabel(engine)})`);
  }

  private async openModelList(): Promise<void> {
    const activeEngine = this.sessionEngine();
    const cur = this.activeModelFor(activeEngine);

    try {
      const providers = this.plugin.registry.getAll();
      // Place the currently active engine first
      const orderedProviders = [
        ...providers.filter((p) => p.id === activeEngine),
        ...providers.filter((p) => p.id !== activeEngine),
      ];

      const results = await Promise.allSettled(
        orderedProviders.map((p) => p.listModels())
      );
      const items: ModelItem[] = [];

      orderedProviders.forEach((provider, idx) => {
        const res = results[idx];
        const models = res.status === "fulfilled" ? res.value : [];
        const providerLabel =
          provider.costNote || provider.descriptor.shortName;
        for (const m of models) {
          items.push({
            id: m,
            engine: provider.id,
            provider: providerLabel,
            isActive: provider.id === activeEngine && m === cur,
          });
        }
      });

      new ModelSuggestModal(this.app, this.plugin, items, (item) => {
        const engineChanged = item.engine !== activeEngine;
        this.plugin.settings.engine = item.engine;
        const cfg = this.plugin.getEngineConfig(item.engine);
        cfg.model = item.id;

        const setPrefix = this.plugin.t("Model set:");
        if (this.viewSession && engineChanged) {
          // The open session belongs to another engine: start a fresh session
          this.viewSession = "";
          this.plugin.settings.sessionId = "";
          void this.plugin.saveSettings();
          this.loadHistoryForSession("");
          new Notice(`${setPrefix} ${item.id} (${item.provider})`);
          return;
        }
        if (this.viewSession) {
          if (!this.plugin.settings.sessionEngines) {
            this.plugin.settings.sessionEngines = {};
          }
          this.plugin.settings.sessionEngines[this.viewSession] = item.engine;
        }
        void this.plugin.saveSettings();
        this.updateModelBtn();
        this.updateStatsBar();
        this.contextLimit = 0;
        void this.refreshContext();
        new Notice(`${setPrefix} ${item.id} (${item.provider})`);
      }).open();
    } catch (e) {
      new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`);
    }
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
    this.setRunningUI(true);

    const promptText = this.plugin.t(
      "Summarize in detail this conversation: goals, decisions made, " +
        "work done, current state and next steps. Write the summary so " +
        "the work can continue in a new session without losing context."
    );

    const runner = this.getRunner();
    const proc = runner.runStream(
      {
        prompt: promptText,
        fileAttachments: [],
        sessionId: oldSession,
      },
      {
        onSession: (id) => {
          this.viewSession = id;
          this.plugin.settings.sessionId = id;
          if (!this.plugin.settings.sessionEngines) {
            this.plugin.settings.sessionEngines = {};
          }
          this.plugin.settings.sessionEngines[id] = runner.id;
          void this.plugin.saveSettings();
        },
        onActivity: (activity) => bubble.setActivity(activity),
        onText: (text) => bubble.setText(text),
        onReasoning: (text) => bubble.setReasoning(text),
        onStep: (step) => bubble.addStep(step),
        onQuestion: (questions) => bubble.addQuestions(questions),
        onFinish: (info) => bubble.setFinish(info),
        onError: (err) => {
          this.hadStreamError = true;
          this.addErrorBubble(err);
        },
        onRaw: (line) => {
          this.lastStderr = line;
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
              const detail = this.lastStderr
                .trim()
                .replace(/\s+/g, " ")
                .slice(0, 300);
              const failMsg = this.plugin.t(
                "The session summary could not be generated."
              );
              const base = `${failMsg} (${code}).`;
              this.addErrorBubble(detail ? `${base} ${detail}` : base);
            }
            const limitNotice = this.plugin.t(
              "Session at the limit: new session created " +
                "with the recent history."
            );
            this.finishContinuation(
              this.buildLocalContinuation(oldSession),
              limitNotice
            );
            return;
          }
          const summary = bubble.getSnapshot().text.trim();
          const sumHeader = this.plugin.t(
            "[SUMMARY OF THE PREVIOUS SESSION]"
          );
          const contFooter = this.plugin.t("Continue the work from here.");
          const prompt = summary
            ? [sumHeader, summary, "---", contFooter].join("\n\n")
            : this.plugin.t("Continue the work from the previous session.");
          const okNotice = this.plugin.t(
            "New session created with the summary of the previous one."
          );
          this.finishContinuation(prompt, okNotice);
        },
      }
    );
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
      return this.plugin.t(
        "The previous session has no saved history. " +
          "Continue the work from here."
      );
    }
    const assistantWho = this.assistantLabel();
    const lines: string[] = [];
    for (const rec of recent) {
      const who = rec.role === "user" ? this.plugin.t("User") : assistantWho;
      const text =
        rec.text.length > 800 ? rec.text.slice(0, 800) + "⬦" : rec.text;
      lines.push(`${who}: ${text}`);
    }
    return (
      this.plugin.t("[RECENT HISTORY OF THE PREVIOUS SESSION]") +
      "\n" +
      lines.join("\n\n") +
      "\n\n---\n\n" +
      this.plugin.t(
        "Continue the work from here, keeping the context above in mind."
      )
    );
  }

  private addWelcome(): void {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant",
    });
    const text = this.plugin.t(
      "Hi! I am Vault Agents, connecting AI agents directly to your " +
        "notes. Write a message below. Try the commands: / for commands, " +
        "@ to attach a file, ! for quick actions."
    );
    metaWithCopy(
      row,
      this.assistantLabel(),
      () => text,
      (t) => this.copyText(t),
      this.plugin.t("Copy text")
    );
    row.createDiv({ text, cls: "opencode-bubble" });
  }

  private async send(): Promise<void> {
    const raw = this.inputEl.value.trim();
    if (!raw || this.running || this.dispatching) return;

    let prompt = raw;
    const ctxLabel = this.context?.label;
    if (this.context) {
      const header = `[CONTEXT FROM OBSIDIAN - ${this.context.label}]`;
      prompt = `${header}\n${this.context.content}\n\n---\n\n` + raw;
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
      const filePaths = await this.attachmentManager.prepareAttachments(
        this.getRunner()
      );
      this.dispatching = false;
      this.doRun(prompt, filePaths);
    } catch (e) {
      this.dispatching = false;
      new Notice(`${this.plugin.t("Error:")} ${(e as Error).message}`);
    }
  }

  private doRun(prompt: string, fileAttachments: string[]): void {
    const bubble = this.addAssistantMessage();
    let currentActivity = this.plugin.t("Connecting to agent...");
    bubble.setActivity(currentActivity);

    this.running = true;
    this.hadStreamError = false;
    this.stoppedByUser = false;
    this.lastStderr = "";
    this.contextRunInput = 0;
    this.setRunningUI(true);

    let lastEventTime = Date.now();
    if (this.activityTimer !== null) clearInterval(this.activityTimer);
    this.activityTimer = window.setInterval(() => {
      if (!this.running) {
        if (this.activityTimer !== null) {
          clearInterval(this.activityTimer);
          this.activityTimer = null;
        }
        return;
      }
      const idleSec = Math.floor((Date.now() - lastEventTime) / 1000);
      const agoLabel = substitute(
        this.plugin.t("last update $1s ago"),
        idleSec
      );
      if (idleSec >= 20) {
        const stuck = this.plugin.t("Possibly stuck");
        bubble.setActivity(`${currentActivity} · ${agoLabel} (${stuck})`, true);
      } else if (idleSec >= 6) {
        bubble.setActivity(`${currentActivity} · ${agoLabel}`);
      }
    }, 2000);

    const runner = this.getRunner();
    const proc = runner.runStream(
      {
        prompt,
        fileAttachments,
        sessionId: this.viewSession,
      },
      {
        onSession: (id) => {
          lastEventTime = Date.now();
          const prev = this.viewSession;
          if (prev !== id) {
            this.viewSession = id;
            this.plugin.settings.sessionId = id;
            if (!this.plugin.settings.sessionEngines) {
              this.plugin.settings.sessionEngines = {};
            }
            this.plugin.settings.sessionEngines[id] = runner.id;
            void this.plugin.saveSettings();
            void this.populateSessionSelect();
          }
          if (this.pendingUser) {
            void this.plugin.appendHistory(id, {
              role: "user",
              text: this.pendingUser.text,
              contextLabel: this.pendingUser.contextLabel,
            });
            this.pendingUser = null;
          }
        },
        onActivity: (activity) => {
          lastEventTime = Date.now();
          currentActivity = activity;
          bubble.setActivity(activity);
        },
        onText: (text) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Writing response...");
          bubble.setActivity(currentActivity);
          bubble.setText(text);
        },
        onReasoning: (text) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Thinking...");
          bubble.setActivity(currentActivity);
          bubble.setReasoning(text);
        },
        onStep: (step) => {
          lastEventTime = Date.now();
          bubble.addStep(step);
        },
        onQuestion: (questions) => {
          lastEventTime = Date.now();
          currentActivity = this.plugin.t("Waiting for your answer...");
          bubble.setActivity(currentActivity);
          bubble.addQuestions(questions);
        },
        onFinish: (info) => {
          lastEventTime = Date.now();
          bubble.setFinish(info);
          this.addStats(info);
          if (info.tokens) {
            const stepContextTokens =
              (info.tokens.input ?? 0) +
              (info.tokens.cache?.read ?? 0) +
              (info.tokens.cache?.write ?? 0);
            if (stepContextTokens > 0) {
              this.contextRunInput = stepContextTokens;
              this.contextUsed = Math.max(
                this.contextBaseInput,
                this.contextRunInput
              );
              this.updateContextUsage();
            }
          }
        },
        onError: (err) => {
          lastEventTime = Date.now();
          this.hadStreamError = true;
          this.handleStreamError(err);
        },
        onRaw: (line) => {
          this.lastStderr = line;
        },
        onDone: (code) => {
          if (this.activityTimer !== null) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
          }
          const isCurrent = this.currentProc === proc;
          if (isCurrent) this.currentProc = null;
          bubble.finalize();
          if (!isCurrent) return;

          this.running = false;
          this.setRunningUI(false);

          const snap = bubble.getSnapshot();
          const currentSession = this.viewSession;
          if (currentSession && snap.text.trim()) {
            void this.plugin.appendHistory(currentSession, {
              role: "assistant",
              text: snap.text,
              reasoning: snap.reasoning || undefined,
              tokens: snap.tokens,
              cost: snap.cost,
            });
          }

          const failed = code !== 0 || this.hadStreamError;
          if (failed && !this.stoppedByUser) {
            this.handleProcessFailure(code);
          }
          this.stoppedByUser = false;
          this.pendingUser = null;
          void this.populateSessionSelect();
          void this.refreshContext();
        },
      }
    );

    this.currentProc = proc;
  }

  private addUserMessage(text: string, ctxLabel?: string): void {
    renderUserBubble(
      this.messagesEl,
      text,
      ctxLabel,
      (s) => this.plugin.t(s),
      (t) => this.copyText(t)
    );
    this.scrollToBottom();
  }

  private addAssistantMessage(): AssistantBubble {
    const row = this.messagesEl.createDiv({
      cls: "opencode-message opencode-message--assistant",
    });
    const bubble = new AssistantBubble(
      row,
      this.app,
      this,
      this.assistantLabel(),
      (s) => this.plugin.t(s),
      this.plugin.settings.showToolIO,
      () => this.scheduleScroll(),
      (t) => this.copyText(t),
      (total, input, output, cost) =>
        this.fmtTokens(total, input, output, cost, this.sessionEngine()),
      (formattedAnswer) => this.handleQuestionAnswer(formattedAnswer)
    );
    this.activeBubble = bubble;
    this.scrollToBottom();
    return bubble;
  }

  private handleQuestionAnswer(formattedAnswer: string): void {
    if (!formattedAnswer.trim()) return;
    if (this.running) {
      this.stoppedByUser = true;
      this.currentProc?.abort();
      window.setTimeout(() => {
        this.sendText(formattedAnswer);
      }, 250);
    } else {
      this.sendText(formattedAnswer);
    }
  }

  private addErrorBubble(msg: string): void {
    renderErrorBubble(
      this.messagesEl,
      msg,
      (s) => this.plugin.t(s),
      (t) => this.copyText(t)
    );
    this.scrollToBottom();
  }

  copyText(text: string): void {
    void navigator.clipboard.writeText(text);
    new Notice(this.plugin.t("Text copied."));
  }

  private handleStreamError(err: string): void {
    const isImageError =
      /does not support image/i.test(err) ||
      /multimodal/i.test(err) ||
      /image.*not supported/i.test(err);
    if (isImageError) {
      this.addErrorBubble(
        this.plugin.t(
          "The selected model does not support images. Remove the " +
            "attached image or choose a multimodal (vision) model " +
            "from the Model menu."
        )
      );
      return;
    }
    const isSessionMissing =
      /session.*not found/i.test(err) ||
      /no such session/i.test(err) ||
      /session does not exist/i.test(err);
    if (isSessionMissing) {
      this.addErrorBubble(
        this.plugin.t(
          "The saved session no longer exists: a new one will be " +
            "created, resend the message."
        )
      );
      if (this.viewSession && this.plugin.settings.sessionEngines) {
        delete this.plugin.settings.sessionEngines[this.viewSession];
      }
      this.viewSession = "";
      this.plugin.settings.sessionId = "";
      void this.plugin.saveSettings();
      void this.populateSessionSelect();
      return;
    }
    this.addErrorBubble(err);
  }

  private handleProcessFailure(code: number): void {
    if (this.hadStreamError) return;
    const detail = this.lastStderr.trim().replace(/\s+/g, " ").slice(0, 300);
    const exitKey =
      "The agent process exited with code $1. Check the binary path " +
      "and the model in the settings.";
    const base = substitute(this.plugin.t(exitKey), code);
    this.addErrorBubble(detail ? `${base} (${detail})` : base);
  }

  loadHistoryForSession(sessionId: string): void {
    this.messagesEl.empty();
    this.resetStats();
    this.contextUsed = 0;
    this.contextBaseInput = 0;
    this.contextRunInput = 0;
    this.contextLimit = 0;
    this.updateContextUsage();
    this.updateModelBtn();

    if (!sessionId) {
      this.addWelcome();
      return;
    }

    const history = this.plugin.getHistory(sessionId);
    if (!history || history.length === 0) {
      this.addWelcome();
      void this.refreshContext();
      return;
    }

    for (const rec of history) {
      if (rec.role === "user") {
        this.addUserMessage(rec.text, rec.contextLabel);
      } else {
        const row = this.messagesEl.createDiv({
          cls: "opencode-message opencode-message--assistant",
        });
        metaWithCopy(
          row,
          this.assistantLabel(),
          () => rec.text,
          (t) => this.copyText(t),
          this.plugin.t("Copy text")
        );
        if (rec.reasoning) {
          const det = row.createEl("details", { cls: "opencode-reasoning" });
          det.createEl("summary", { text: this.plugin.t("Reasoning") });
          det.createDiv({
            cls: "opencode-reasoning-content",
            text: rec.reasoning,
          });
        }
        const bubble = row.createDiv({
          cls: "opencode-bubble opencode-bubble--assistant",
        });
        if (rec.text.length <= 30000) {
          MarkdownRenderer.render(this.app, rec.text, bubble, "", this);
        } else {
          bubble.textContent = rec.text;
        }
        if (rec.tokens) {
          const inp = rec.tokens.input ?? 0;
          const out = rec.tokens.output ?? 0;
          const reas = rec.tokens.reasoning ?? 0;
          const tot = inp + out + reas;
          const stats = row.createDiv({ cls: "opencode-msg-stats" });
          stats.setText(
            this.fmtTokens(tot, inp, out, rec.cost, this.sessionEngine())
          );
          this.addStats({
            tokens: { ...rec.tokens, total: tot },
            cost: rec.cost,
          });
        }
      }
    }
    this.scrollToBottom();
    void this.refreshContext();
  }

  fmtTokens(
    total: number,
    input: number,
    output: number,
    cost?: number,
    engine?: EngineType
  ): string {
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const tokLbl = this.plugin.t("Token:");
    const inLbl = this.plugin.t("in");
    const outLbl = this.plugin.t("out");
    const totStr = total.toLocaleString(locale);
    const inStr = input.toLocaleString(locale);
    const outStr = output.toLocaleString(locale);
    const parts = [
      `${tokLbl} ${totStr} (${inStr} ${inLbl} / ${outStr} ${outLbl})`,
    ];
    const provider = this.plugin.registry.get(engine ?? this.sessionEngine());
    if (provider?.included) {
      const inc = this.plugin.t("included");
      parts.push(provider.costNote ? `(${provider.costNote})` : `(${inc})`);
    } else if (typeof cost === "number" && cost > 0) {
      parts.push(`${this.plugin.t("Cost:")} ${cost.toFixed(4)} $`);
    }
    return parts.join(" · ");
  }

  private setRunningUI(running: boolean): void {
    if (this.sendBtn) this.sendBtn.toggleClass("hidden", running);
    if (this.stopBtn) this.stopBtn.toggleClass("hidden", !running);
    if (this.inputEl) this.inputEl.disabled = running;
  }

  scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  scheduleScroll(): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.scrollToBottom(), 150);
  }
}
