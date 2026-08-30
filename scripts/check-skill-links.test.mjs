import assert from "node:assert/strict";
import test from "node:test";

import { slug, headingAnchors, extractLinks } from "./check-skill-links.mjs";

test("slug matches GitHub anchor generation, including the & collapse", () => {
  assert.equal(slug("Path Containment Proof"), "path-containment-proof");
  // "&" is dropped as a non-word character but its surrounding spaces both
  // become hyphens — this is why real links read `#gap--defect-disposition`,
  // and a naive single-hyphen slug would report every such link as broken.
  assert.equal(slug("Gap & Defect Disposition"), "gap--defect-disposition");
  assert.equal(slug("`execution-report.md` structural contract"), "execution-reportmd-structural-contract");
});

test("headings inside fenced blocks are not anchors", () => {
  // A skill that documents an artifact tree in a fence would otherwise gain
  // phantom anchors from lines that only look like headings.
  const md = [
    "# Real Heading",
    "",
    "```text",
    "# Not A Heading",
    "```",
    "",
    "## Second Real",
  ].join("\n");
  const anchors = headingAnchors(md);
  assert.ok(anchors.has("real-heading"));
  assert.ok(anchors.has("second-real"));
  assert.ok(!anchors.has("not-a-heading"));
});

test("links inside fenced blocks are not checked", () => {
  // A fenced example of a link is documentation, not a live pointer.
  const md = ["[live](REFERENCE.md#x)", "```", "[example](NOWHERE.md#y)", "```"].join("\n");
  const links = extractLinks(md);
  assert.equal(links.length, 1);
  assert.equal(links[0].target, "REFERENCE.md#x");
});

test("extractLinks records line numbers so a failure is locatable", () => {
  const md = ["intro", "", "see [x](A.md#b) here"].join("\n");
  const [link] = extractLinks(md);
  assert.equal(link.line, 3);
  assert.equal(link.target, "A.md#b");
});

test("same-file fragment links resolve against their own headings", () => {
  const md = ["## Oracle Types", "", "see [types](#oracle-types)"].join("\n");
  assert.ok(headingAnchors(md).has("oracle-types"));
  assert.equal(extractLinks(md)[0].target, "#oracle-types");
});

test("the repository's own skills all resolve", async () => {
  // The gate is only worth having if it passes on a correct tree; this pins
  // that the checker itself is not vacuously green.
  const { spawnSync } = await import("node:child_process");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const r = spawnSync(process.execPath, [path.join(here, "check-skill-links.mjs")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS: \d+ in-skill anchors/m);
});
