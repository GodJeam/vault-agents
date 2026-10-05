import { App, DropdownComponent, Notice, PluginSettingTab, Setting } from "obsidian";
import type OpencodePlugin from "../../main";
import { PromptModal } from "../../shared/modals";
import type { Language } from "../../i18n";
import type { EngineType } from "../../core/types";
import { DEFAULT_SETTINGS } from "../../core/types";

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
      .setDesc(t("Interface language. English is the default. Some command names update after reloading Obsidian."))
      .addDropdown((dd) =>
        dd
          .addOption("en", t("English"))
          .addOption("it", t("Italian"))
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            new Notice(t("Language changed. Reload Obsidian to apply it everywhere."));
            this.display();
          })
      );

    // AI Engine selection
    new Setting(containerEl)
      .setName(t("AI Engine"))
      .setDesc(t("Select which AI backend to use. Antigravity connects directly to your Google AI Pro subscription with no API key needed."))
      .addDropdown((dd) =>
        dd
          .addOption("antigravity", t("Antigravity CLI (Google AI Pro)"))
          .addOption("opencode", t("OpenCode CLI"))
          .setValue(this.plugin.settings.engine || "antigravity")
          .onChange(async (value) => {
            this.plugin.settings.engine = value as EngineType;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    const isAntigravity = this.plugin.settings.engine === "antigravity";

    if (isAntigravity) {
      containerEl.createEl("h3", { text: t("Antigravity settings (Google AI Pro)") });

      new Setting(containerEl)
        .setName(t("Antigravity binary path"))
        .setDesc(t("Command or full path to the agy executable. Default is 'agy' or '~/.local/bin/agy'."))
        .addText((text) =>
          text
            .setPlaceholder("agy")
            .setValue(this.plugin.settings.antigravityBinary)
            .onChange(async (value) => {
              this.plugin.settings.antigravityBinary = value.trim() || "agy";
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Model"))
        .setDesc(t("Pick a model from Antigravity (Gemini 3.8/3.7/3.1, Claude Sonnet 4.6). Included with Google AI Pro."))
        .addDropdown((dd) => {
          void this.populateAntigravityModelDropdown(dd);
        });

      new Setting(containerEl)
        .setName(t("Reasoning effort"))
        .setDesc(t("Effort level for reasoning models like Gemini 3.8/3.7 Flash and Claude Thinking."))
        .addDropdown((dd) =>
          dd
            .addOption("low", t("Low"))
            .addOption("medium", t("Medium"))
            .addOption("high", t("High"))
            .addOption("max", t("Max"))
            .setValue(this.plugin.settings.antigravityEffort || "high")
            .onChange(async (val) => {
              this.plugin.settings.antigravityEffort = val as "low" | "medium" | "high" | "max";
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Test connection"))
        .setDesc(t("Run 'agy --version' to verify the binary is reachable."))
        .addButton((btn) =>
          btn.setButtonText(t("Test")).onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t("Testing..."));
            try {
              const provider = this.plugin.registry.get("antigravity");
              const version = provider ? await provider.getVersion() : await this.plugin.antigravityRunner.getVersion();
              new Notice(`${t("Antigravity found:")} ${version}`);
            } catch (e) {
              new Notice(`${t("Error:")} ${(e as Error).message}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t("Test"));
            }
          })
        );
    } else {
      containerEl.createEl("h3", { text: t("OpenCode settings") });

      new Setting(containerEl)
        .setName(t("Binary path"))
        .setDesc(t("Command or full path to the opencode executable. Usually 'opencode' is enough if it is on your PATH."))
        .addText((text) =>
          text
            .setPlaceholder("opencode")
            .setValue(this.plugin.settings.binaryPath)
            .onChange(async (value) => {
              this.plugin.settings.binaryPath = value.trim() || "opencode";
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Model"))
        .setDesc(t("Pick a model from the opencode list. Default uses the OpenCode Go provider."))
        .addDropdown((dd) => {
          void this.populateOpencodeModelDropdown(dd);
        });

      new Setting(containerEl)
        .setName(t("Agent"))
        .setDesc(t("The opencode agent to use (e.g. build, plan). Leave empty for the default."))
        .addText((text) =>
          text
            .setPlaceholder(t("e.g. build"))
            .setValue(this.plugin.settings.agent)
            .onChange(async (value) => {
              this.plugin.settings.agent = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Test connection"))
        .setDesc(t("Run 'opencode --version' to verify the binary is reachable."))
        .addButton((btn) =>
          btn.setButtonText(t("Test")).onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t("Testing..."));
            try {
              const provider = this.plugin.registry.get("opencode");
              const version = provider ? await provider.getVersion() : await this.plugin.opencodeRunner.getVersion();
              new Notice(`${t("Opencode found:")} ${version}`);
            } catch (e) {
              new Notice(`${t("Error:")} ${(e as Error).message}`);
            } finally {
              btn.setDisabled(false);
              btn.setButtonText(t("Test"));
            }
          })
        );
    }

    containerEl.createEl("h3", { text: t("General settings") });

    new Setting(containerEl)
      .setName(t("Auto-approve permissions"))
      .setDesc(t("Automatically allow tool permissions (bash, file edits, etc.). Turn it off for extra safety."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoApprove).onChange(async (value) => {
          this.plugin.settings.autoApprove = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("Show reasoning"))
      .setDesc(t("Show the model's reasoning blocks."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showThinking).onChange(async (value) => {
          this.plugin.settings.showThinking = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("Show tool details"))
      .setDesc(t("Show the input and output of every tool executed during the request, in collapsible blocks."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToolIO).onChange(async (value) => {
          this.plugin.settings.showToolIO = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("Session ID"))
      .setDesc(t("The persistent session id used for the chat. Managed automatically. Empty = new session on next message."))
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
      .setDesc(t("Clear the saved session and start from scratch on the next message."))
      .addButton((btn) =>
        btn.setButtonText(t("Reset")).onClick(async () => {
          this.plugin.settings.sessionId = "";
          await this.plugin.saveSettings();
          new Notice(t("Session reset: the next message will start from a new session."));
        })
      );

    containerEl.createEl("h3", { text: t("Document conversion") });

    new Setting(containerEl)
      .setName(t("Convert documents with anydoc"))
      .setDesc(t("Run anydoc on attached documents (PDF, Word, Excel, etc.) and attach them as Markdown instead of the original file."))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.anydocEnabled).onChange(async (value) => {
          this.plugin.settings.anydocEnabled = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t("Anydoc binary path"))
      .setDesc(t("Command or full path to the anydoc executable (npm install -g @firecrawl/anydoc)."))
      .addText((text) =>
        text
          .setPlaceholder("anydoc")
          .setValue(this.plugin.settings.anydocBinary)
          .onChange(async (value) => {
            this.plugin.settings.anydocBinary = value.trim() || "anydoc";
            await this.plugin.saveSettings();
          })
      );

    if (!isAntigravity) {
      containerEl.createEl("h3", { text: t("Database self-cleanup") });

      new Setting(containerEl)
        .setName(t("Enable automatic cleanup"))
        .setDesc(t("Periodically remove large file attachments from the opencode database (opencode.db), which would otherwise bloat it. Only file attachments older than the minimum age and larger than the max size are removed; conversation text is never touched."))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.dbAutoCleanup).onChange(async (value) => {
            this.plugin.settings.dbAutoCleanup = value;
            await this.plugin.saveSettings();
          })
        );

      new Setting(containerEl)
        .setName(t("Max part size (MB)"))
        .setDesc(t("File attachments larger than this (in the database) are removed."))
        .addText((text) =>
          text
            .setPlaceholder("5")
            .setValue(String(this.plugin.settings.dbCleanupMaxMB))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              this.plugin.settings.dbCleanupMaxMB = Number.isFinite(n) && n > 0 ? n : 5;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Minimum age (days)"))
        .setDesc(t("Only attachments older than this are removed, so recent files stay available."))
        .addText((text) =>
          text
            .setPlaceholder("7")
            .setValue(String(this.plugin.settings.dbCleanupAgeDays))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              this.plugin.settings.dbCleanupAgeDays = Number.isFinite(n) && n >= 0 ? n : 7;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Max attachment size (MB)"))
        .setDesc(t("When anydoc fails to convert a document, files larger than this are not attached to the request, to avoid storing unusable copies in the database."))
        .addText((text) =>
          text
            .setPlaceholder("20")
            .setValue(String(this.plugin.settings.maxAttachMB))
            .onChange(async (value) => {
              const n = parseInt(value, 10);
              this.plugin.settings.maxAttachMB = Number.isFinite(n) && n > 0 ? n : 20;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName(t("Run cleanup now"))
        .setDesc(t("Remove oversized file attachments immediately, regardless of age."))
        .addButton((btn) =>
          btn.setButtonText(t("Cleanup")).onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText(t("Cleaning..."));
            try {
              await this.plugin.opencodeRunner.pruneOversizedParts(true, true);
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
      text: t("Save reusable prompt templates. In the chat, type /prompt to quickly insert them into the composer."),
      cls: "setting-item-description",
    });

    const prompts = this.plugin.settings.prompts ?? [];
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      const s = new Setting(containerEl)
        .setName(p.name || t("(untitled)"))
        .setDesc(p.text.length > 90 ? p.text.slice(0, 87) + "…" : p.text);
      s.addButton((b) => b.setButtonText(t("Edit")).onClick(() => this.editPrompt(i)));
      s.addButton((b) =>
        b.setButtonText(t("Delete")).setWarning().onClick(async () => {
          prompts.splice(i, 1);
          this.plugin.settings.prompts = prompts;
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }
    new Setting(containerEl).addButton((b) =>
      b.setButtonText(t("Add prompt")).setCta().onClick(() => this.editPrompt(-1))
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

  private async populateAntigravityModelDropdown(dd: DropdownComponent): Promise<void> {
    const cur = this.plugin.settings.antigravityModel || "gemini-3.8-flash-high";
    const seen = new Set<string>();
    const addOption = (val: string, display: string) => {
      if (seen.has(val)) return;
      seen.add(val);
      dd.addOption(val, display);
    };
    try {
      const provider = this.plugin.registry.get("antigravity");
      const models = provider ? await provider.listModels() : await this.plugin.antigravityRunner.listModels();
      for (const m of models) addOption(m, m);
    } catch {
      addOption("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)");
      addOption("gemini-3.1-pro-high", "Gemini 3.1 Pro (High)");
      addOption("claude-sonnet-4-6", "Claude Sonnet 4.6 (Thinking)");
    }
    dd.setValue(cur);
    dd.onChange(async (val) => {
      this.plugin.settings.antigravityModel = val;
      this.plugin.settings.model = val;
      await this.plugin.saveSettings();
    });
  }

  private async populateOpencodeModelDropdown(dd: DropdownComponent): Promise<void> {
    const t = (s: string) => this.plugin.t(s);
    const cur = this.plugin.settings.model || DEFAULT_SETTINGS.model;
    const seen = new Set<string>();
    const addOption = (val: string, display: string) => {
      if (seen.has(val)) return;
      seen.add(val);
      dd.addOption(val, display);
    };
    addOption("", t("(default from opencode)"));
    if (cur) addOption(cur, cur + (cur.includes("/") ? "" : ` ${t("(custom)")}`));
    try {
      const provider = this.plugin.registry.get("opencode");
      const models = provider ? await provider.listModels() : await this.plugin.opencodeRunner.listModels();
      for (const m of models) addOption(m, m);
      dd.setValue(cur || "");
    } catch (e) {
      const opt = dd.selectEl.createEl("option");
      opt.value = "__error__";
      opt.textContent = `${t("Error:")} ${(e as Error).message}`;
      opt.disabled = true;
      dd.setValue(cur || "");
    }
    dd.onChange(async (val) => {
      this.plugin.settings.model = val;
      await this.plugin.saveSettings();
    });
  }
}

/** Backward compatibility alias */
export { VaultAgentsSettingTab as OpencodeSettingTab };
