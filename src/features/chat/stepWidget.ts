import { setIcon } from "obsidian";
import type { StepInfo } from "../../core/types";

export interface StepRecord {
  row: HTMLElement;
  icon: HTMLElement;
  main: HTMLElement;
  titleEl: HTMLElement;
  durationEl: HTMLElement;
  status: string;
}

interface ToolPresentation {
  labelKey: string;
  icon: string;
}

const TOOL_PRESENTATION_MAP: Record<string, ToolPresentation> = {
  read: { labelKey: "Read file", icon: "file-text" },
  view_file: { labelKey: "Read file", icon: "file-text" },
  read_file: { labelKey: "Read file", icon: "file-text" },
  write: { labelKey: "Write file", icon: "file-plus" },
  write_to_file: { labelKey: "Write file", icon: "file-plus" },
  write_file: { labelKey: "Write file", icon: "file-plus" },
  edit: { labelKey: "Edit file", icon: "file-edit" },
  edit_file: { labelKey: "Edit file", icon: "file-edit" },
  replace_file_content: { labelKey: "Edit file", icon: "file-edit" },
  multi_replace_file_content: { labelKey: "Edit file", icon: "file-edit" },
  bash: { labelKey: "Run command", icon: "terminal" },
  run_command: { labelKey: "Run command", icon: "terminal" },
  grep: { labelKey: "Search text", icon: "search" },
  grep_search: { labelKey: "Search text", icon: "search" },
  glob: { labelKey: "Find files", icon: "folder-search" },
  find_by_name: { labelKey: "Find files", icon: "folder-search" },
  list_dir: { labelKey: "List folder", icon: "folder" },
  webfetch: { labelKey: "Web search", icon: "globe" },
  search_web: { labelKey: "Web search", icon: "globe" },
  read_url_content: { labelKey: "Web search", icon: "globe" },
  todowrite: { labelKey: "Task list", icon: "list-todo" },
  task: { labelKey: "Subagent", icon: "bot" },
  invoke_subagent: { labelKey: "Subagent", icon: "bot" },
  question: { labelKey: "Question", icon: "help-circle" },
  ask_question: { labelKey: "Question", icon: "help-circle" },
};

export function formatToolAction(
  tool: string,
  rawTitle: string,
  t: (s: string) => string
): { label: string; target: string; icon: string } {
  const key = (tool || "").toLowerCase();
  const mapped = TOOL_PRESENTATION_MAP[key];
  const label = mapped ? t(mapped.labelKey) : tool || t("Tool");
  const icon = mapped ? mapped.icon : "wrench";

  const cleanTitle = (rawTitle || "").trim();
  const isDuplicate =
    !cleanTitle ||
    cleanTitle.toLowerCase() === key ||
    cleanTitle.toLowerCase() === label.toLowerCase();
  const target = isDuplicate
    ? ""
    : cleanTitle.length > 110
      ? cleanTitle.slice(0, 107) + "…"
      : cleanTitle;

  return { label, target, icon };
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
      const row = this.containerEl.createDiv({
        cls: "opencode-step opencode-step--running",
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      icon.createDiv({ cls: "opencode-step-spinner" });
      const main = row.createDiv({ cls: "opencode-step-main" });
      const header = main.createDiv({ cls: "opencode-step-header" });
      const titleEl = header.createDiv({ cls: "opencode-step-title" });
      const durationEl = header.createSpan({
        cls: "opencode-step-duration hidden",
      });
      this.renderStepTitle(titleEl, step);
      this.renderTodoPreview(main, step);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, {
        row,
        icon,
        main,
        titleEl,
        durationEl,
        status: "running",
      });
      this.onScrollRequest();
      return;
    }

    const rec = existing;
    const isErr = step.state === "error";
    const { icon: toolIcon } = formatToolAction(step.tool, step.title, this.t);
    const doneCls = isErr ? "opencode-step--error" : "opencode-step--done";

    if (rec) {
      rec.status = step.state;
      rec.row.removeClass("opencode-step--running");
      rec.row.addClass(doneCls);
      rec.icon.empty();
      setIcon(rec.icon, isErr ? "x" : toolIcon);
      this.renderStepTitle(rec.titleEl, step);
      this.updateDuration(rec.durationEl, step.durationMs);
      if (this.showIO) {
        const details = rec.row.querySelector("details");
        if (details) {
          const pre = details.querySelector("pre");
          if (pre) pre.setText(this.serializeStep(step));
        }
      }
    } else {
      const row = this.containerEl.createDiv({
        cls: `opencode-step ${doneCls}`,
      });
      const icon = row.createSpan({ cls: "opencode-step-icon" });
      setIcon(icon, isErr ? "x" : toolIcon);
      const main = row.createDiv({ cls: "opencode-step-main" });
      const header = main.createDiv({ cls: "opencode-step-header" });
      const titleEl = header.createDiv({ cls: "opencode-step-title" });
      const durationEl = header.createSpan({
        cls: "opencode-step-duration hidden",
      });
      this.renderStepTitle(titleEl, step);
      this.updateDuration(durationEl, step.durationMs);
      this.renderTodoPreview(main, step);
      if (this.showIO) this.buildStepDetails(main, step);
      this.steps.set(step.id, {
        row,
        icon,
        main,
        titleEl,
        durationEl,
        status: step.state,
      });
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

  private renderStepTitle(titleEl: HTMLElement, step: StepInfo): void {
    titleEl.empty();
    const { label, target } = formatToolAction(step.tool, step.title, this.t);
    titleEl.createSpan({ cls: "opencode-step-badge", text: label });
    if (target) {
      titleEl.createSpan({ cls: "opencode-step-target", text: target });
    }
  }

  private updateDuration(durationEl: HTMLElement, durationMs?: number): void {
    if (typeof durationMs === "number" && durationMs > 0) {
      const secs = (durationMs / 1000).toFixed(1);
      const label = durationMs < 1000 ? `${durationMs}ms` : `${secs}s`;
      durationEl.setText(label);
      durationEl.removeClass("hidden");
    }
  }

  private renderTodoPreview(main: HTMLElement, step: StepInfo): void {
    if (step.tool !== "todowrite") return;
    const inp =
      step.input && typeof step.input === "object"
        ? (step.input as Record<string, unknown>)
        : null;
    const todos = inp && Array.isArray(inp.todos) ? inp.todos : null;
    if (!todos || todos.length === 0) return;

    const existingList = main.querySelector(".opencode-todo-list");
    if (existingList) existingList.remove();

    const listEl = main.createDiv({ cls: "opencode-todo-list" });
    for (const rawTodo of todos.slice(0, 8)) {
      if (!rawTodo || typeof rawTodo !== "object") continue;
      const td = rawTodo as { content?: string; status?: string };
      if (!td.content) continue;
      const status = td.status || "pending";
      const itemEl = listEl.createDiv({
        cls: `opencode-todo-item opencode-todo-item--${status}`,
      });
      const mark =
        td.status === "completed"
          ? "✓"
          : td.status === "in_progress"
            ? "▸"
            : "○";
      itemEl.createSpan({ cls: "opencode-todo-mark", text: mark });
      itemEl.createSpan({ cls: "opencode-todo-text", text: td.content });
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
}
