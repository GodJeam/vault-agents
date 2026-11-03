import { App, Modal, Notice, Setting } from "obsidian";
import type VaultAgentsPlugin from "../main";
import type { UsageWindow, EngineType } from "../core/types";
import { substitute } from "../i18n";
import { redact } from "../core/redact";

export {
  FileSuggestModal,
  AgentSuggestModal,
  ModelSuggestModal,
  type AgentItem,
  type ModelItem,
} from "./suggestModals";

export class RenameModal extends Modal {
  constructor(
    app: App,
    private plugin: VaultAgentsPlugin,
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
    private plugin: VaultAgentsPlugin,
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
        status.setText(`${t("Error:")} ${redact((e as Error).message)}`);
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
    private plugin: VaultAgentsPlugin,
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
    private plugin: VaultAgentsPlugin,
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
