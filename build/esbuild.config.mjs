import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import process from "process";
import builtins from "builtin-modules";

const prod = process.argv[2] === "production";
const MAX_COLS = 80;

function tokenizeJSLine(line) {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === ch) {
          j++;
          break;
        }
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (
        j < line.length &&
        line[j] !== '"' &&
        line[j] !== "'" &&
        line[j] !== "`"
      ) {
        j++;
      }
      tokens.push({ type: "code", text: line.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}

function splitLongString(strLit, indentStr, maxCols) {
  const q = strLit[0];
  if (q !== '"' && q !== "'") return strLit;
  const inner = strLit.slice(1, -1);
  const words = [];
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\") {
      if (inner[i + 1] === "x") {
        cur += inner.slice(i, i + 4);
        i += 3;
      } else if (inner[i + 1] === "u") {
        cur += inner.slice(i, i + 6);
        i += 5;
      } else {
        cur += inner.slice(i, i + 2);
        i += 1;
      }
    } else {
      cur += c;
      const isBreakChar =
        c === " " ||
        c === "/" ||
        c === "-" ||
        c === "," ||
        c === "." ||
        c === "|" ||
        c === ";";
      if (isBreakChar) {
        words.push(cur);
        cur = "";
      }
    }
  }
  if (cur) words.push(cur);

  const budget = Math.max(20, maxCols - indentStr.length - 6);
  const chunks = [];
  let line = "";
  for (const w of words) {
    if (line.length + w.length <= budget) {
      line += w;
    } else {
      if (line) chunks.push(line);
      if (w.length <= budget) {
        line = w;
      } else {
        let rem = w;
        while (rem.length > budget) {
          let cut = budget;
          const bIdx = rem.lastIndexOf("\\", cut - 1);
          if (bIdx >= 0 && cut - bIdx < 6) cut = bIdx;
          if (cut <= 0) cut = budget;
          chunks.push(rem.slice(0, cut));
          rem = rem.slice(cut);
        }
        line = rem;
      }
    }
  }
  if (line) chunks.push(line);
  if (chunks.length <= 1) return strLit;
  return chunks
    .map((c, idx) => {
      const prefix = idx === 0 ? "" : indentStr;
      const suffix = idx < chunks.length - 1 ? " +" : "";
      return `${prefix}${q}${c}${q}${suffix}`;
    })
    .join("\n");
}

function wrapLine(line, maxCols = MAX_COLS) {
  if (line.length <= maxCols) return [line];
  const indentMatch = line.match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1] : "";
  const contIndent = baseIndent + "  ";

  const tokens = tokenizeJSLine(line);
  let rebuilt = "";
  for (let idx = 0; idx < tokens.length; idx++) {
    const tk = tokens[idx];
    const isQuoted = tk.text[0] === '"' || tk.text[0] === "'";
    if (tk.type === "string" && isQuoted && tk.text.length > 42) {
      const prevCode = idx > 0 ? tokens[idx - 1].text : "";
      const nextCode = idx + 1 < tokens.length ? tokens[idx + 1].text : "";
      const isPlainPropKey =
        /^\s*:/.test(nextCode) && !/\[\s*$/.test(prevCode);
      const split = splitLongString(tk.text, contIndent, maxCols);
      if (isPlainPropKey && split.includes("\n")) {
        rebuilt += "[\n" + contIndent + split + "\n" + baseIndent + "]";
      } else {
        rebuilt += "\n" + contIndent + split;
      }
    } else {
      rebuilt += tk.text;
    }
  }

  let candidateLines = rebuilt
    .split("\n")
    .filter((l, idx) => (idx === 0 ? l.trim().length > 0 : true));
  if (rebuilt.startsWith("\n")) {
    candidateLines = rebuilt.slice(1).split("\n");
  }

  const finalLines = [];
  const queue = [...candidateLines];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.length <= maxCols) {
      finalLines.push(cur);
      continue;
    }
    const indM = cur.match(/^(\s*)/);
    const ind = indM ? indM[1] : "";
    const nextInd = ind + "  ";

    const tks = tokenizeJSLine(cur);
    let pos = 0;
    let bestSplit = -1;
    let fallbackSplit = -1;

    for (const tk of tks) {
      if (tk.type === "code") {
        const text = tk.text;
        for (let k = 0; k < text.length; k++) {
          const absPos = pos + k;
          if (absPos <= ind.length + 5) continue;
          const two = text.slice(k, k + 2);
          const three = text.slice(k, k + 3);
          let splitAfter = -1;
          if (three === " ? " || three === " : " || three === " = ") {
            splitAfter = absPos + 3;
          } else if (two === "||" || two === "&&" || two === "??") {
            splitAfter = text[k + 2] === " " ? absPos + 3 : absPos + 2;
          } else if (two === ", " || two === "; " || two === "+ ") {
            splitAfter = absPos + 2;
          } else if (two === "=>" && text[k + 2] === " ") {
            splitAfter = absPos + 3;
          } else if (text[k] === "(" || text[k] === "{") {
            splitAfter = absPos + 1;
          } else if (
            text[k] === "." &&
            k > 0 &&
            /[a-zA-Z0-9_)\]]/.test(text[k - 1])
          ) {
            splitAfter = absPos;
          }

          if (splitAfter > ind.length + 5) {
            if (splitAfter <= maxCols) {
              bestSplit = splitAfter;
            } else if (fallbackSplit === -1) {
              fallbackSplit = splitAfter;
            }
          }
        }
      } else if (
        tk.type === "string" &&
        (tk.text[0] === '"' || tk.text[0] === "'")
      ) {
        const crosses = pos < maxCols && pos + tk.text.length > maxCols;
        if (crosses && tk.text.length > 20) {
          const prefix = cur.slice(0, pos);
          const suffix = cur.slice(pos + tk.text.length);
          if (prefix.trim().length > 0) {
            bestSplit = pos;
          } else {
            const splitStr = splitLongString(tk.text, ind, maxCols) + suffix;
            const subLines = splitStr.split("\n");
            if (subLines.length > 1) {
              queue.unshift(...subLines);
              bestSplit = -2;
              break;
            }
          }
        }
      }
      pos += tk.text.length;
    }

    if (bestSplit === -2) continue;
    const chosen = bestSplit !== -1 ? bestSplit : fallbackSplit;
    if (chosen !== -1 && chosen < cur.length) {
      const left = cur.slice(0, chosen).trimEnd();
      const right = nextInd + cur.slice(chosen).trimStart();
      finalLines.push(left);
      queue.unshift(right);
    } else {
      finalLines.push(cur);
    }
  }
  return finalLines;
}

const formatOutputPlugin = {
  name: "format-80-cols",
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length > 0) return;
      try {
        const raw = readFileSync("main.js", "utf8").split("\n");
        const formatted = [];
        for (const line of raw) {
          formatted.push(...wrapLine(line, MAX_COLS));
        }
        writeFileSync("main.js", formatted.join("\n"), "utf8");
      } catch (e) {
        console.error("Failed to format main.js:", e);
      }
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: false,
  treeShaking: true,
  minify: false,
  legalComments: "none",
  outfile: "main.js",
  plugins: [formatOutputPlugin],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
