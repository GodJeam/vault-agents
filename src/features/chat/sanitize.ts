/**
 * Prevent model-generated Markdown from silently fetching remote content.
 *
 * Obsidian's Markdown renderer loads images and media automatically. A model
 * response (or a prompt-injected note) could therefore embed a remote image
 * and leak the fact that the message was opened, or expose the user's IP.
 * Remote images and media are replaced with plain text; normal links are kept
 * because they require an explicit click. Code blocks and inline code spans
 * are preserved verbatim so technical examples are not corrupted.
 */
const REMOVED = "remote image removed";

/**
 * Split markdown into alternating non-code and code segments in O(n) time so
 * fenced code blocks and inline code spans are never altered.
 */
function mapOutsideCode(
  markdown: string,
  transform: (segment: string) => string
): string {
  const out: string[] = [];
  let textStart = 0;
  let i = 0;
  const len = markdown.length;

  while (i < len) {
    // Fenced code block at start of line: ``` or ~~~
    const atLineStart = i === 0 || markdown[i - 1] === "\n";
    if (atLineStart) {
      let lineIndent = i;
      while (
        lineIndent < len &&
        (markdown[lineIndent] === " " || markdown[lineIndent] === "\t")
      ) {
        lineIndent++;
      }
      const ch = markdown[lineIndent];
      if (ch === "`" || ch === "~") {
        let fenceLen = 0;
        while (markdown[lineIndent + fenceLen] === ch) fenceLen++;
        if (fenceLen >= 3) {
          const fence = ch.repeat(fenceLen);
          const firstNl = markdown.indexOf("\n", lineIndent + fenceLen);
          if (firstNl !== -1) {
            if (i > textStart) {
              out.push(transform(markdown.slice(textStart, i)));
            }
            let search = firstNl + 1;
            let endIdx = len;
            while (search < len) {
              const nl = markdown.indexOf("\n", search);
              const lineEnd = nl === -1 ? len : nl;
              const line = markdown.slice(search, lineEnd).trim();
              if (
                line.startsWith(fence) &&
                line.slice(fenceLen).trim() === ""
              ) {
                endIdx = nl === -1 ? len : nl + 1;
                break;
              }
              if (nl === -1) break;
              search = nl + 1;
            }
            out.push(markdown.slice(i, endIdx));
            i = endIdx;
            textStart = i;
            continue;
          }
        }
      }
    }

    // Inline code span: one or more backticks matched by the same count
    if (markdown[i] === "`") {
      let ticks = 0;
      while (markdown[i + ticks] === "`") ticks++;
      const closer = "`".repeat(ticks);
      let pos = i + ticks;
      let foundEnd = -1;
      while (pos < len) {
        if (markdown[pos] === "\n" && markdown[pos + 1] === "\n") break;
        if (markdown.startsWith(closer, pos)) {
          // Ensure exact backtick run length
          let run = 0;
          while (markdown[pos + run] === "`") run++;
          if (run === ticks) {
            foundEnd = pos + ticks;
            break;
          }
          pos += run;
          continue;
        }
        pos++;
      }
      if (foundEnd !== -1) {
        if (i > textStart) {
          out.push(transform(markdown.slice(textStart, i)));
        }
        out.push(markdown.slice(i, foundEnd));
        i = foundEnd;
        textStart = i;
        continue;
      }
      i += ticks;
      continue;
    }

    i++;
  }

  if (textStart < len) {
    out.push(transform(markdown.slice(textStart)));
  }
  return out.join("");
}

function normalizeRefLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function collectRefUsage(segments: string[]): {
  imageRefs: Set<string>;
  linkRefs: Set<string>;
} {
  const imageRefs = new Set<string>();
  const linkRefs = new Set<string>();
  const full = segments.join("\n");

  const imgFullRe = /!\[([^\]]*)\]\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = imgFullRe.exec(full)) !== null) {
    const label = m[2].trim() ? m[2] : m[1];
    if (label.trim()) imageRefs.add(normalizeRefLabel(label));
  }
  const imgShortRe = /!\[([^\]]+)\](?![(\[])/g;
  while ((m = imgShortRe.exec(full)) !== null) {
    imageRefs.add(normalizeRefLabel(m[1]));
  }

  const linkFullRe = /(?:^|[^!])\[([^\]]+)\]\[([^\]]*)\]/g;
  while ((m = linkFullRe.exec(full)) !== null) {
    const label = m[2].trim() ? m[2] : m[1];
    if (label.trim()) linkRefs.add(normalizeRefLabel(label));
  }
  const linkShortRe = /(?:^|[^!])\[([^\]]+)\](?![(\[:])/g;
  while ((m = linkShortRe.exec(full)) !== null) {
    linkRefs.add(normalizeRefLabel(m[1]));
  }

  return { imageRefs, linkRefs };
}

function sanitizeSegment(
  segment: string,
  imageRefs: Set<string>,
  linkRefs: Set<string>
): string {
  let out = segment;

  // Inline Markdown images: ![alt](https://…), ![alt](//…), ![alt](<https://…> "title")
  // Also handles one level of balanced parentheses in URLs.
  out = out.replace(
    /!\[([^\]]*)\]\(\s*<?(?:https?:)?\/\/(?:[^()\s>]|\([^()\s>]*\))+>?(?:\s+["'][^"']*["'])?\s*\)/gi,
    (_match, alt: string) => `[${alt || "image"} - ${REMOVED}]`
  );

  // Raw HTML images (any source, including srcset).
  out = out.replace(/<img\b[^>]*>/gi, (tag: string) => {
    const alt = /\balt\s*=\s*(?:["']([^"']*)["']|([^\s>]+))/i.exec(tag);
    return `[${alt?.[1] || alt?.[2] || "image"} - ${REMOVED}]`;
  });

  // Raw <style> blocks containing remote url(...) or @import.
  out = out.replace(
    /<style\b[^>]*>[\s\S]*?(?:<\/style>|$)/gi,
    (block: string) =>
      /(?:@import\b|url\s*\()[\s\S]*?(?:https?:)?\/\//i.test(block) ? "" : block
  );

  // Media/embed/SVG tags that point to a remote resource (quoted or unquoted).
  out = out.replace(
    /<(?:video|audio|source|iframe|embed|object|picture|image|feImage)\b[^>]*\b(?:src|href|xlink:href|data|poster)\s*=\s*(?:["'](?:https?:)?\/\/[^"']*["']|(?:https?:)?\/\/[^\s>]+)[^>]*>/gi,
    `[${REMOVED}]`
  );
  out = out.replace(
    /<link\b[^>]*\bhref\s*=\s*(?:["'](?:https?:)?\/\/[^"']*["']|(?:https?:)?\/\/[^\s>]+)[^>]*>/gi,
    ""
  );

  // Remote poster/srcset attributes on otherwise local media tags.
  out = out.replace(
    /\b(?:srcset|poster)\s*=\s*(?:["'](?:https?:)?\/\/[^"']*["']|(?:https?:)?\/\/[^\s>]+)/gi,
    ""
  );

  // CSS background images pointing to a remote URL.
  out = out.replace(
    /\b(?:style|background)\s*=\s*(?:["'][^"']*url\(\s*["']?(?:https?:)?\/\/[^)]*\)[^"']*["']|[^\s>]*url\(\s*["']?(?:https?:)?\/\/[^)]*\))/gi,
    ""
  );

  // Reference-style definitions pointing to a remote URL (single or multi-line).
  // Preserve definitions that are exclusively referenced as normal Markdown links,
  // while stripping image-referenced and unused definitions.
  out = out.replace(
    /^[ \t]*\[([^\]]+)\]:[ \t]*(?:\r?\n[ \t]*)?<?(?:https?:)?\/\/[^\s>]+>?.*$/gim,
    (match: string, label: string) => {
      const norm = normalizeRefLabel(label);
      if (linkRefs.has(norm) && !imageRefs.has(norm)) {
        return match;
      }
      return "";
    }
  );

  return out;
}

export function neutralizeRemoteMarkdown(markdown: string): string {
  if (!markdown) return markdown;
  const nonCodeSegments: string[] = [];
  mapOutsideCode(markdown, (seg) => {
    nonCodeSegments.push(seg);
    return seg;
  });
  const { imageRefs, linkRefs } = collectRefUsage(nonCodeSegments);
  return mapOutsideCode(markdown, (seg) =>
    sanitizeSegment(seg, imageRefs, linkRefs)
  );
}
