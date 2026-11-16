import {
  App,
  Notice,
  PluginSettingTab,
  Setting,
} from "obsidian";
import type VaultAgentsPlugin from "../../main";
import {
  PromptModal,
  confirmAutoApproveModal,
} from "../../shared/modals";
import { openProviderModelPicker } from "../../shared/modelPicker";
import { substitute, type Language } from "../../i18n";
import { SETTING_BOUNDS, clampInt, type EngineType } from "../../core/types";
import type { AgentProvider } from "../../core/provider";
import { redact } from "../../core/redact";

export class VaultAgentsSettingTab extends PluginSettingTab {
  plugin: VaultAgentsPlugin;

  constructor(app: App, plugin: VaultAgentsPlugin) {
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
          const prov = this.plugin.registry.get(desc.id);
          const avail = prov?.isAvailable ? prov.isAvailable() : true;
          const prefix = avail ? "● " : "○ ";
          dd.addOption(desc.id, prefix + t(desc.displayName));
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

    const binSetting = new Setting(containerEl)
      .setName(t("Binary path"))
      .setDesc(t(activeDesc.binaryDesc))
      .addText((text) =>
        text
          .setPlaceholder(activeDesc.defaultBinary)
          .setValue(activeCfg.binary)
          .onChange((value) => {
            activeCfg.binary = value.trim() || activeDesc.defaultBinary;
            this.plugin.scheduleSaveSettings();
          })
      );

    if (activeCfg.binary && activeCfg.binary !== activeDesc.defaultBinary) {
      binSetting.addExtraButton((btn) =>
        btn
          .setIcon("rotate-ccw")
          .setTooltip(t("Reset to default"))
          .onClick(async () => {
            activeCfg.binary = activeDesc.defaultBinary;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }

    const curModel = activeCfg.model || activeDesc.defaultModel;
    const defaultLabel = substitute(
      t("(default from $1)"),
      activeDesc.shortName
    );
    const modelSetting = new Setting(containerEl)
      .setName(t("Model"))
      .setDesc(t(activeDesc.modelDesc));

    const badgeEl = modelSetting.controlEl.createSpan({
      cls:
        "opencode-settings-model-badge" +
        (curModel ? "" : " is-default"),
      text: curModel || defaultLabel,
    });
    badgeEl.setAttribute("title", curModel || defaultLabel);

    modelSetting.addButton((btn) =>
      btn
        .setButtonText(t("Select model..."))
        .setCta()
        .onClick(() => {
          void this.openProviderModelModal(activeProvider);
        })
    );

    if (activeCfg.model && activeCfg.model !== activeDesc.defaultModel) {
      modelSetting.addExtraButton((btn) =>
        btn
          .setIcon("rotate-ccw")
          .setTooltip(t("Reset to default"))
          .onClick(async () => {
            activeCfg.model = activeDesc.defaultModel;
            await this.plugin.saveSettings();
            this.display();
          })
      );
    }

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
            .onChange((value) => {
              activeCfg.options[opt.key] = value.trim();
              this.plugin.scheduleSaveSettings();
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
            new Notice(`${t("Error:")} ${redact((e as Error).message)}`);
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
            if (value && !this.plugin.settings.autoApprove) {
              toggle.setValue(false);
              confirmAutoApproveModal(this.app, this.plugin, async () => {
                this.plugin.settings.autoApprove = true;
                await this.plugin.saveSettings();
                this.display();
              });
              return;
            }
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
      .setName(t("Auto-continue on context limit"))
      .setDesc(
        t(
          "Automatically summarize and prepare a new session when context " +
            "usage exceeds 92%."
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoContinueOnLimit)
          .onChange(async (value) => {
            this.plugin.settings.autoContinueOnLimit = value;
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
          .onChange((value) => {
            this.plugin.settings.sessionId = value.trim();
            this.plugin.scheduleSaveSettings();
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
          await this.plugin.resetActiveSession();
          new Notice(
            t("Session reset: the next message will start from a new session.")
          );
          this.display();
        })
      );

    containerEl.createEl("h3", { text: t("Chat history") });

    new Setting(containerEl)
      .setName(t("Save chat history in the vault"))
      .setDesc(
        t(
          "Messages and reasoning are stored in plain text in this " +
            "plugin's data.json. Disable to keep history only for the " +
            "current session."
        )
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.saveHistory)
          .onChange(async (value) => {
            this.plugin.settings.saveHistory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Max saved sessions"))
      .setDesc(t("Older sessions are removed when this limit is exceeded."))
      .addText((text) => {
        text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.historyMaxSessions))
          .onChange((value) => {
            const trimmed = value.trim();
            if (!trimmed) return;
            const n = parseInt(trimmed, 10);
            if (!Number.isFinite(n)) return;
            this.plugin.settings.historyMaxSessions = clampInt(
              n,
              50,
              SETTING_BOUNDS.historyMaxSessions.min,
              SETTING_BOUNDS.historyMaxSessions.max
            );
            this.plugin.scheduleSaveSettings();
          });
        text.inputEl.addEventListener("blur", () => {
          text.setValue(String(this.plugin.settings.historyMaxSessions));
        });
      });

    new Setting(containerEl)
      .setName(t("Max history size (MB)"))
      .setDesc(
        t(
          "Oldest sessions are dropped when the saved history grows " +
            "beyond this size."
        )
      )
      .addText((text) => {
        const curMB = () =>
          Math.round(this.plugin.settings.historyMaxBytes / (1024 * 1024));
        text
          .setPlaceholder("5")
          .setValue(String(curMB()))
          .onChange((value) => {
            const trimmed = value.trim();
            if (!trimmed) return;
            const n = parseInt(trimmed, 10);
            if (!Number.isFinite(n)) return;
            const bytes = clampInt(
              n * 1024 * 1024,
              5 * 1024 * 1024,
              SETTING_BOUNDS.historyMaxBytes.min,
              SETTING_BOUNDS.historyMaxBytes.max
            );
            this.plugin.settings.historyMaxBytes = bytes;
            this.plugin.scheduleSaveSettings();
          });
        text.inputEl.addEventListener("blur", () => {
          text.setValue(String(curMB()));
        });
      });

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
            this.display();
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
          .onChange((value) => {
            this.plugin.settings.anydocBinary = value.trim() || "anydoc";
            this.plugin.scheduleSaveSettings();
          })
      );

    new Setting(containerEl)
      .setName(t("Send documents to hosted OCR"))
      .setDesc(
        t(
          "Upload scanned documents to the external Firecrawl Parse " +
            "service. Only enable this if you accept that the document " +
            "contents leave your machine."
        )
      )
      .setDisabled(!this.plugin.settings.anydocEnabled)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.anydocHostedOcr)
          .setDisabled(!this.plugin.settings.anydocEnabled)
          .onChange(async (value) => {
            this.plugin.settings.anydocHostedOcr = value;
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
      .addText((text) => {
        text
          .setPlaceholder("20")
          .setValue(String(this.plugin.settings.maxAttachMB))
          .onChange((value) => {
            const trimmed = value.trim();
            if (!trimmed) return;
            const n = parseInt(trimmed, 10);
            if (!Number.isFinite(n)) return;
            this.plugin.settings.maxAttachMB = clampInt(
              n,
              20,
              SETTING_BOUNDS.maxAttachMB.min,
              SETTING_BOUNDS.maxAttachMB.max
            );
            this.plugin.scheduleSaveSettings();
          });
        text.inputEl.addEventListener("blur", () => {
          text.setValue(String(this.plugin.settings.maxAttachMB));
        });
      });

    if (activeDesc.supportsDbCleanup && activeProvider.pruneOversizedParts) {
      containerEl.createEl("h3", { text: t("Database self-cleanup") });

      containerEl.createEl("p", {
        text: t(
          "Automatic cleanup on startup is disabled. Use the button below " +
            "to remove oversized file attachments from the OpenCode " +
            "database. Only attachments older than the minimum age and " +
            "larger than the max size are removed; conversation text is " +
            "never touched."
        ),
        cls: "setting-item-description",
      });

      new Setting(containerEl)
        .setName(t("Max part size (MB)"))
        .setDesc(
          t("File attachments larger than this (in the database) are removed.")
        )
        .addText((text) => {
          text
            .setPlaceholder("5")
            .setValue(String(this.plugin.settings.dbCleanupMaxMB))
            .onChange((value) => {
              const trimmed = value.trim();
              if (!trimmed) return;
              const n = parseInt(trimmed, 10);
              if (!Number.isFinite(n)) return;
              this.plugin.settings.dbCleanupMaxMB = clampInt(
                n,
                5,
                SETTING_BOUNDS.dbCleanupMaxMB.min,
                SETTING_BOUNDS.dbCleanupMaxMB.max
              );
              this.plugin.scheduleSaveSettings();
            });
          text.inputEl.addEventListener("blur", () => {
            text.setValue(String(this.plugin.settings.dbCleanupMaxMB));
          });
        });

      new Setting(containerEl)
        .setName(t("Minimum age (days)"))
        .setDesc(
          t(
            "Only attachments older than this are removed, " +
              "so recent files stay available."
          )
        )
        .addText((text) => {
          text
            .setPlaceholder("7")
            .setValue(String(this.plugin.settings.dbCleanupAgeDays))
            .onChange((value) => {
              const trimmed = value.trim();
              if (!trimmed) return;
              const n = parseInt(trimmed, 10);
              if (!Number.isFinite(n)) return;
              this.plugin.settings.dbCleanupAgeDays = clampInt(
                n,
                7,
                SETTING_BOUNDS.dbCleanupAgeDays.min,
                SETTING_BOUNDS.dbCleanupAgeDays.max
              );
              this.plugin.scheduleSaveSettings();
            });
          text.inputEl.addEventListener("blur", () => {
            text.setValue(String(this.plugin.settings.dbCleanupAgeDays));
          });
        });

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
              new Notice(`${t("Error:")} ${redact((e as Error).message)}`);
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

  private async openProviderModelModal(provider: AgentProvider): Promise<void> {
    const t = (s: string) => this.plugin.t(s);
    const cfg = this.plugin.getEngineConfig(provider.id);

    await openProviderModelPicker(this.app, this.plugin, provider, async (item) => {
      cfg.model = item.id;
      await this.plugin.saveSettings();
      this.display();
      const shownModel = item.label || item.id;
      new Notice(`${t("Model set:")} ${shownModel} (${item.provider})`);
    });
  }
}
