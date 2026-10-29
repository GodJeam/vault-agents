import {
  App,
  DropdownComponent,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import type OpencodePlugin from "../../main";
import { PromptModal } from "../../shared/modals";
import { substitute, type Language } from "../../i18n";
import type { EngineType } from "../../core/types";
import type { AgentProvider } from "../../core/provider";

export class VaultAgentsSettingTab extends PluginSettingTab {
  plugin: OpencodePlugin;

  constructor(app: App, plugin: OpencodePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const t = (s: string) => this.plugin.t(s);
    containerEl.empty();

    containerEl.createEl("h2", { text: "Vault Agents" });

    // Language setting
    new Setting(containerEl)
      .setName(t("Language"))
      .setDesc(
        t(
          "Interface language. English is the default. " +
            "Some command names update after reloading Obsidian."
        )
      )
      .addDropdown((dd) =>
        dd
          .addOption("en", t("English"))
          .addOption("it", t("Italian"))
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            new Notice(
              t("Language changed. Reload Obsidian to apply it everywhere.")
            );
            this.display();
          })
      );

    const descriptors = this.plugin.registry.getDescriptors();
    const activeProvider = this.plugin.registry.resolveProvider(
      this.plugin.settings.engine
    );
    const activeDesc = activeProvider.descriptor;
    const activeCfg = this.plugin.getEngineConfig(activeDesc.id);

    // AI Engine selection (generated dynamically from registered descriptors)
    new Setting(containerEl)
      .setName(t("AI Engine"))
      .setDesc(
        t(
          "Select which AI backend to use. Antigravity connects directly " +
            "to your Google AI Pro subscription with no API key needed."
        )
      )
      .addDropdown((dd) => {
        for (const desc of descriptors) {
          dd.addOption(desc.id, t(desc.displayName));
        }
        dd.setValue(activeDesc.id);
        dd.onChange(async (value) => {
          this.plugin.settings.engine = value as EngineType;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    // Data-driven Engine Settings section
    const sectionTitle = substitute(
      t("$1 settings"),
      t(activeDesc.displayName)
    );
    containerEl.createEl("h3", { text: sectionTitle });

    new Setting(containerEl)
      .setName(t("Binary path"))
      .setDesc(t(activeDesc.binaryDesc))
      .addText((text) =>
        text
          .setPlaceholder(activeDesc.defaultBinary)
          .setValue(activeCfg.binary)
          .onChange(async (value) => {
            activeCfg.binary = value.trim() || activeDesc.defaultBinary;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Model"))
      .setDesc(t(activeDesc.modelDesc))
      .addDropdown((dd) => {
        void this.populateProviderModelDropdown(dd, activeProvider);
      });

    new Setting(containerEl)
      .setName(t("Custom model ID"))
      .setDesc(
        t(
          "Type any exact model ID or alias manually. Leave empty to use " +
            "the CLI's own configured default model."
        )
      )
      .addText((text) =>
        text
          .setPlaceholder(activeDesc.defaultModel || t("(CLI default)"))
          .setValue(activeCfg.model)
          .onChange(async (value) => {
            activeCfg.model = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Render descriptor-defined engine options (e.g. effort, agent, etc.)
    for (const opt of activeDesc.options) {
      const setting = new Setting(containerEl)
        .setName(t(opt.label))
        .setDesc(t(opt.desc));
      if (opt.type === "select" && opt.choices) {
        setting.addDropdown((dd) => {
          for (const ch of opt.choices!) {
            dd.addOption(ch.value, t(ch.label));
          }
          dd.setValue(activeCfg.options[opt.key] || opt.default);
          dd.onChange(async (val) => {
            activeCfg.options[opt.key] = val;
            await this.plugin.saveSettings();
          });
        });
      } else {
        setting.addText((text) =>
          text
            .setPlaceholder(opt.placeholder ? t(opt.placeholder) : "")
            .setValue(activeCfg.options[opt.key] ?? opt.default)
            .onChange(async (value) => {
              activeCfg.options[opt.key] = value.trim();
              await this.plugin.saveSettings();
            })
        );
      }
    }

    const binCmd = activeDesc.defaultBinary;
    const testDesc = substitute(
      t("Run '$1 --version' to verify the binary is reachable."),
      binCmd
    );
    const foundPrefix = substitute(
      t("$1 found:"),
      t(activeDesc.shortName)
    );

    new Setting(containerEl)
      .setName(t("Test connection"))
      .setDesc(testDesc)
      .addButton((btn) =>
        btn.setButtonText(t("Test")).onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText(t("Testing..."));
          try {
            const version = await activeProvider.getVersion();
            new Notice(`${foundPrefix} ${version}`);
          } catch (e) {
            new Notice(`${t("Error:")} ${(e as Error).message}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText(t("Test"));
          }
        })
      );

    containerEl.createEl("h3", { text: t("General settings") });

    new Setting(containerEl)
      .setName(t("Auto-approve permissions"))
      .setDesc(
        t(
          "Automatically allow tool permissions (bash, file edits, etc.). " +
            "Turn it off for extra safety."
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoApprove)
          .onChange(async (value) => {
            this.plugin.settings.autoApprove = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Show reasoning"))
      .setDesc(t("Show the model's reasoning blocks."))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showThinking)
          .onChange(async (value) => {
            this.plugin.settings.showThinking = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Show tool details"))
      .setDesc(
        t(
          "Show the input and output of every tool executed during " +
            "the request, in collapsible blocks."
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showToolIO)
          .onChange(async (value) => {
            this.plugin.settings.showToolIO = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Session ID"))
      .setDesc(
        t(
          "The persistent session id used for the chat. Managed " +
            "automatically. Empty = new session on next message."
        )
      )
      .addText((text) =>
        text
          .setPlaceholder(t("(automatic)"))
          .setValue(this.plugin.settings.sessionId)
          .onChange(async (value) => {
            this.plugin.settings.sessionId = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Reset session"))
      .setDesc(
        t(
          "Clear the saved session and start from scratch " +
            "on the next message."
        )
      )
      .addButton((btn) =>
        btn.setButtonText(t("Reset")).onClick(async () => {
          this.plugin.settings.sessionId = "";
          await this.plugin.saveSettings();
          new Notice(
            t("Session reset: the next message will start from a new session.")
          );
        })
      );

    containerEl.createEl("h3", { text: t("Document conversion") });

    new Setting(containerEl)
      .setName(t("Convert documents with anydoc"))
      .setDesc(
        t(
          "Run anydoc on attached documents (PDF, Word, Excel, etc.) and " +
            "attach them as Markdown instead of the original file."
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.anydocEnabled)
          .onChange(async (value) => {
            this.plugin.settings.anydocEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Anydoc binary path"))
      .setDesc(
        t(
          "Command or full path to the anydoc executable " +
            "(npm install -g @firecrawl/anydoc)."
        )
      )
      .addText((text) =>
        text
          .setPlaceholder("anydoc")
          .setValue(this.plugin.settings.anydocBinary)
          .onChange(async (value) => {
            this.plugin.settings.anydocBinary = value.trim() || "anydoc";
            await this.plugin.saveSettings();
          })
      );

    if (activeDesc.supportsDbCleanup && activeProvider.pruneOversizedParts) {
      containerEl.createEl("h3", { text: t("Database self-cleanup") });

      new Setting(containerEl)
        .setName(t("Enable automatic cleanup"))
        .setDesc(
          t(
            "Periodically remove large file attachments from the opencode " +
              "database (opencode.db), which would otherwise bloat it. Only " +
              "file attachments older than the minimum age and larger than " +
              "the max size are removed; conversation text is never touched."
          )
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.dbAutoCleanup)
            .onChange(async (value) => {
              this.plugin.settings.dbAutoCleanup = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Max part size (MB)"))
        .setDesc(
          t("File attachments larger than this (in the database) are removed.")
        )
        .addText((text) =>
          text
            .setPlaceholder("5")
            .setValue(String(this.plugin.settings.dbCleanupMaxMB))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              const val = Number.isFinite(n) && n > 0 ? n : 5;
              this.plugin.settings.dbCleanupMaxMB = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Minimum age (days)"))
        .setDesc(
          t(
            "Only attachments older than this are removed, " +
              "so recent files stay available."
          )
        )
        .addText((text) =>
          text
            .setPlaceholder("7")
            .setValue(String(this.plugin.settings.dbCleanupAgeDays))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              const val = Number.isFinite(n) && n >= 0 ? n : 7;
              this.plugin.settings.dbCleanupAgeDays = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Max attachment size (MB)"))
        .setDesc(
          t(
            "When anydoc fails to convert a document, files larger than this " +
              "are not attached to the request, to avoid storing unusable " +
              "copies in the database."
          )
        )
        .addText((text) =>
          text
            .setPlaceholder("20")
            .setValue(String(this.plugin.settings.maxAttachMB))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              const val = Number.isFinite(n) && n > 0 ? n : 20;
              this.plugin.settings.maxAttachMB = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Run cleanup now"))
        .setDesc(
          t("Remove oversized file attachments immediately, regardless of age.")
        )
        .addButton((btn) =>
          btn.setButtonText(t("Cleanup")).onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t("Cleaning..."));
            try {
              await activeProvider.pruneOversizedParts?.(true, true);
              new Notice(t("Cleanup done."));
            } catch (e) {
              new Notice(`${t("Error:")} ${(e as Error).message}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t("Cleanup"));
            }
          })
        );
    }

    containerEl.createEl("h3", { text: t("Prompt templates") });
    containerEl.createEl("p", {
      text: t(
        "Save reusable prompt templates. In the chat, type /prompt " +
          "to quickly insert them into the composer."
      ),
      cls: "setting-item-description",
    });

    const prompts = this.plugin.settings.prompts ?? [];
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const desc = p.text.length > 90 ? p.text.slice(0, 87) + "…" : p.text;
      const s = new Setting(containerEl)
        .setName(p.name || t("(untitled)"))
        .setDesc(desc);
      s.addButton((b) =>
        b.setButtonText(t("Edit")).onClick(() => this.editPrompt(i))
      );
      s.addButton((b) =>
        b
          .setButtonText(t("Delete"))
          .setWarning()
          .onClick(async () => {
            prompts.splice(i, 1);
            this.plugin.settings.prompts = prompts;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }
    new Setting(containerEl).addButton((b) =>
      b
        .setButtonText(t("Add prompt"))
        .setCta()
        .onClick(() => this.editPrompt(-1))
    );
  }

  private editPrompt(index: number): void {
    const prompts = this.plugin.settings.prompts ?? [];
    const existing = index >= 0 ? prompts[index] : null;
    new PromptModal(
      this.app,
      this.plugin,
      existing ? existing.name : "",
      existing ? existing.text : "",
      (name, text) => {
        if (existing) {
          existing.name = name;
          existing.text = text;
        } else {
          prompts.push({ name, text });
        }
        void this.plugin.saveSettings();
        this.display();
      }
    ).open();
  }

  private async populateProviderModelDropdown(
    dd: DropdownComponent,
    provider: AgentProvider
  ): Promise<void> {
    const t = (s: string) => this.plugin.t(s);
    const desc = provider.descriptor;
    const cfg = this.plugin.getEngineConfig(desc.id);
    const cur = cfg.model || desc.defaultModel;
    const seen = new Set<string>();
    const addOption = (val: string, display: string) => {
      if (seen.has(val)) return;
      seen.add(val);
      dd.addOption(val, display);
    };

    if (!desc.included) {
      addOption("", substitute(t("(default from $1)"), desc.shortName));
    }
    if (cur) {
      addOption(cur, cur);
    }

    try {
      const models = await provider.listModels();
      for (const m of models) addOption(m, m);
      dd.setValue(cur || "");
    } catch (e) {
      if (desc.defaultModel) {
        addOption(desc.defaultModel, desc.defaultModel);
      }
      const opt = dd.selectEl.createEl("option");
      opt.value = "__error__";
      opt.textContent = `${t("Error:")} ${(e as Error).message}`;
      opt.disabled = true;
      dd.setValue(cur || desc.defaultModel || "");
    }

    dd.onChange(async (val) => {
      cfg.model = val;
      await this.plugin.saveSettings();
      this.display();
    });
  }
}

/** Backward compatibility alias */
export { VaultAgentsSettingTab as OpencodeSettingTab };
