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
  if (q !== '"' && q !== "'") return [indentStr + strLit];
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
        c === "|" ||
        c === ";";
      if (isBreakChar) {
        words.push(cur);
        cur = "";
      }
    }
  }
  if (cur) words.push(cur);

  const budget = Math.max(20, maxCols - indentStr.length - 5);
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
  return chunks.map((c, idx) => {
    const suffix = idx < chunks.length - 1 ? " +" : "";
    return `${indentStr}${q}${c}${q}${suffix}`;
  });
}

function formatObjectEntryLine(line, maxCols = MAX_COLS) {
  const indentMatch = line.match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1] : "";
  const contIndent = baseIndent + "  ";
  const tks = tokenizeJSLine(line);

  // Case A: ["long key"]: "long val",
  if (
    tks.length >= 4 &&
    tks[0].type === "code" &&
    /^\s*\[\s*$/.test(tks[0].text) &&
    tks[1].type === "string" &&
    tks[2].type === "code" &&
    /^\s*\]\s*:\s*$/.test(tks[2].text) &&
    tks[3].type === "string"
  ) {
    const keyStr = tks[1].text;
    const valStr = tks[3].text;
    const tail = tks
      .slice(4)
      .map((t) => t.text)
      .join("");
    const keyLines = splitLongString(keyStr, contIndent, maxCols - 2);
    const valLines = splitLongString(
      valStr,
      contIndent,
      maxCols - tail.length
    );
    const out = [];
    const singleKeyLen = keyLines[0].trim().length + baseIndent.length + 3;
    if (keyLines.length === 1 && singleKeyLen <= maxCols) {
      out.push(`${baseIndent}[${keyLines[0].trim()}]:`);
    } else {
      keyLines[0] = `${baseIndent}[${keyLines[0].trim()}`;
      keyLines[keyLines.length - 1] += "]:";
      out.push(...keyLines);
    }
    valLines[valLines.length - 1] += tail;
    out.push(...valLines);
    return out;
  }

  // Case B: "key": "val",
  if (
    tks.length >= 4 &&
    tks[0].type === "code" &&
    /^\s+$/.test(tks[0].text) &&
    tks[1].type === "string" &&
    tks[2].type === "code" &&
    /^\s*:\s*$/.test(tks[2].text) &&
    tks[3].type === "string"
  ) {
    const keyStr = tks[1].text;
    const valStr = tks[3].text;
    const tail = tks
      .slice(4)
      .map((t) => t.text)
      .join("");
    const valLines = splitLongString(
      valStr,
      contIndent,
      maxCols - tail.length
    );
    valLines[valLines.length - 1] += tail;
    if (baseIndent.length + keyStr.length + 1 <= maxCols) {
      return [`${baseIndent}${keyStr}:`, ...valLines];
    }
    const keyLines = splitLongString(keyStr, contIndent, maxCols - 2);
    keyLines[0] = `${baseIndent}[${keyLines[0].trim()}`;
    keyLines[keyLines.length - 1] += "]:";
    return [...keyLines, ...valLines];
  }

  // Case C: ident: "val",
  if (
    tks.length >= 2 &&
    tks[0].type === "code" &&
    /^\s*[a-zA-Z0-9_$]+\s*:\s*$/.test(tks[0].text) &&
    tks[1].type === "string"
  ) {
    const propPrefix = tks[0].text.trimEnd();
    const valStr = tks[1].text;
    const tail = tks
      .slice(2)
      .map((t) => t.text)
      .join("");
    const valLines = splitLongString(
      valStr,
      contIndent,
      maxCols - tail.length
    );
    valLines[valLines.length - 1] += tail;
    return [propPrefix, ...valLines];
  }

  return null;
}

function wrapLine(line, maxCols = MAX_COLS) {
  if (line.length <= maxCols) return [line];

  const objFormatted = formatObjectEntryLine(line, maxCols);
  if (objFormatted) return objFormatted;

  const indentMatch = line.match(/^(\s*)/);
  const baseIndent = indentMatch ? indentMatch[1] : "";
  const contIndent = baseIndent + "  ";

  const tokens = tokenizeJSLine(line);
  let rebuilt = "";
  for (const tk of tokens) {
    const isQuoted = tk.text[0] === '"' || tk.text[0] === "'";
    if (tk.type === "string" && isQuoted && tk.text.length > 48) {
      const splitLines = splitLongString(tk.text, contIndent, maxCols);
      rebuilt += "\n" + splitLines.join("\n");
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
    let bestScore = -1;
    let fallbackSplit = -1;

    const recordCandidate = (splitPos, priority) => {
      if (splitPos <= ind.length + 5 || splitPos >= cur.length) return;
      if (splitPos <= maxCols) {
        // Prefer higher priority; on tie, prefer closer to maxCols
        const score = priority * 1000 + splitPos;
        if (score > bestScore) {
          bestScore = score;
          bestSplit = splitPos;
        }
      } else if (fallbackSplit === -1) {
        fallbackSplit = splitPos;
      }
    };

    for (const tk of tks) {
      if (tk.type === "code") {
        const text = tk.text;
        for (let k = 0; k < text.length; k++) {
          const absPos = pos + k;
          const two = text.slice(k, k + 2);
          const three = text.slice(k, k + 3);

          // Priority 4: binary / ternary / assignment operators
          if (three === " ? " || three === " : " || three === " = ") {
            recordCandidate(absPos + 3, 4);
          } else if (two === "||" || two === "&&" || two === "??") {
            recordCandidate(text[k + 2] === " " ? absPos + 3 : absPos + 2, 4);
          } else if (two === "=>" && text[k + 2] === " ") {
            recordCandidate(absPos + 3, 4);
          } else if (two === "+ ") {
            recordCandidate(absPos + 2, 4);
          }
          // Priority 3: comma / semicolon separators
          else if (two === ", " || two === "; ") {
            recordCandidate(absPos + 2, 3);
          }
          // Priority 2: opening brace or paren (not inside `((x) =>`)
          else if (
            (text[k] === "{" || text[k] === "(") &&
            text[k + 1] !== ")" &&
            text[k + 1] !== "}" &&
            !/^\([a-zA-Z0-9_$,\s]*\)\s*=>/.test(text.slice(k))
          ) {
            recordCandidate(absPos + 1, 2);
          }
          // Priority 1: method chain dot `.method(` (only after `)` or `]`)
          else if (
            text[k] === "." &&
            k > 0 &&
            (text[k - 1] === ")" || text[k - 1] === "]")
          ) {
            recordCandidate(absPos, 2);
          }
          // Priority 0: property dot on long identifier chains
          else if (
            text[k] === "." &&
            k > 0 &&
            /[a-zA-Z0-9_]/.test(text[k - 1])
          ) {
            recordCandidate(absPos, 0);
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
            recordCandidate(pos, 3);
          } else {
            const subLines = splitLongString(
              tk.text,
              ind,
              maxCols - suffix.length
            );
            if (subLines.length > 1) {
              subLines[subLines.length - 1] += suffix;
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
  target: "es2022",
  charset: "utf8",
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
