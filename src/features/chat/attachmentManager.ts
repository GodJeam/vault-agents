import { App, FileSystemAdapter, Notice, setIcon } from "obsidian";
import { stat } from "fs/promises";
import type OpencodePlugin from "../../main";
import type { AgentProvider } from "../../core/provider";
import { substitute } from "../../i18n";
import { FileSuggestModal } from "../../shared/modals";
import type { AttachmentItem } from "./types";

export class AttachmentManager {
  private attachmentsBar: HTMLElement;
  private attachments: AttachmentItem[] = [];

  constructor(
    container: HTMLElement,
    private app: App,
    private plugin: OpencodePlugin
  ) {
    this.attachmentsBar = container.createDiv({ cls: "opencode-attachments-bar hidden" });
    this.updateBar();
  }

  openFilePicker(): void {
    new FileSuggestModal(this.app, this.plugin, (file) => this.addAttachment(file.path)).open();
  }

  addAttachment(path: string): void {
    if (this.attachments.some((a) => a.path === path)) return;
    const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(path);
    this.attachments.push({ path, label: path, image: isImage });
    this.updateBar();
    if (isImage) {
      new Notice(
        this.plugin.t("Image attached: check that the selected model supports images (vision).")
      );
    }
  }

  async prepareAttachments(runner: AgentProvider): Promise<string[]> {
    const useAnydoc = this.plugin.settings.anydocEnabled;
    const tasks = this.attachments.map(async (a) => {
      const abs = this.resolveVaultFile(a.path);
      const resolvedPath = abs || a.path;
      if (a.image) return resolvedPath;
      if (!useAnydoc) return resolvedPath;
      const isDoc = /\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf|epub|html?)$/i.test(a.path);
      if (!isDoc) return resolvedPath;
      try {
        if (!abs) return a.path;
        return await runner.convertDocument(abs);
      } catch (e) {
        new Notice(
          `${this.plugin.t("anydoc conversion failed")}: ${a.label} (${(e as Error).message})`
        );
        const maxMB = this.plugin.settings.maxAttachMB || 20;
        try {
          if (abs) {
            const st = await stat(abs);
            if (st.size > maxMB * 1024 * 1024) {
              new Notice(
                substitute(
                  this.plugin.t(
                    "Attachment skipped: the file is larger than $1 MB and could not be converted, so it was not attached."
                  ),
                  maxMB
                )
              );
              return null;
            }
          }
        } catch {
          // ignore
        }
        return resolvedPath;
      }
    });

    const results = await Promise.all(tasks);
    return results.filter((p): p is string => typeof p === "string");
  }

  private resolveVaultFile(relPath: string): string | null {
    const adapter = this.app.vault.adapter;
    if (adapter instanceof FileSystemAdapter) {
      return adapter.getFullPath(relPath);
    }
    return null;
  }

  private updateBar(): void {
    this.attachmentsBar.empty();
    if (this.attachments.length === 0) {
      this.attachmentsBar.addClass("hidden");
      return;
    }
    this.attachmentsBar.removeClass("hidden");
    for (const a of this.attachments) {
      const chip = this.attachmentsBar.createSpan({ cls: "opencode-attachment-chip" });
      const icon = chip.createSpan({ cls: "opencode-attachment-icon" });
      setIcon(icon, a.image ? "image" : "file-text");
      chip.createSpan({ text: a.label, cls: "opencode-attachment-label" });
      const rm = chip.createEl("button", { cls: "opencode-icon-btn" });
      setIcon(rm, "x");
      rm.addEventListener("click", () => {
        this.attachments = this.attachments.filter((x) => x.path !== a.path);
        this.updateBar();
      });
    }
  }
}
