import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import type { FinishInfo, StepInfo } from "../../core/types";
import { StepManager } from "./stepWidget";

export function metaWithCopy(
  row: HTMLElement,
  label: string,
  getText: () => string,
  onCopy: (text: string) => void,
  copyTitle: string
): void {
  const meta = row.createDiv({ cls: "opencode-meta" });
  meta.createSpan({ text: label });
  meta.createSpan({ cls: "opencode-meta-spacer" });
  const btn = meta.createEl("button", {
    cls: "opencode-icon-btn",
    attr: { title: copyTitle },
  });
  setIcon(btn, "copy");
  btn.addEventListener("click", () => onCopy(getText()));
}

export function renderUserBubble(
  container: HTMLElement,
  text: string,
  ctxLabel: string | undefined,
  t: (s: string) => string,
  onCopy: (text: string) => void
): void {
  const row = container.createDiv({
    cls: "opencode-message opencode-message--user",
  });
  metaWithCopy(row, t("You"), () => text, onCopy, t("Copy text"));
  if (ctxLabel) {
    row.createDiv({
      cls: "opencode-context-hint",
      text: `${t("with context:")} ${ctxLabel}`,
    });
  }
  row.createDiv({ cls: "opencode-bubble", text });
}

export function renderErrorBubble(
  container: HTMLElement,
  msg: string,
  t: (s: string) => string,
  onCopy: (text: string) => void
): void {
  const row = container.createDiv({
    cls: "opencode-message opencode-message--error",
  });
  metaWithCopy(row, t("Error"), () => msg, onCopy, t("Copy text"));
  row.createDiv({ cls: "opencode-bubble", text: msg });
}

export class AssistantBubble {
  private reasoningEl: HTMLDetailsElement;
  private reasoningContent: HTMLElement;
  private contentEl: HTMLElement;
  private statsEl: HTMLElement;
  status: HTMLElement;
  private stepManager: StepManager;
  private rawText = "";
  private rawReasoning = "";
  private lastTokens?: { total?: number; input?: number; output?: number };
  private lastCost?: number;
  private renderTimer: number | null = null;
  private reasoningTimer: number | null = null;

  constructor(
    private row: HTMLElement,
    private app: App,
    private component: Component,
    private assistantLabel: string,
    private t: (s: string) => string,
    private showIO: boolean,
    private onScrollRequest: () => void,
    private onCopy: (text: string) => void,
    private fmtTokens: (total: number, input: number, output: number, cost?: number) => string
  ) {
    metaWithCopy(this.row, this.assistantLabel, () => this.rawText, this.onCopy, this.t("Copy text"));
    this.reasoningEl = this.row.createEl("details", { cls: "opencode-reasoning hidden" });
    const summary = this.reasoningEl.createEl("summary");
    summary.setText(this.t("Reasoning"));
    this.reasoningContent = this.reasoningEl.createDiv({ cls: "opencode-reasoning-content" });

    const stepsEl = this.row.createDiv({ cls: "opencode-steps" });
    this.stepManager = new StepManager(stepsEl, this.t, this.showIO, this.onScrollRequest);

    this.contentEl = this.row.createDiv({ cls: "opencode-bubble opencode-bubble--assistant" });
    this.statsEl = this.row.createDiv({ cls: "opencode-msg-stats hidden" });
    this.status = this.row.createDiv({ cls: "opencode-status" });
  }

  setText(text: string): void {
    this.rawText = text;
    if (text.length <= 30000) {
      this.scheduleRender();
    } else {
      if (this.renderTimer !== null) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
      this.contentEl.empty();
      this.contentEl.textContent = text;
    }
    this.onScrollRequest();
  }

  private scheduleRender(): void {
    if (this.renderTimer !== null) clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => this.flushRender(), 120);
  }

  private flushRender(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.rawText.length > 30000) {
      this.contentEl.empty();
      this.contentEl.textContent = this.rawText;
      return;
    }
    this.contentEl.empty();
    if (this.rawText.trim()) {
      MarkdownRenderer.render(this.app, this.rawText, this.contentEl, "", this.component);
    }
  }

  setReasoning(text: string): void {
    this.rawReasoning = text;
    this.reasoningEl.removeClass("hidden");
    this.scheduleReasoningRender();
    this.onScrollRequest();
  }

  private scheduleReasoningRender(): void {
    if (this.reasoningTimer !== null) clearTimeout(this.reasoningTimer);
    this.reasoningTimer = window.setTimeout(() => this.flushReasoningRender(), 120);
  }

  private flushReasoningRender(): void {
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
    const MAX = 50000;
    const shown =
      this.rawReasoning.length > MAX
        ? "… " + this.rawReasoning.slice(this.rawReasoning.length - MAX)
        : this.rawReasoning;
    this.reasoningContent.textContent = shown;
  }

  addStep(step: StepInfo): void {
    this.stepManager.addStep(step);
  }

  setFinish(info: FinishInfo): void {
    this.lastTokens = info.tokens;
    this.lastCost = info.cost;
    if (info.tokens) {
      const total = info.tokens.total ?? 0;
      const input = info.tokens.input ?? 0;
      const output = info.tokens.output ?? 0;
      const cost = info.cost ?? 0;
      this.statsEl.removeClass("hidden");
      this.statsEl.setText(this.fmtTokens(total, input, output, cost));
    }
  }

  getSnapshot(): { text: string; reasoning: string; tokens?: FinishInfo["tokens"]; cost?: number } {
    return {
      text: this.rawText,
      reasoning: this.rawReasoning,
      tokens: this.lastTokens,
      cost: this.lastCost,
    };
  }

  finalize(): void {
    this.contentEl.empty();
    if (this.rawText.trim() && this.rawText.length <= 30000) {
      MarkdownRenderer.render(this.app, this.rawText, this.contentEl, "", this.component);
    } else if (this.rawText.trim()) {
      this.contentEl.textContent = this.rawText;
    }
    this.status.setText("");
    this.stepManager.finalize();
  }

  dispose(): void {
    if (this.renderTimer !== null) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    if (this.reasoningTimer !== null) {
      clearTimeout(this.reasoningTimer);
      this.reasoningTimer = null;
    }
  }
}
