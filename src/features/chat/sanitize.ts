/**
 * Prevent model-generated Markdown from silently fetching remote content.
 *
 * Obsidian's Markdown renderer loads images and media automatically. A model
 * response (or a prompt-injected note) could therefore embed a remote image
 * and leak the fact that the message was opened, or expose the user's IP.
 * Remote images and media are replaced with plain text; normal links are kept
 * because they require an explicit click.
 */
const REMOVED = "remote image removed";

export function neutralizeRemoteMarkdown(markdown: string): string {
  let out = markdown;

  // Inline Markdown images: ![alt](https://…), ![alt](//…), ![alt](<https://…> "title")
  out = out.replace(
    /!\[([^\]]*)\]\(\s*<?(?:https?:)?\/\/[^)\s>]+>?(?:\s+["'][^"']*["'])?\s*\)/gi,
    (_match, alt: string) => `[${alt || "image"} — ${REMOVED}]`
  );

  // Raw HTML images (any source, including srcset).
  out = out.replace(/<img\b[^>]*>/gi, (tag: string) => {
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    return `[${alt || "image"} — ${REMOVED}]`;
  });

  // Media/embed tags that point to a remote resource.
  out = out.replace(
    /<(?:video|audio|source|iframe|embed|object)\b[^>]*\b(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']*["'][^>]*>/gi,
    `[${REMOVED}]`
  );
  out = out.replace(
    /<link\b[^>]*\bhref\s*=\s*["'](?:https?:)?\/\/[^"']*["'][^>]*>/gi,
    ""
  );

  // Remote poster/srcset attributes on otherwise local media tags.
  out = out.replace(
    /\b(?:srcset|poster)\s*=\s*["'](?:https?:)?\/\/[^"']*["']/gi,
    ""
  );

  // CSS background images pointing to a remote URL.
  out = out.replace(
    /\b(?:style|background)\s*=\s*["'][^"']*url\(\s*["']?(?:https?:)?\/\/[^)]*\)[^"']*["']/gi,
    ""
  );

  // Reference-style image definitions pointing to a remote URL. The usage
  // (![alt][ref]) then renders as plain text and cannot trigger a request.
  out = out.replace(
    /^[ \t]*\[[^\]]+\]:\s*<?(?:https?:)?\/\/[^\s>]+>?.*$/gim,
    ""
  );

  return out;
}
