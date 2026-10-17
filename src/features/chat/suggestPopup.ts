import type { App } from "obsidian";
import type OpencodePlugin from "../../main";
import type { SuggestItem } from "./types";

const MAX_SUGGEST = 50;

export interface SuggestPopupCallbacks {
  onOpenModelList: () => void;
  onStartNewSession: () => void;
  onAttachCurrentNote: () => void;
  onOpenFilePicker: () => void;
  onOpenStats: () => void;
  onTogglePin: () => void;
  onRenameSession: () => void;
  onAddAttachment: (path: string) => void;
}

export class SuggestPopup {
  private suggestEl: HTMLElement;
  private suggestItems: SuggestItem[] = [];
  private suggestRows: HTMLElement[] = [];
  private suggestIndex = 0;
  private suggestOpen = false;
  private suggestTrigger: { char: string; start: number } | null = null;
  private vaultPaths: string[] | null = null;
  private vaultPathsLower: string[] | null = null;

  constructor(
    container: HTMLElement,
    private inputEl: HTMLTextAreaElement,
    private app: App,
    private plugin: OpencodePlugin,
    private cb: SuggestPopupCallbacks
  ) {
    this.suggestEl = container.createDiv({ cls: "opencode-suggest hidden" });
  }

  isOpen(): boolean {
    return this.suggestOpen;
  }

  invalidateVaultCache(): void {
    this.vaultPaths = null;
    this.vaultPathsLower = null;
  }

  handleKeydown(e: KeyboardEvent): boolean {
    if (!this.suggestOpen) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.suggestIndex = Math.min(this.suggestIndex + 1, this.suggestItems.length - 1);
      this.highlightSuggest();
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.suggestIndex = Math.max(this.suggestIndex - 1, 0);
      this.highlightSuggest();
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      this.chooseSuggest(this.suggestIndex);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return true;
    }
    return false;
  }

  onInputChange(): void {
    if (this.suggestOpen && !this.suggestTrigger) {
      this.close();
    }
    const tr = this.detectTrigger();
    if (!tr) {
      this.close();
      return;
    }
    const items = this.buildSuggestItems(tr.char, tr.query);
    if (items.length === 0) {
      this.close();
      return;
    }
    this.suggestTrigger = { char: tr.char, start: tr.start };
    this.suggestItems = items;
    this.suggestIndex = 0;
    this.suggestOpen = true;
    this.renderSuggest();
  }

  close(): void {
    this.suggestOpen = false;
    this.suggestTrigger = null;
    this.suggestItems = [];
    this.suggestRows = [];
    this.suggestIndex = 0;
    this.suggestEl.addClass("hidden");
    this.suggestEl.empty();
  }

  private detectTrigger(): { char: string; start: number; query: string } | null {
    const v = this.inputEl.value;
    const pos = this.inputEl.selectionStart ?? v.length;

    // Special case: `/prompt <filter>` allows a space after `/prompt`
    const beforeCursor = v.slice(0, pos);
    const promptMatch = beforeCursor.match(/(?:^|\s)(\/prompt(?::|\s+)([^\n]*))$/i);
    if (promptMatch && promptMatch.index !== undefined) {
      const fullMatch = promptMatch[0];
      const leadingWs = fullMatch.length - promptMatch[1].length;
      const start = promptMatch.index + leadingWs;
      return {
        char: "/",
        start,
        query: "prompt:" + (promptMatch[2] ?? "").toLowerCase(),
      };
    }

    let i = pos - 1;
    while (i >= 0 && !/\s/.test(v[i])) i--;
    const start = i + 1;
    const token = v.slice(start, pos);
    if (!token) return null;
    const ch = token[0];
    if (ch !== "/" && ch !== "@" && ch !== "!") return null;
    return { char: ch, start, query: token.slice(1).toLowerCase() };
  }

  private buildSuggestItems(char: string, query: string): SuggestItem[] {
    const q = query.toLowerCase();
    if (char === "/") {
      if (q === "prompt" || q.startsWith("prompt:") || q.startsWith("prompt ")) {
        const sub = q.startsWith("prompt") ? query.slice(6).replace(/^[:\s]+/, "") : "";
        return this.promptItems(sub);
      }
      return this.filterItems(this.commandItems(), q);
    }
    if (char === "@") {
      return this.fileItems(query);
    }
    return this.filterItems(this.actionItems(), q);
  }

  private filterItems(items: SuggestItem[], q: string): SuggestItem[] {
    if (!q) return items;
    return items.filter(
      (x) => x.label.toLowerCase().includes(q) || (x.desc ?? "").toLowerCase().includes(q)
    );
  }

  private promptItems(sub: string): SuggestItem[] {
    const prompts = this.plugin.settings.prompts ?? [];
    if (prompts.length === 0) {
      return [
        {
          label: "/prompt",
          desc: this.plugin.t("No saved prompts — add them in Settings"),
          action: () => this.removeTrigger(),
        },
      ];
    }
    const q = sub.trim().toLowerCase();
    const list = q ? prompts.filter((p) => p.name.toLowerCase().includes(q)) : prompts;
    return list.map((p) => ({
      label: p.name,
      desc: p.text.length > 80 ? p.text.slice(0, 77) + "…" : p.text,
      action: () => this.replaceTriggerWith(p.text),
    }));
  }

  private replaceTriggerWith(text: string): void {
    const tr = this.suggestTrigger;
    if (tr) {
      const v = this.inputEl.value;
      const end = this.inputEl.selectionStart ?? v.length;
      this.inputEl.value = v.slice(0, tr.start) + text + v.slice(end);
      const pos = tr.start + text.length;
      this.inputEl.setSelectionRange(pos, pos);
    }
    this.close();
    this.inputEl.focus();
  }

  private startPromptSelection(): void {
    const tr = this.suggestTrigger;
    if (tr) {
      const v = this.inputEl.value;
      const end = this.inputEl.selectionStart ?? v.length;
      const token = "/prompt:";
      this.inputEl.value = v.slice(0, tr.start) + token + v.slice(end);
      const pos = tr.start + token.length;
      this.inputEl.setSelectionRange(pos, pos);
    } else {
      this.inputEl.value = "/prompt:";
      this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
    }
    this.inputEl.focus();
    this.onInputChange();
  }

  private commandItems(): SuggestItem[] {
    return [
      {
        label: this.plugin.t("/model"),
        desc: this.plugin.t("Change the model"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenModelList();
        },
      },
      {
        label: this.plugin.t("/new"),
        desc: this.plugin.t("New session"),
        action: () => {
          this.removeTrigger();
          this.cb.onStartNewSession();
        },
      },
      {
        label: this.plugin.t("/note"),
        desc: this.plugin.t("Attach the current note"),
        action: () => {
          this.removeTrigger();
          this.cb.onAttachCurrentNote();
        },
      },
      {
        label: this.plugin.t("/attach"),
        desc: this.plugin.t("Attach a file"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenFilePicker();
        },
      },
      {
        label: this.plugin.t("/stats"),
        desc: this.plugin.t("Token and cost statistics"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenStats();
        },
      },
      {
        label: this.plugin.t("/pin"),
        desc: this.plugin.t("Pin/Unpin session"),
        action: () => {
          this.removeTrigger();
          this.cb.onTogglePin();
        },
      },
      {
        label: this.plugin.t("/rename"),
        desc: this.plugin.t("Rename session"),
        action: () => {
          this.removeTrigger();
          this.cb.onRenameSession();
        },
      },
      {
        label: this.plugin.t("/prompt"),
        desc: this.plugin.t("Insert a saved prompt"),
        action: () => {
          this.startPromptSelection();
        },
      },
    ];
  }

  private fileItems(query: string): SuggestItem[] {
    if (!this.vaultPaths) {
      this.vaultPaths = this.app.vault
        .getFiles()
        .map((f) => f.path)
        .sort((a, b) => a.localeCompare(b));
      this.vaultPathsLower = this.vaultPaths.map((p) => p.toLowerCase());
    }
    const paths = this.vaultPaths;
    const lower = this.vaultPathsLower ?? [];
    const q = query.toLowerCase();
    const desc = this.plugin.t("Attached");
    const items: SuggestItem[] = [];
    for (let i = 0; i < paths.length && items.length < MAX_SUGGEST; i++) {
      if (q && !lower[i].includes(q)) continue;
      const p = paths[i];
      items.push({
        label: p,
        desc,
        action: () => {
          this.removeTrigger();
          this.cb.onAddAttachment(p);
        },
      });
    }
    return items;
  }

  private actionItems(): SuggestItem[] {
    return [
      {
        label: this.plugin.t("current note"),
        desc: this.plugin.t("Attach the open note as context"),
        action: () => {
          this.removeTrigger();
          this.cb.onAttachCurrentNote();
        },
      },
      {
        label: this.plugin.t("attach file"),
        desc: this.plugin.t("Pick a file to attach"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenFilePicker();
        },
      },
      {
        label: this.plugin.t("new session"),
        desc: this.plugin.t("Start from an empty session"),
        action: () => {
          this.removeTrigger();
          this.cb.onStartNewSession();
        },
      },
      {
        label: this.plugin.t("statistics"),
        desc: this.plugin.t("Tokens and costs (5h, week, month)"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenStats();
        },
      },
      {
        label: this.plugin.t("pin/unpin session"),
        desc: this.plugin.t("Pin the session in the list"),
        action: () => {
          this.removeTrigger();
          this.cb.onTogglePin();
        },
      },
      {
        label: this.plugin.t("active model"),
        desc: this.plugin.t("Change the model"),
        action: () => {
          this.removeTrigger();
          this.cb.onOpenModelList();
        },
      },
    ];
  }

  private renderSuggest(): void {
    this.suggestEl.empty();
    this.suggestRows = [];
    if (this.suggestItems.length === 0) {
      this.close();
      return;
    }
    this.suggestEl.removeClass("hidden");
    for (let i = 0; i < this.suggestItems.length; i++) {
      const it = this.suggestItems[i];
      const row = this.suggestEl.createDiv({ cls: "opencode-suggest-item" });
      row.createDiv({ text: it.label, cls: "opencode-suggest-label" });
      if (it.desc) {
        row.createDiv({ text: it.desc, cls: "opencode-suggest-desc" });
      }
      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.chooseSuggest(i);
      });
      this.suggestRows.push(row);
    }
    this.highlightSuggest();
  }

  private highlightSuggest(): void {
    for (let i = 0; i < this.suggestRows.length; i++) {
      // Matches `.opencode-suggest-item.is-active` in styles.css
      this.suggestRows[i].toggleClass("is-active", i === this.suggestIndex);
    }
    const current = this.suggestRows[this.suggestIndex];
    if (current) current.scrollIntoView({ block: "nearest" });
  }

  private chooseSuggest(index: number): void {
    const item = this.suggestItems[index];
    if (item) item.action();
  }

  private removeTrigger(): void {
    const tr = this.suggestTrigger;
    if (!tr) return;
    const v = this.inputEl.value;
    const end = this.inputEl.selectionStart ?? v.length;
    this.inputEl.value = v.slice(0, tr.start) + v.slice(end);
    const pos = Math.min(tr.start, this.inputEl.value.length);
    this.inputEl.setSelectionRange(pos, pos);
    this.close();
    this.inputEl.focus();
  }
}
