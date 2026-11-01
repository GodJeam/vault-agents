import { App, Modal, Notice, Setting, SuggestModal, setIcon } from "obsidian";
import type { TFile } from "obsidian";
import type OpencodePlugin from "../main";
import type { UsageWindow, EngineType } from "../core/types";
import { substitute } from "../i18n";

export class RenameModal extends Modal {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private current: string,
    private onSubmit: (title: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Rename session") });

    let input: HTMLInputElement | undefined;
    new Setting(contentEl).setName(t("New title")).addText((txt) => {
      input = txt.inputEl;
      txt.setValue(this.current);
      txt.inputEl.select();
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText(t("Save"))
          .setCta()
          .onClick(() => {
            if (!input) return;
            const v = input.value.trim();
            if (!v) {
              new Notice(t("The title cannot be empty."));
              return;
            }
            this.onSubmit(v);
            this.close();
          })
      )
      .addButton((b) =>
        b.setButtonText(t("Cancel")).onClick(() => this.close())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class StatsModal extends Modal {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private engine: EngineType
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Token usage and costs") });
    const status = contentEl.createDiv({
      cls: "opencode-stats-loading",
      text: t("Loading..."),
    });

    this.plugin.registry
      .resolveProvider(this.engine)
      .getUsageStats()
      .then((s) => {
        status.remove();
        this.renderWindow(contentEl, t("Last 5 hours"), s.h5);
        this.renderWindow(contentEl, t("Last week"), s.week);
        this.renderWindow(contentEl, t("Last month"), s.month);
      })
      .catch((e) => {
        status.setText(`${t("Error:")} ${(e as Error).message}`);
      });
  }

  private renderWindow(
    container: HTMLElement,
    label: string,
    w: UsageWindow
  ): void {
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const t = (s: string) => this.plugin.t(s);
    container.createEl("h4", { text: label });
    new Setting(container)
      .setName(t("Input tokens"))
      .setDesc(w.input.toLocaleString(locale));
    new Setting(container)
      .setName(t("Output tokens"))
      .setDesc(w.output.toLocaleString(locale));
    new Setting(container)
      .setName(t("Total tokens"))
      .setDesc((w.input + w.output).toLocaleString(locale));
    const provider = this.plugin.registry.resolveProvider(this.engine);
    const incKey = provider.costNote
      ? t("Included with $1 ($0.00)")
      : t("Included ($0.00)");
    const costDesc = provider.included
      ? substitute(incKey, provider.costNote ?? "")
      : `${w.cost.toFixed(4)} $`;
    new Setting(container).setName(t("Cost")).setDesc(costDesc);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class ConfirmModal extends Modal {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private title: string,
    private message: string,
    private confirmLabel: string,
    private onConfirm: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: this.title });
    contentEl.createDiv({
      cls: "opencode-confirm-message",
      text: this.message,
    });
    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText(this.confirmLabel)
          .setWarning()
          .onClick(() => {
            this.onConfirm();
            this.close();
          })
      )
      .addButton((b) =>
        b.setButtonText(t("Cancel")).onClick(() => this.close())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class PromptModal extends Modal {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private initialName: string,
    private initialText: string,
    private onSave: (name: string, text: string) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Prompt") });

    let nameInput: HTMLInputElement | undefined;
    let textArea: HTMLTextAreaElement | undefined;
    new Setting(contentEl).setName(t("Prompt name")).addText((x) => {
      nameInput = x.inputEl;
      x.setValue(this.initialName);
    });
    new Setting(contentEl).setName(t("Prompt text")).addTextArea((x) => {
      textArea = x.inputEl;
      x.setValue(this.initialText);
      x.inputEl.rows = 10;
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText(t("Save"))
          .setCta()
          .onClick(() => {
            if (!nameInput || !textArea) return;
            const name = nameInput.value.trim();
            const text = textArea.value;
            if (!name || !text) {
              new Notice(t("The prompt cannot be empty."));
              return;
            }
            this.onSave(name, text);
            this.close();
          })
      )
      .addButton((b) =>
        b.setButtonText(t("Cancel")).onClick(() => this.close())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FileSuggestModal extends SuggestModal<TFile> {
  private items: TFile[] | null = null;

  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private onPick: (file: TFile) => void
  ) {
    super(app);
    const t = (s: string) => this.plugin.t(s);
    this.setPlaceholder(t("Search a vault file to attach..."));
    this.setInstructions([
      { command: "↑↓", purpose: t("navigate") },
      { command: "↵", purpose: t("attach") },
      { command: "esc", purpose: t("close") },
    ]);
  }

  getItems(): TFile[] {
    if (!this.items) {
      this.items = this.app.vault
        .getFiles()
        .sort((a, b) => a.path.localeCompare(b.path));
    }
    return this.items;
  }

  getSuggestions(query: string): TFile[] {
    const q = query.trim().toLowerCase();
    const items = this.getItems();
    if (!q) return items.slice(0, 50);
    return items.filter((f) => f.path.toLowerCase().includes(q)).slice(0, 50);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl("div", { text: file.path });
  }

  onChooseSuggestion(file: TFile): void {
    this.onPick(file);
  }
}

export interface AgentItem {
  id: EngineType;
  shortName: string;
  displayName: string;
  binary: string;
  activeModel: string;
  installed: boolean;
  isActive: boolean;
}

export class AgentSuggestModal extends SuggestModal<AgentItem> {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private items: AgentItem[],
    private onPick: (item: AgentItem) => void
  ) {
    super(app);
    const t = (s: string) => this.plugin.t(s);
    this.setPlaceholder(t("Select an AI Agent..."));
    this.setInstructions([
      { command: "↑↓", purpose: t("navigate") },
      { command: "↵", purpose: t("select") },
      { command: "esc", purpose: t("close") },
    ]);
  }

  getItems(): AgentItem[] {
    return this.items;
  }

  getSuggestions(query: string): AgentItem[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(
      (item) =>
        item.shortName.toLowerCase().includes(q) ||
        item.displayName.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.activeModel.toLowerCase().includes(q)
    );
  }

  renderSuggestion(item: AgentItem, el: HTMLElement): void {
    const t = (s: string) => this.plugin.t(s);
    el.addClass("opencode-agent-suggest-item");
    if (item.isActive) el.addClass("is-selected");

    const topRow = el.createDiv({ cls: "opencode-agent-suggest-top" });
    const leftGroup = topRow.createDiv({ cls: "opencode-agent-suggest-left" });

    const iconEl = leftGroup.createSpan({ cls: "opencode-agent-suggest-icon" });
    setIcon(iconEl, "bot");

    leftGroup.createSpan({
      text: item.shortName,
      cls: "opencode-agent-suggest-name",
    });

    leftGroup.createSpan({
      text: item.displayName,
      cls: "opencode-agent-suggest-fullname",
    });

    const rightGroup = topRow.createDiv({ cls: "opencode-agent-suggest-right" });
    const statusBadge = rightGroup.createSpan({
      cls:
        "opencode-suggest-badge " +
        (item.installed
          ? "opencode-suggest-badge--ok"
          : "opencode-suggest-badge--muted"),
      text: item.installed ? t("Installed") : t("Not found"),
    });
    statusBadge.setAttribute("title", item.binary);

    if (item.isActive) {
      rightGroup.createSpan({
        text: "✓",
        cls: "opencode-model-suggest-check",
      });
    }

    const bottomRow = el.createDiv({ cls: "opencode-agent-suggest-bottom" });
    bottomRow.createSpan({
      text: `${t("Model")}: `,
      cls: "opencode-agent-suggest-meta-label",
    });
    bottomRow.createSpan({
      text: item.activeModel || t("(CLI default)"),
      cls: "opencode-agent-suggest-meta-val",
    });
  }

  onChooseSuggestion(item: AgentItem): void {
    this.onPick(item);
  }
}

export interface ModelItem {
  id: string;
  label?: string;
  engine: EngineType;
  provider: string;
  isActive: boolean;
  isDefault?: boolean;
  isCustom?: boolean;
}

export class ModelSuggestModal extends SuggestModal<ModelItem> {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private items: ModelItem[],
    private activeEngine: EngineType,
    private onPick: (item: ModelItem) => void
  ) {
    super(app);
    const t = (s: string) => this.plugin.t(s);
    const provider = this.plugin.registry.get(this.activeEngine);
    const agentName = provider?.descriptor.shortName || this.activeEngine;
    this.setPlaceholder(
      substitute(
        t("Search $1 models or type a custom ID..."),
        agentName
      )
    );
    this.setInstructions([
      { command: "↑↓", purpose: t("navigate") },
      { command: "↵", purpose: t("select") },
      { command: "esc", purpose: t("close") },
    ]);
  }

  getItems(): ModelItem[] {
    return this.items;
  }

  getSuggestions(query: string): ModelItem[] {
    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) {
      return this.items.slice(0, 60);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const filtered = this.items
      .filter((item) => {
        const hay = `${item.id} ${item.label ?? ""} ${item.provider}`.toLowerCase();
        return tokens.every((tok) => hay.includes(tok));
      })
      .slice(0, 59);

    const exactExists = this.items.some(
      (item) => item.id.toLowerCase() === q
    );
    if (!exactExists && /^[a-zA-Z0-9_.:/+-]+$/.test(raw)) {
      const provider = this.plugin.registry.get(this.activeEngine);
      const providerLabel =
        provider?.descriptor.shortName || this.activeEngine;
      filtered.push({
        id: raw,
        label: raw,
        engine: this.activeEngine,
        provider: providerLabel,
        isActive: false,
        isCustom: true,
      });
    }
    return filtered;
  }

  renderSuggestion(item: ModelItem, el: HTMLElement): void {
    const t = (s: string) => this.plugin.t(s);
    el.addClass("opencode-model-suggest-item");
    if (item.isActive) el.addClass("is-selected");

    const slashIdx = item.id.indexOf("/");
    const vendorPrefix =
      !item.isDefault && !item.isCustom && slashIdx > 0
        ? item.id.slice(0, slashIdx)
        : "";
    const shortModelName =
      vendorPrefix && slashIdx > 0 ? item.id.slice(slashIdx + 1) : item.label || item.id;

    const titleEl = el.createDiv({ cls: "opencode-model-suggest-title" });
    const leftEl = titleEl.createDiv({ cls: "opencode-model-suggest-left" });

    const iconEl = leftEl.createSpan({ cls: "opencode-model-suggest-icon" });
    setIcon(iconEl, item.isDefault ? "sparkles" : item.isCustom ? "edit-3" : "cpu");

    leftEl.createSpan({
      text: shortModelName,
      cls: "opencode-model-suggest-name",
    });

    const rightEl = titleEl.createDiv({ cls: "opencode-model-suggest-right" });
    if (vendorPrefix) {
      rightEl.createSpan({
        text: vendorPrefix,
        cls: "opencode-suggest-badge opencode-suggest-badge--vendor",
      });
    } else if (item.isDefault) {
      rightEl.createSpan({
        text: t("Default"),
        cls: "opencode-suggest-badge opencode-suggest-badge--accent",
      });
    } else if (item.isCustom) {
      rightEl.createSpan({
        text: t("Custom ID"),
        cls: "opencode-suggest-badge opencode-suggest-badge--accent",
      });
    }

    if (item.isActive) {
      rightEl.createSpan({ text: "✓", cls: "opencode-model-suggest-check" });
    }

    const subTextParts: string[] = [];
    if (vendorPrefix) {
      subTextParts.push(item.id);
    } else {
      subTextParts.push(item.provider);
    }
    if (item.isActive) {
      subTextParts.push(t("active model"));
    }

    el.createDiv({
      cls:
        "opencode-model-suggest-desc " +
        `opencode-model-suggest-desc--${item.engine}`,
      text: subTextParts.join(" · "),
    });
  }

  onChooseSuggestion(item: ModelItem): void {
    this.onPick(item);
  }
}
