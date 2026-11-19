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
    this.setTitle(t("Rename session"));
    contentEl.empty();

    let input: HTMLInputElement | undefined;
    const submit = () => {
      if (!input) return;
      const v = input.value.trim();
      if (!v) {
        new Notice(t("The title cannot be empty."));
        return;
      }
      this.onSubmit(v);
      this.close();
    };

    new Setting(contentEl).setName(t("New title")).addText((txt) => {
      input = txt.inputEl;
      txt.setValue(this.current);
      txt.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        }
      });
      window.setTimeout(() => {
        txt.inputEl.focus();
        txt.inputEl.select();
      }, 0);
    });

    new Setting(contentEl)
      .addButton((b) =>
        b
          .setButtonText(t("Save"))
          .setCta()
          .onClick(() => submit())
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
  private closed = false;

  constructor(
    app: App,
    private plugin: VaultAgentsPlugin,
    private engine: EngineType
  ) {
    super(app);
  }

  onOpen(): void {
    this.closed = false;
    const { contentEl } = this;
    const t = (s: string) => this.plugin.t(s);
    this.setTitle(t("Token usage and costs"));
    contentEl.empty();
    const status = contentEl.createDiv({
      cls: "opencode-stats-loading",
      text: t("Loading..."),
    });

    this.plugin.registry
      .resolveProvider(this.engine)
      .getUsageStats()
      .then((s) => {
        if (this.closed) return;
        status.remove();
        this.renderWindow(contentEl, t("Last 5 hours"), s.h5);
        this.renderWindow(contentEl, t("Last week"), s.week);
        this.renderWindow(contentEl, t("Last month"), s.month);
      })
      .catch((e) => {
        if (this.closed) return;
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
    new Setting(container).setName(label).setHeading();
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
    this.closed = true;
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
    this.setTitle(this.title);
    contentEl.empty();
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

export function confirmAutoApproveModal(
  app: App,
  plugin: VaultAgentsPlugin,
  onConfirm: () => void
): void {
  const t = (s: string) => plugin.t(s);
  new ConfirmModal(
    app,
    plugin,
    t("Enable auto-approve?"),
    t(
      "With auto-approve enabled the agent can run shell commands and " +
        "edit files without asking for confirmation. Enable it only for " +
        "vaults and notes you trust."
    ),
    t("Enable"),
    onConfirm
  ).open();
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
    this.setTitle(t("Prompt"));
    contentEl.empty();

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
