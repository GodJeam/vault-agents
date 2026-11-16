import { App, Modal, Notice, SuggestModal, setIcon } from "obsidian";
import type { TFile } from "obsidian";
import type VaultAgentsPlugin from "../main";
import type { EngineType } from "../core/types";
import { substitute } from "../i18n";
import { redact } from "../core/redact";
import { renderAgentIcon } from "./agentIcons";

export class FileSuggestModal extends SuggestModal<TFile> {
  private items: TFile[] | null = null;

  constructor(
    app: App,
    private plugin: VaultAgentsPlugin,
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
  icon: string;
  binary: string;
  activeModel: string;
  installed: boolean;
  isActive: boolean;
}

export class AgentSuggestModal extends SuggestModal<AgentItem> {
  constructor(
    app: App,
    private plugin: VaultAgentsPlugin,
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
    renderAgentIcon(iconEl, item.icon || "bot");

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

/**
 * Compute a positive score if all whitespace-separated query tokens match
 * `haystack` (either by substring or ordered fuzzy character match), else -1.
 */
export function fuzzyMatchScore(query: string, haystack: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = haystack.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  let score = 0;

  for (const tok of tokens) {
    const subIdx = hay.indexOf(tok);
    if (subIdx >= 0) {
      score += 100 - Math.min(subIdx, 50);
      continue;
    }
    let ti = 0;
    let firstMatch = -1;
    let streak = 0;
    for (let hi = 0; hi < hay.length && ti < tok.length; hi++) {
      if (hay[hi] === tok[ti]) {
        if (firstMatch < 0) firstMatch = hi;
        ti++;
        streak++;
        score += 2 + streak;
      } else {
        streak = 0;
      }
    }
    if (ti < tok.length) return -1;
    score -= Math.min(firstMatch, 30);
  }
  return Math.max(1, score);
}

function modelGroupKey(item: ModelItem): string {
  if (item.isDefault) return "__default__";
  if (item.isCustom) return "__custom__";
  const slash = item.id.indexOf("/");
  if (slash > 0) return item.id.slice(0, slash);
  return item.provider || "__other__";
}

export class ModelSuggestModal extends Modal {
  private searchInput!: HTMLInputElement;
  private chipsEl!: HTMLElement;
  private listEl!: HTMLElement;
  private refreshBtn: HTMLButtonElement | null = null;
  private query = "";
  private activeFilter = "all";
  private collapsedGroups = new Set<string>();
  private flatVisible: ModelItem[] = [];
  private rowEls: HTMLElement[] = [];
  private selectedIndex = 0;

  constructor(
    app: App,
    private plugin: VaultAgentsPlugin,
    private items: ModelItem[],
    private activeEngine: EngineType,
    private onPick: (item: ModelItem) => void,
    private onRefresh?: () => Promise<ModelItem[]>
  ) {
    super(app);
  }

  onOpen(): void {
    const t = (s: string) => this.plugin.t(s);
    const provider = this.plugin.registry.get(this.activeEngine);
    const agentName = provider?.descriptor.shortName || this.activeEngine;

    this.modalEl.addClass("va-model-modal");
    const { contentEl } = this;
    contentEl.empty();

    const searchRow = contentEl.createDiv({ cls: "va-model-search-row" });
    const searchIcon = searchRow.createSpan({ cls: "va-model-search-icon" });
    setIcon(searchIcon, "search");

    this.searchInput = searchRow.createEl("input", {
      cls: "va-model-search-input",
      attr: {
        type: "text",
        placeholder: substitute(
          t("Search $1 models or type a custom ID..."),
          agentName
        ),
      },
    });

    if (this.onRefresh) {
      this.refreshBtn = searchRow.createEl("button", {
        cls: "va-model-refresh-btn",
        attr: { type: "button", title: t("Refresh models from CLI") },
      });
      const iconSpan = this.refreshBtn.createSpan({ cls: "opencode-btn-icon" });
      setIcon(iconSpan, "refresh-cw");
      this.refreshBtn.createSpan({ text: t("Refresh") });
      this.refreshBtn.addEventListener("click", () => void this.handleRefresh());
    }

    this.chipsEl = contentEl.createDiv({ cls: "va-model-chips" });
    this.listEl = contentEl.createDiv({ cls: "va-model-list" });

    this.searchInput.addEventListener("input", () => {
      this.query = this.searchInput.value;
      this.selectedIndex = 0;
      this.renderList();
    });

    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.flatVisible.length > 0) {
          this.selectedIndex = Math.min(
            this.selectedIndex + 1,
            this.flatVisible.length - 1
          );
          this.updateHighlight();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.flatVisible.length > 0) {
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateHighlight();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = this.flatVisible[this.selectedIndex];
        if (chosen) {
          this.pickItem(chosen);
        }
      }
    });

    this.renderChips();
    this.renderList();
    window.setTimeout(() => this.searchInput?.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async handleRefresh(): Promise<void> {
    if (!this.onRefresh || !this.refreshBtn) return;
    this.refreshBtn.disabled = true;
    this.refreshBtn.addClass("is-loading");
    try {
      const updated = await this.onRefresh();
      this.items = updated;
      if (
        this.activeFilter !== "all" &&
        !this.availableVendors().includes(this.activeFilter)
      ) {
        this.activeFilter = "all";
      }
      this.selectedIndex = 0;
      this.renderChips();
      this.renderList();
      new Notice(this.plugin.t("Models refreshed."));
    } catch (e) {
      new Notice(`${this.plugin.t("Error:")} ${redact((e as Error).message)}`);
    } finally {
      if (this.refreshBtn) {
        this.refreshBtn.disabled = false;
        this.refreshBtn.removeClass("is-loading");
      }
    }
  }

  private availableVendors(): string[] {
    const counts = new Map<string, number>();
    for (const item of this.items) {
      const grp = modelGroupKey(item);
      if (grp === "__default__" || grp === "__custom__") continue;
      counts.set(grp, (counts.get(grp) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }

  private renderChips(): void {
    this.chipsEl.empty();
    const vendors = this.availableVendors();
    if (vendors.length <= 1) {
      this.chipsEl.addClass("hidden");
      return;
    }
    this.chipsEl.removeClass("hidden");
    const t = (s: string) => this.plugin.t(s);
    const chips = ["all", ...vendors.slice(0, 8)];
    for (const key of chips) {
      const chip = this.chipsEl.createEl("button", {
        cls:
          "va-model-chip" +
          (this.activeFilter === key ? " is-active" : ""),
        attr: { type: "button" },
        text: key === "all" ? t("All") : key,
      });
      chip.addEventListener("click", () => {
        this.activeFilter = key;
        this.selectedIndex = 0;
        this.renderChips();
        this.renderList();
        this.searchInput?.focus();
      });
    }
  }

  private filteredItems(): ModelItem[] {
    const raw = this.query.trim();
    const q = raw.toLowerCase();

    const pool =
      this.activeFilter === "all"
        ? this.items
        : this.items.filter(
            (it) => it.isDefault || modelGroupKey(it) === this.activeFilter
          );

    let results: ModelItem[];
    if (!q) {
      results = [...pool];
    } else {
      const scored: Array<{ item: ModelItem; score: number }> = [];
      for (const item of pool) {
        const hay = `${item.id} ${item.label ?? ""} ${item.provider}`;
        const sc = fuzzyMatchScore(q, hay);
        if (sc > 0) scored.push({ item, score: sc });
      }
      scored.sort((a, b) => b.score - a.score);
      results = scored.map((s) => s.item);
    }

    if (q) {
      const exactExists = this.items.some(
        (item) => item.id.toLowerCase() === q
      );
      if (!exactExists && /^[a-zA-Z0-9_.:/+-]+$/.test(raw)) {
        const provider = this.plugin.registry.get(this.activeEngine);
        const providerLabel =
          provider?.descriptor.shortName || this.activeEngine;
        results.push({
          id: raw,
          label: raw,
          engine: this.activeEngine,
          provider: providerLabel,
          isActive: false,
          isCustom: true,
        });
      }
    }
    return results;
  }

  private renderList(): void {
    const t = (s: string) => this.plugin.t(s);
    this.listEl.empty();
    this.flatVisible = [];
    this.rowEls = [];

    const filtered = this.filteredItems();
    if (filtered.length === 0) {
      this.listEl.createDiv({
        cls: "va-model-empty",
        text: t("No matching models found."),
      });
      return;
    }

    // Group items while preserving order of groups (active/default first)
    const groups = new Map<string, ModelItem[]>();
    for (const item of filtered) {
      const key = modelGroupKey(item);
      let arr = groups.get(key);
      if (!arr) {
        arr = [];
        groups.set(key, arr);
      }
      arr.push(item);
    }

    const searching = this.query.trim().length > 0;
    const showGroupHeaders = groups.size > 1 || this.activeFilter === "all";

    for (const [groupKey, groupItems] of groups.entries()) {
      const isSpecial =
        groupKey === "__default__" || groupKey === "__custom__";
      const isCollapsed =
        !searching && !isSpecial && this.collapsedGroups.has(groupKey);

      if (showGroupHeaders && !isSpecial) {
        const header = this.listEl.createEl("button", {
          cls: "va-model-group-header",
          attr: { type: "button" },
        });
        const chev = header.createSpan({ cls: "va-model-group-chev" });
        setIcon(chev, isCollapsed ? "chevron-right" : "chevron-down");
        header.createSpan({
          cls: "va-model-group-name",
          text: groupKey === "__other__" ? t("Models") : groupKey,
        });
        header.createSpan({
          cls: "va-model-group-count",
          text: String(groupItems.length),
        });
        header.addEventListener("click", () => {
          if (this.collapsedGroups.has(groupKey)) {
            this.collapsedGroups.delete(groupKey);
          } else {
            this.collapsedGroups.add(groupKey);
          }
          this.renderList();
        });
      }

      if (isCollapsed) continue;

      for (const item of groupItems) {
        const idx = this.flatVisible.length;
        this.flatVisible.push(item);
        const row = this.listEl.createDiv({
          cls: "opencode-model-suggest-item va-model-row",
        });
        this.renderModelRow(item, row);
        row.addEventListener("click", () => this.pickItem(item));
        row.addEventListener("mouseenter", () => {
          this.selectedIndex = idx;
          this.updateHighlight(false);
        });
        this.rowEls.push(row);
      }
    }

    if (this.selectedIndex >= this.flatVisible.length) {
      this.selectedIndex = Math.max(0, this.flatVisible.length - 1);
    }
    this.updateHighlight();
  }

  private updateHighlight(scroll = true): void {
    for (let i = 0; i < this.rowEls.length; i++) {
      this.rowEls[i].toggleClass("is-focused", i === this.selectedIndex);
    }
    if (scroll) {
      this.rowEls[this.selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }

  private pickItem(item: ModelItem): void {
    this.close();
    this.onPick(item);
  }

  private renderModelRow(item: ModelItem, el: HTMLElement): void {
    const t = (s: string) => this.plugin.t(s);
    if (item.isActive) el.addClass("is-selected");

    const slashIdx = item.id.indexOf("/");
    const vendorPrefix =
      !item.isDefault && !item.isCustom && slashIdx > 0
        ? item.id.slice(0, slashIdx)
        : "";
    const shortModelName =
      vendorPrefix && slashIdx > 0
        ? item.id.slice(slashIdx + 1)
        : item.label || item.id;

    const titleEl = el.createDiv({ cls: "opencode-model-suggest-title" });
    const leftEl = titleEl.createDiv({ cls: "opencode-model-suggest-left" });

    const iconEl = leftEl.createSpan({ cls: "opencode-model-suggest-icon" });
    setIcon(
      iconEl,
      item.isDefault ? "sparkles" : item.isCustom ? "edit-3" : "cpu"
    );

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
}
