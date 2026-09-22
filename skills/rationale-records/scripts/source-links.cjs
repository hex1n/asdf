const path = require("node:path");

// These are document-relative Markdown links, interpreted by the editor that
// owns the preview. Keep machine paths and OS protocol handlers out of records.
function sourceLink(recordFile, sourceFile, line, paths = path) {
  if (!Number.isSafeInteger(line) || line < 1) throw new Error("Source line must be positive.");
  const relative = paths.relative(paths.dirname(recordFile), sourceFile);
  if (!relative || paths.isAbsolute(relative)) throw new Error("Source link must be document-relative.");
  const slashPath = paths.sep === "\\" ? relative.replaceAll("\\", "/") : relative;
  const encoded = slashPath.split("/").map((segment) => encodeURIComponent(segment)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
  return `${encoded.startsWith("../") || encoded.startsWith("./") ? encoded : `./${encoded}`}#L${line}`;
}

function linkedSnippet(shape, href) {
  const runs = shape.match(/`+/g) || [];
  const delimiter = "`".repeat(Math.max(0, ...runs.map((run) => run.length)) + 1);
  const padding = shape.startsWith("`") || shape.endsWith("`") ||
    (shape.startsWith(" ") && shape.endsWith(" ") && shape.trim()) ? " " : "";
  return `[${delimiter}${padding}${shape}${padding}${delimiter}](<${href}>)`;
}

function parseLinkedSnippet(value) {
  const match = /^\[(`+)(.+)\1\]\(<((?:\.\/|\.\.\/)[^<>\s]+#L[1-9]\d*)>\)$/.exec(value);
  if (!match) return null;
  const [, delimiter, content, href] = match;
  if ((content.match(/`+/g) || []).some((run) => run.length === delimiter.length)) return null;
  const shape = content.startsWith(" ") && content.endsWith(" ") && content.trim()
    ? content.slice(1, -1) : content;
  return { shape, href };
}

module.exports = { sourceLink, linkedSnippet, parseLinkedSnippet };
