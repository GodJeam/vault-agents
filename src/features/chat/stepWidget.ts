import { setIcon } from "obsidian";
import type { StepInfo } from "../../core/types";

export interface StepRecord {
  row: HTMLElement;
  icon: HTMLElement;
  status: string;
}

export class StepManager {
  private steps = new Map<string, StepRecord>();

  constructor(
    private containerEl: HTMLElement,
    private t: (s: string) => string,
    private showIO: boolean,
    private onScrollRequest: () => void
  ) {}

  addStep(step: StepInfo): void {
    const existing = this.steps.get(step.id);

    if (step.state === "running") {
      if (existing) return;
      const row = this.containerEl.createDiv({ cls: "opencode-step opencode-step--running" });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      icon.createDiv({ cls: "opencode-step-spinner" });
      const main = row.createDiv({ cls: "opencode-step-main" });
      const title = main.createDiv({ cls: "opencode-step-title" });
      title.setText(`${step.tool}: ${this.stepTitle(step)}`);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, { row, icon, status: "running" });
      this.onScrollRequest();
      return;
    }

    const rec = existing;
    if (rec) {
      rec.status = step.state;
      rec.row.removeClass("opencode-step--running");
      rec.row.addClass(step.state === "error" ? "opencode-step--error" : "opencode-step--done");
      rec.icon.empty();
      setIcon(rec.icon, step.state === "error" ? "x" : "check");
      if (this.showIO) {
        const details = rec.row.querySelector("details");
        if (details) {
          const pre = details.querySelector("pre");
          if (pre) pre.setText(this.serializeStep(step));
        }
      }
    } else {
      const row = this.containerEl.createDiv({
        cls: `opencode-step ${step.state === "error" ? "opencode-step--error" : "opencode-step--done"}`,
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      setIcon(icon, step.state === "error" ? "x" : "check");
      const main = row.createDiv({ cls: "opencode-step-main" });
      const title = main.createDiv({ cls: "opencode-step-title" });
      title.setText(`${step.tool}: ${this.stepTitle(step)}`);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, { row, icon, status: step.state });
    }
    this.onScrollRequest();
  }

  finalize(): void {
    for (const rec of this.steps.values()) {
      if (rec.status === "running") {
        rec.status = "done";
        rec.row.removeClass("opencode-step--running");
        rec.row.addClass("opencode-step--done");
        rec.icon.empty();
        setIcon(rec.icon, "check");
      }
    }
  }

  private buildStepDetails(main: HTMLElement, step: StepInfo): void {
    const det = main.createEl("details", { cls: "opencode-step-details" });
    det.createEl("summary").setText(this.t("Details"));
    const pre = det.createEl("pre", { cls: "opencode-step-io" });
    pre.setText(this.serializeStep(step));
  }

  private serializeStep(step: StepInfo): string {
    const parts: string[] = [];
    const fmt = (v: unknown): string => {
      const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
      return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
    };
    if (step.input !== undefined && step.input !== null) {
      parts.push(this.t("INPUT:") + "\n" + fmt(step.input));
    }
    if (step.output !== undefined && step.output !== null) {
      parts.push(this.t("OUTPUT:") + "\n" + fmt(step.output));
    }
    return parts.join("\n\n---\n\n") || this.t("(no details)");
  }

  private stepTitle(step: StepInfo): string {
    const t = String(step.title || step.tool || this.t("Tool"));
    return t.length > 120 ? t.slice(0, 117) + "…" : t;
  }
}
