import { App, Modal, Notice, Setting, SuggestModal } from "obsidian";
import type { TFile } from "obsidian";
import type OpencodePlugin from "../main";
import type { UsageWindow, EngineType } from "../core/types";

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
        b.setButtonText(t("Save")).setCta().onClick(() => {
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
      .addButton((b) => b.setButtonText(t("Cancel")).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class StatsModal extends Modal {
  constructor(app: App, private plugin: OpencodePlugin) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    contentEl.empty();
    contentEl.createEl("h3", { text: t("Token usage and costs") });
    const status = contentEl.createDiv({ cls: "opencode-stats-loading", text: t("Loading...") });

    this.plugin.runner
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

  private renderWindow(container: HTMLElement, label: string, w: UsageWindow): void {
    const locale = this.plugin.settings.language === "it" ? "it-IT" : "en-US";
    const t = (s: string) => this.plugin.t(s);
    container.createEl("h4", { text: label });
    new Setting(container).setName(t("Input tokens")).setDesc(w.input.toLocaleString(locale));
    new Setting(container).setName(t("Output tokens")).setDesc(w.output.toLocaleString(locale));
    new Setting(container)
      .setName(t("Total tokens"))
      .setDesc((w.input + w.output).toLocaleString(locale));
    const isAgy = this.plugin.settings.engine === "antigravity";
    const costDesc = isAgy ? t("Included with Google AI Pro ($0.00)") : `${w.cost.toFixed(4)} $`;
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
    contentEl.createDiv({ cls: "opencode-confirm-message", text: this.message });
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
      .addButton((b) => b.setButtonText(t("Cancel")).onClick(() => this.close()));
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
        b.setButtonText(t("Save")).setCta().onClick(() => {
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
      .addButton((b) => b.setButtonText(t("Cancel")).onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class FileSuggestModal extends SuggestModal<TFile> {
  private items: TFile[] | null = null;

  constructor(app: App, private plugin: OpencodePlugin, private onPick: (file: TFile) => void) {
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
      this.items = this.app.vault.getFiles().sort((a, b) => a.path.localeCompare(b.path));
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

export interface ModelItem {
  id: string;
  engine: EngineType;
  provider: string;
  isActive: boolean;
}

export class ModelSuggestModal extends SuggestModal<ModelItem> {
  constructor(
    app: App,
    private plugin: OpencodePlugin,
    private items: ModelItem[],
    private onPick: (item: ModelItem) => void
  ) {
    super(app);
    const t = (s: string) => this.plugin.t(s);
    this.setPlaceholder(t("Search models... (e.g. gemini, claude, flash, deepseek)"));
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
    const q = query.trim().toLowerCase();
    if (!q) {
      return this.items.slice(0, 30);
    }
    const filtered = this.items.filter((item) =>
      item.id.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q) ||
      item.engine.toLowerCase().includes(q)
    );
    return filtered.slice(0, 30);
  }

  renderSuggestion(item: ModelItem, el: HTMLElement): void {
    el.addClass("opencode-model-suggest-item");
    const titleEl = el.createDiv({ cls: "opencode-model-suggest-title" });
    titleEl.createSpan({ text: item.id, cls: "opencode-model-suggest-name" });
    if (item.isActive) {
      titleEl.createSpan({ text: "  ✓", cls: "opencode-model-suggest-check" });
    }
    el.createDiv({
      cls: `opencode-model-suggest-desc opencode-model-suggest-desc--${item.engine}`,
      text: item.provider + (item.isActive ? ` · ${this.plugin.t("active model")}` : ""),
    });
  }

  onChooseSuggestion(item: ModelItem): void {
    this.onPick(item);
  }
}
