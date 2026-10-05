import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { CHAT_VIEW_TYPE, ChatView } from "./features/chat";
import { OpencodeRunner, AntigravityRunner } from "./providers";
import { ProviderRegistry } from "./core/registry";
import type { AgentProvider } from "./core/provider";
import { DEFAULT_SETTINGS } from "./core/types";
import { OpencodeSettingTab } from "./features/settings/settingsTab";
import type { OpencodeSettings } from "./core/types";
import { translate } from "./i18n";

export interface HistoryUser {
  role: "user";
  text: string;
  contextLabel?: string;
}

export interface HistoryAssistant {
  role: "assistant";
  text: string;
  reasoning?: string;
  tokens?: { total?: number; input?: number; output?: number };
  cost?: number;
}

export type HistoryMessage = HistoryUser | HistoryAssistant;
export type HistoryMap = Record<string, HistoryMessage[]>;

export default class OpencodePlugin extends Plugin {
  settings!: OpencodeSettings;
  histories: HistoryMap = {};
  registry!: ProviderRegistry;
  opencodeRunner!: OpencodeRunner;
  antigravityRunner!: AntigravityRunner;
  private saveTimer: number | null = null;

  get runner(): AgentProvider {
    return this.registry.resolveProvider(this.settings.engine);
  }

  getRunnerForSession(sessionId?: string): AgentProvider {
    return this.registry.resolveProvider(
      this.settings.engine,
      sessionId,
      this.settings.sessionEngines
    );
  }

  async onload(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    const { histories, ...rest } = data as { histories?: HistoryMap } & Record<string, unknown>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, rest);
    this.histories = histories ?? {};

    this.opencodeRunner = new OpencodeRunner(this);
    this.antigravityRunner = new AntigravityRunner(this);
    this.registry = new ProviderRegistry();
    this.registry.register(this.opencodeRunner);
    this.registry.register(this.antigravityRunner);

    if (this.settings.engine === "opencode") {
      void this.opencodeRunner.pruneOversizedParts();
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
            "Analyze the content of the attached note below: provide a summary, key points, possible links with other vault notes and suggestions to develop it."
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
    return this.openNewChatView();
  }

  async openNewChatView(): Promise<ChatView> {
    const { workspace } = this.app;
    // Opens a new chat in a side-by-side pane (vertical split) so that
    // multiple sessions can be managed at the same time.
    let leaf: WorkspaceLeaf;
    try {
      leaf = workspace.getLeaf("split", "vertical");
    } catch {
      leaf = workspace.getLeaf(true);
    }
    await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
    return leaf.view as ChatView;
  }

  onunload(): void {
    // Persist any debounced history write before tearing down.
    void this.flushSave();
    if (this.registry) {
      for (const provider of this.registry.getAll()) {
        provider.killAll();
      }
    }
  }

  // Debounce history writes: appendHistory is called on every message and
  // rewriting the whole data.json each time is wasteful.
  private scheduleSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.saveData({ ...this.settings, histories: this.histories });
    }, 500);
  }

  private async flushSave(): Promise<void> {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.saveData({ ...this.settings, histories: this.histories });
  }

  getHistory(sessionId: string): HistoryMessage[] {
    return this.histories[sessionId] ?? [];
  }

  async appendHistory(sessionId: string, msg: HistoryMessage): Promise<void> {
    if (!sessionId) return;
    // Cap the size of stored messages to keep data.json (and its saves) light,
    // since responses of long tasks can be very large.
    const cap = (s: string | undefined): string | undefined =>
      s && s.length > 50000 ? s.slice(0, 50000) + "…" : s;
    msg.text = cap(msg.text) ?? "";
    if (msg.role === "assistant") msg.reasoning = cap(msg.reasoning);
    if (!this.histories[sessionId]) this.histories[sessionId] = [];
    const arr = this.histories[sessionId];
    arr.push(msg);
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