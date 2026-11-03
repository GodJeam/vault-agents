import { FileSystemAdapter, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CHAT_VIEW_TYPE, ChatView } from "./features/chat";
import {
  OpencodeRunner,
  AntigravityRunner,
  HermesRunner,
  PiRunner,
} from "./providers";
import { ProviderRegistry } from "./core/registry";
import type { AgentProvider, RunnerHost } from "./core/provider";
import { pruneHistoryMap } from "./core/history";
import {
  getEngineConfig,
  migrateSettings,
  type EngineConfig,
  type HistoryMap,
  type HistoryMessage,
  type PluginSettings,
} from "./core/types";
import { VaultAgentsSettingTab } from "./features/settings/settingsTab";
import { translate } from "./i18n";

export type {
  HistoryUser,
  HistoryAssistant,
  HistoryMessage,
  HistoryMap,
} from "./core/types";

export default class VaultAgentsPlugin extends Plugin implements RunnerHost {
  settings!: PluginSettings;
  histories: HistoryMap = {};
  registry!: ProviderRegistry;
  opencodeRunner!: OpencodeRunner;
  antigravityRunner!: AntigravityRunner;
  private saveTimer: number | null = null;

  getRunnerForSession(sessionId?: string): AgentProvider {
    return this.registry.resolveProvider(
      this.settings.engine,
      sessionId,
      this.settings.sessionEngines
    );
  }

  getEngineConfig(engineId: string): EngineConfig {
    return getEngineConfig(this.settings, engineId);
  }

  getVaultPath(): string | null {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getBasePath();
    }
    return null;
  }

  async onload(): Promise<void> {
    const raw = (await this.loadData()) as Record<string, unknown> | null;
    const migrated = migrateSettings(raw);
    this.settings = migrated.settings;
    this.histories = migrated.histories;

    this.opencodeRunner = new OpencodeRunner(this);
    this.antigravityRunner = new AntigravityRunner(this);
    this.registry = new ProviderRegistry();
    this.registry.register(this.opencodeRunner);
    this.registry.register(this.antigravityRunner);
    this.registry.register(new HermesRunner(this));
    this.registry.register(new PiRunner(this));

    // Database cleanup is intentionally NOT run on load: it mutates the
    // OpenCode SQLite database and could remove data still in use. It is
    // available on demand from the settings tab.
    const t = this.t.bind(this);

    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

    this.addRibbonIcon("bot", t("New Vault Agents chat"), () => {
      void this.openNewChatView();
    });

    this.addCommand({
      id: "open-chat",
      name: t("Open Vault Agents chat"),
      callback: () => this.openChatView(),
    });

    this.addCommand({
      id: "new-chat",
      name: t("New Vault Agents chat"),
      callback: () => this.openNewChatView(),
    });

    this.addCommand({
      id: "continue-new-session",
      name: t("Continue in a new session (by summarizing)"),
      callback: async () => {
        const chat = await this.openChatView();
        chat.continueInNewSession();
      },
    });

    this.addCommand({
      id: "send-selection",
      name: t("Send selection to agent"),
      editorCallback: (editor, view) => {
        const selection = editor.getSelection();
        if (!selection.trim()) {
          new Notice(t("No text selected"));
          return;
        }
        const label = view.file ? view.file.path : "selection";
        this.openChatView().then((chat) => {
          chat.setContext({ label, content: selection });
          chat.focusInput();
        });
      },
    });

    this.addCommand({
      id: "use-current-note",
      name: t("Use the current note as context"),
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice(t("No active note"));
          return;
        }
        const content = await this.app.vault.cachedRead(file);
        const chat = await this.openChatView();
        chat.setContext({ label: file.path, content });
        chat.focusInput();
      },
    });

    this.addCommand({
      id: "analyze-current-note",
      name: t("Analyze the current note with agent"),
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice(t("No active note"));
          return;
        }
        const content = await this.app.vault.cachedRead(file);
        const chat = await this.openChatView();
        chat.setContext({ label: file.path, content });
        chat.sendText(
          t(
            "Analyze the content of the attached note below: provide a " +
              "summary, key points, possible links with other vault notes " +
              "and suggestions to develop it."
          )
        );
      },
    });

    this.addCommand({
      id: "reset-session",
      name: t("Reset the active session"),
      callback: async () => {
        this.settings.sessionId = "";
        await this.saveSettings();
        new Notice(t("Session reset."));
      },
    });

    this.addSettingTab(new VaultAgentsSettingTab(this.app, this));
  }

  // Translate a UI string according to the selected language.
  t(text: string): string {
    return translate(this.settings?.language ?? "en", text);
  }

  async openChatView(): Promise<ChatView> {
    const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
    if (existing) {
      await this.app.workspace.revealLeaf(existing);
      return existing.view as ChatView;
    }
    return this.openNewChatView(false);
  }

  async openNewChatView(resetSession = true): Promise<ChatView> {
    const { workspace } = this.app;
    const hadExistingChat =
      workspace.getLeavesOfType(CHAT_VIEW_TYPE).length > 0;
    let leaf: WorkspaceLeaf;
    try {
      leaf = workspace.getLeaf("split", "vertical");
    } catch {
      leaf = workspace.getLeaf(true);
    }
    if (resetSession && hadExistingChat) {
      this.settings.sessionId = "";
    }
    await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
    const view = leaf.view as ChatView;
    if (resetSession && hadExistingChat) {
      view.startNewSession(true);
    }
    return view;
  }

  async onunload(): Promise<void> {
    await this.flushSave();
    if (this.registry) {
      for (const provider of this.registry.getAll()) {
        provider.killAll();
      }
    }
  }

  private collectKeepIds(): string[] {
    const ids = new Set<string>();
    if (this.settings.sessionId) ids.add(this.settings.sessionId);
    for (const id of this.settings.pinned ?? []) {
      if (id) ids.add(id);
    }
    for (const leaf of this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)) {
      if (leaf.view instanceof ChatView) {
        const id = leaf.view.getSessionId();
        if (id) ids.add(id);
      }
    }
    return Array.from(ids);
  }

  private pruneHistories(): void {
    const maxSessions = Math.max(
      1,
      Math.trunc(this.settings.historyMaxSessions) || 50
    );
    const maxBytes = Math.max(0, this.settings.historyMaxBytes);
    const before = Object.keys(this.histories);
    const pruned = pruneHistoryMap(this.histories, {
      maxSessions,
      maxBytes,
      keepIds: this.collectKeepIds(),
    });
    const removed = before.filter((id) => !(id in pruned));
    if (removed.length > 0 && this.settings.sessionEngines) {
      for (const id of removed) delete this.settings.sessionEngines[id];
    }
    this.histories = pruned;
  }

  private buildSavePayload(): Record<string, unknown> {
    this.pruneHistories();
    return {
      ...this.settings,
      histories: this.settings.saveHistory ? this.histories : {},
    };
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveData(this.buildSavePayload());
    }, 500);
  }

  private async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveData(this.buildSavePayload());
  }

  getHistory(sessionId: string): HistoryMessage[] {
    return this.histories[sessionId] ?? [];
  }

  async appendHistory(sessionId: string, msg: HistoryMessage): Promise<void> {
    if (!sessionId) return;
    const cap = (s: string | undefined): string | undefined =>
      s && s.length > 50000 ? s.slice(0, 50000) + "…" : s;
    const cloned: HistoryMessage =
      msg.role === "assistant"
        ? {
            ...msg,
            text: cap(msg.text) ?? "",
            reasoning: cap(msg.reasoning),
            timestamp: msg.timestamp ?? Date.now(),
          }
        : {
            ...msg,
            text: cap(msg.text) ?? "",
            timestamp: msg.timestamp ?? Date.now(),
          };
    if (!this.histories[sessionId]) this.histories[sessionId] = [];
    const arr = this.histories[sessionId];
    arr.push(cloned);
    if (arr.length > 100) arr.splice(0, arr.length - 100);
    this.scheduleSave();
  }

  async deleteHistory(sessionId: string): Promise<void> {
    delete this.histories[sessionId];
    this.scheduleSave();
  }

  async saveSettings(): Promise<void> {
    await this.flushSave();
    for (const leaf of this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)) {
      if (leaf.view instanceof ChatView) {
        leaf.view.refreshSettings();
      }
    }
  }
}