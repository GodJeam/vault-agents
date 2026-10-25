import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import type { AgentQuestion, FinishInfo, StepInfo } from "../../core/types";
import { StepManager } from "./stepWidget";
import { renderQuestionCard } from "./questionCard";

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
  private questionsEl: HTMLElement;
  private statsEl: HTMLElement;
  private activityBarEl: HTMLElement;
  private activityTextEl: HTMLElement;
  private activityTimerEl: HTMLElement;
  /** Backwards-compatible status accessor that updates the activity bar. */
  status: { setText: (text: string) => void };
  private stepManager: StepManager;
  private rawText = "";
  private rawReasoning = "";
  private turnInput = 0;
  private turnOutput = 0;
  private turnReasoning = 0;
  private turnCost = 0;
  private lastCacheRead = 0;
  private lastCacheWrite = 0;
  private lastTokens?: FinishInfo["tokens"];
  private lastCost?: number;
  private renderTimer: number | null = null;
  private reasoningTimer: number | null = null;
  private elapsedTimer: number | null = null;
  private startedAtMs = Date.now();
  private isFinalized = false;

  constructor(
    private row: HTMLElement,
    private app: App,
    private component: Component,
    private assistantLabel: string,
    private t: (s: string) => string,
    private showIO: boolean,
    private onScrollRequest: () => void,
    private onCopy: (text: string) => void,
    private fmtTokens: (
      total: number,
      input: number,
      output: number,
      cost?: number
    ) => string,
    private onAnswerQuestion?: (formattedAnswer: string) => void
  ) {
    metaWithCopy(
      this.row,
      this.assistantLabel,
      () => this.rawText,
      this.onCopy,
      this.t("Copy text")
    );
    this.reasoningEl = this.row.createEl("details", {
      cls: "opencode-reasoning hidden",
    });
    const summary = this.reasoningEl.createEl("summary");
    summary.setText(this.t("Reasoning"));
    this.reasoningContent = this.reasoningEl.createDiv({
      cls: "opencode-reasoning-content",
    });

    const stepsEl = this.row.createDiv({ cls: "opencode-steps" });
    this.stepManager = new StepManager(
      stepsEl,
      this.t,
      this.showIO,
      this.onScrollRequest
    );

    this.contentEl = this.row.createDiv({
      cls: "opencode-bubble opencode-bubble--assistant hidden",
    });
    this.questionsEl = this.row.createDiv({
      cls: "opencode-questions-container",
    });
    this.statsEl = this.row.createDiv({ cls: "opencode-msg-stats hidden" });

    this.activityBarEl = this.row.createDiv({
      cls: "opencode-activity-bar hidden",
    });
    this.activityBarEl.createSpan({ cls: "opencode-activity-spinner" });
    this.activityTextEl = this.activityBarEl.createSpan({
      cls: "opencode-activity-text",
    });
    this.activityTimerEl = this.activityBarEl.createSpan({
      cls: "opencode-activity-timer",
    });

    this.status = {
      setText: (text: string) => this.setActivity(text),
    };
  }

  setActivity(text: string, warning = false): void {
    if (this.isFinalized) return;
    const clean = text.trim();
    if (!clean) {
      this.activityBarEl.addClass("hidden");
      return;
    }
    this.activityBarEl.removeClass("hidden");
    this.activityBarEl.toggleClass("is-warning", warning);
    this.activityTextEl.setText(clean);
    this.startElapsedClock();
  }

  private startElapsedClock(): void {
    if (this.elapsedTimer !== null) return;
    this.startedAtMs = Date.now();
    this.updateElapsedDisplay();
    this.elapsedTimer = window.setInterval(() => {
      this.updateElapsedDisplay();
    }, 1000);
  }

  private stopElapsedClock(): void {
    if (this.elapsedTimer !== null) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  }

  private updateElapsedDisplay(): void {
    const elapsedMs = Date.now() - this.startedAtMs;
    const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const pad = secs < 10 ? "0" : "";
    const formatted = mins > 0 ? `${mins}:${pad}${secs}` : `${secs}s`;
    this.activityTimerEl.setText(formatted);
  }

  setText(text: string): void {
    this.rawText = text;
    if (text.trim()) {
      this.contentEl.removeClass("hidden");
    }
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
      MarkdownRenderer.render(
        this.app,
        this.rawText,
        this.contentEl,
        "",
        this.component
      );
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
    this.reasoningTimer = window.setTimeout(
      () => this.flushReasoningRender(),
      120
    );
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

  addQuestions(questions: AgentQuestion[]): void {
    renderQuestionCard(
      this.questionsEl,
      questions,
      this.t,
      (answer) => this.onAnswerQuestion?.(answer),
      this.onScrollRequest
    );
  }

  setFinish(info: FinishInfo): void {
    if (info.tokens) {
      this.turnInput += info.tokens.input ?? 0;
      this.turnOutput += info.tokens.output ?? 0;
      this.turnReasoning += info.tokens.reasoning ?? 0;
      if (info.tokens.cache?.read !== undefined) {
        this.lastCacheRead = info.tokens.cache.read;
      }
      if (info.tokens.cache?.write !== undefined) {
        this.lastCacheWrite = info.tokens.cache.write;
      }
    }
    this.turnCost += info.cost ?? 0;

    if (info.tokens) {
      const total = this.turnInput + this.turnOutput + this.turnReasoning;
      this.lastTokens = {
        total,
        input: this.turnInput,
        output: this.turnOutput,
        reasoning: this.turnReasoning,
        cache:
          this.lastCacheRead > 0 || this.lastCacheWrite > 0
            ? { read: this.lastCacheRead, write: this.lastCacheWrite }
            : undefined,
      };
      this.lastCost = this.turnCost;
      this.statsEl.removeClass("hidden");
      this.statsEl.setText(
        this.fmtTokens(total, this.turnInput, this.turnOutput, this.turnCost)
      );
    }
  }

  getSnapshot(): {
    text: string;
    reasoning: string;
    tokens?: FinishInfo["tokens"];
    cost?: number;
  } {
    return {
      text: this.rawText,
      reasoning: this.rawReasoning,
      tokens: this.lastTokens,
      cost: this.lastCost,
    };
  }

  finalize(): void {
    this.isFinalized = true;
    this.stopElapsedClock();
    this.activityBarEl.addClass("hidden");
    this.contentEl.empty();
    if (this.rawText.trim()) {
      this.contentEl.removeClass("hidden");
      if (this.rawText.length <= 30000) {
        MarkdownRenderer.render(
          this.app,
          this.rawText,
          this.contentEl,
          "",
          this.component
        );
      } else {
        this.contentEl.textContent = this.rawText;
      }
    } else {
      this.contentEl.addClass("hidden");
    }
    this.stepManager.finalize();
  }

  dispose(): void {
    this.stopElapsedClock();
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
