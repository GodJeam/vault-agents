import { FileSystemAdapter, Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CHAT_VIEW_TYPE, ChatView } from "./features/chat";
import {
  OpencodeRunner,
  AntigravityRunner,
  ClaudeRunner,
  CodexRunner,
  HermesRunner,
  PiRunner,
} from "./providers";
import { ProviderRegistry } from "./core/registry";
import type { AgentProvider, RunnerHost } from "./core/provider";
import {
  getEngineConfig,
  migrateSettings,
  syncSettingsFields,
  type EngineConfig,
  type HistoryMap,
  type HistoryMessage,
  type OpencodeSettings,
} from "./core/types";
import { OpencodeSettingTab } from "./features/settings/settingsTab";
import { translate } from "./i18n";

export type {
  HistoryUser,
  HistoryAssistant,
  HistoryMessage,
  HistoryMap,
} from "./core/types";

export default class OpencodePlugin extends Plugin implements RunnerHost {
  settings!: OpencodeSettings;
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
    this.registry.register(new ClaudeRunner(this));
    this.registry.register(new CodexRunner(this));
    this.registry.register(new HermesRunner(this));
    this.registry.register(new PiRunner(this));

    // Best-effort database cleanup on load for any provider that supports it
    for (const provider of this.registry.getAll()) {
      void provider.pruneOversizedParts?.();
    }
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

    this.addSettingTab(new OpencodeSettingTab(this.app, this));
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

  onunload(): void {
    void this.flushSave();
    if (this.registry) {
      for (const provider of this.registry.getAll()) {
        provider.killAll();
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      syncSettingsFields(this.settings);
      void this.saveData({ ...this.settings, histories: this.histories });
    }, 500);
  }

  private async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    syncSettingsFields(this.settings);
    await this.saveData({ ...this.settings, histories: this.histories });
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
  }
}