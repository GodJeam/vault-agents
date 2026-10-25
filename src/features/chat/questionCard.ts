import { Notice, setIcon } from "obsidian";
import type { AgentQuestion } from "../../core/types";

export function formatQuestionAnswers(
  questions: AgentQuestion[],
  selectedByIdx: Map<number, Set<string>>,
  customByIdx: Map<number, string>,
  t: (s: string) => string
): string {
  const lines: string[] = [];
  if (questions.length > 1) {
    lines.push(t("Here are my answers to your questions:"));
    lines.push("");
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const selected = Array.from(selectedByIdx.get(i) ?? []);
    const custom = (customByIdx.get(i) ?? "").trim();
    const allAnswers = [...selected];
    if (custom) allAnswers.push(custom);
    const joined = allAnswers.join(", ");

    if (questions.length === 1) {
      lines.push(joined);
    } else {
      const label = q.header ? `${q.header} — ${q.question}` : q.question;
      lines.push(`- **${label}**: ${joined || "—"}`);
    }
  }

  return lines.join("\n").trim();
}

export function renderQuestionCard(
  container: HTMLElement,
  questions: AgentQuestion[],
  t: (s: string) => string,
  onSubmit: (formattedAnswer: string) => void,
  onScrollRequest: () => void
): void {
  if (!questions || questions.length === 0) return;

  const card = container.createDiv({ cls: "opencode-question-card" });

  const headerRow = card.createDiv({ cls: "opencode-question-card-header" });
  const iconSpan = headerRow.createSpan({ cls: "opencode-question-card-icon" });
  setIcon(iconSpan, "help-circle");
  headerRow.createSpan({
    cls: "opencode-question-card-title",
    text: t("Agent question"),
  });

  const selectedByIdx = new Map<number, Set<string>>();
  const customByIdx = new Map<number, string>();
  const allOptionBtns: HTMLButtonElement[] = [];
  const allInputs: HTMLInputElement[] = [];

  questions.forEach((q, qIdx) => {
    const selected = new Set<string>();
    selectedByIdx.set(qIdx, selected);

    const block = card.createDiv({ cls: "opencode-question-block" });
    if (q.header) {
      block.createDiv({ cls: "opencode-question-badge", text: q.header });
    }
    block.createDiv({ cls: "opencode-question-prompt", text: q.question });
    const hintText = q.multiple
      ? t("Select one or more options")
      : t("Select an option");
    block.createDiv({
      cls: "opencode-question-hint",
      text: hintText,
    });

    const optsEl = block.createDiv({ cls: "opencode-question-options" });
    const blockBtns: HTMLButtonElement[] = [];

    for (const opt of q.options) {
      const btn = optsEl.createEl("button", {
        cls: "opencode-question-opt",
        attr: { type: "button" },
      });
      const checkSpan = btn.createSpan({ cls: "opencode-question-opt-check" });
      checkSpan.setText(q.multiple ? "☐" : "○");

      const textCol = btn.createDiv({ cls: "opencode-question-opt-content" });
      textCol.createDiv({
        cls: "opencode-question-opt-label",
        text: opt.label,
      });
      if (opt.description) {
        textCol.createDiv({
          cls: "opencode-question-opt-desc",
          text: opt.description,
        });
      }

      btn.addEventListener("click", () => {
        if (card.hasClass("is-submitted")) return;
        if (q.multiple) {
          if (selected.has(opt.label)) {
            selected.delete(opt.label);
            btn.removeClass("is-selected");
            checkSpan.setText("☐");
          } else {
            selected.add(opt.label);
            btn.addClass("is-selected");
            checkSpan.setText("☑");
          }
        } else {
          selected.clear();
          for (const b of blockBtns) {
            b.removeClass("is-selected");
            const c = b.querySelector(".opencode-question-opt-check");
            if (c) c.setText("○");
          }
          selected.add(opt.label);
          btn.addClass("is-selected");
          checkSpan.setText("●");
        }
      });

      blockBtns.push(btn);
      allOptionBtns.push(btn);
    }

    const customWrap = block.createDiv({ cls: "opencode-question-custom" });
    const customInput = customWrap.createEl("input", {
      cls: "opencode-question-custom-input",
      attr: {
        type: "text",
        placeholder: t("Other / custom answer..."),
      },
    });
    customInput.addEventListener("input", () => {
      customByIdx.set(qIdx, customInput.value);
    });
    customInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
    });
    allInputs.push(customInput);
  });

  const actions = card.createDiv({ cls: "opencode-question-actions" });
  const submitBtn = actions.createEl("button", {
    cls: "opencode-question-submit",
    attr: { type: "button" },
  });
  submitBtn.setText(t("Send answer"));

  submitBtn.addEventListener("click", () => {
    if (card.hasClass("is-submitted")) return;
    const formatted = formatQuestionAnswers(
      questions,
      selectedByIdx,
      customByIdx,
      t
    );
    if (!formatted) {
      new Notice(t("Please select or type an answer before sending."));
      return;
    }

    card.addClass("is-submitted");
    submitBtn.disabled = true;
    submitBtn.setText("✓ " + t("Answer sent"));
    for (const b of allOptionBtns) b.disabled = true;
    for (const inp of allInputs) inp.disabled = true;

    onSubmit(formatted);
  });

  onScrollRequest();
}
