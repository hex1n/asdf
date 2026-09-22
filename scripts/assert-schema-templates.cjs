#!/usr/bin/env node

// Pin each Markdown ```json template to the schema that checks the result.
//
// A template is what an agent copies when it writes a brief or a record; the
// schema is what the validator applies to it. They are two copies of one field
// list, and a copy without a pin drifts: a field or an enum word added to one
// side is a record that fails for a reason its writer was never shown, or a
// field the writer never learns exists.
//
// The pin covers names and vocabulary, not prose. Every template key is a
// schema property and every schema property appears in the template; an enum
// is spelled `a | b | c` with exactly the schema's words; a const is itself;
// a `oneOf` over `kind` shows one item per kind. A reference's `text` is the
// one property a template may leave out: it is the alternative carrier for
// `path` plus `revision`, and the template shows the normal road; a schema
// that requires `text` gets no such exemption. A schema position this walk
// cannot read, including a node that mixes `oneOf` with `properties`, is
// reported rather than skipped, so a new schema shape cannot pass by being
// unfamiliar; and a template string spelled `a | b | c` where the schema fixes
// no enum is reported too, since it teaches a vocabulary nothing checks.
//
// The pairs are listed, not discovered: a listed pair whose file or fence goes
// missing fails, where a discovered one would quietly stop being checked.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const TEMPLATES = [
  { doc: "skills/scrutineer/HANDOFF.md", schema: "skills/scrutineer/handoff-schema.json" },
  { doc: "skills/scrutineer/REPORT.md", schema: "skills/scrutineer/review-record-schema.json" },
];

function readTemplate(markdown) {
  const fence = markdown.match(/```json\r?\n([\s\S]*?)\r?\n```/u);
  return fence ? JSON.parse(fence[1]) : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function templateProblems(template, schema) {
  const problems = [];
  const walk = (value, node, label) => {
    if (!isPlainObject(node)) {
      problems.push(`${label}: the schema has no node here`);
      return;
    }
    if (Array.isArray(node.oneOf)) {
      if (Object.hasOwn(node, "properties") || Object.hasOwn(node, "required")) {
        problems.push(`${label}: the schema mixes oneOf with properties, which this pin cannot read`);
        return;
      }
      const variant = node.oneOf.find((option) => option?.properties?.kind?.const === value?.kind);
      if (variant) walk(value, variant, label);
      else problems.push(`${label}: kind ${JSON.stringify(value?.kind)} is not one the schema defines`);
      return;
    }
    if (Object.hasOwn(node, "const")) {
      if (value !== node.const) problems.push(`${label}: must be the schema's const ${JSON.stringify(node.const)}`);
      return;
    }
    if (Array.isArray(node.enum)) {
      const words = typeof value === "string" ? value.split(" | ").sort() : null;
      const expected = [...node.enum].map(String).sort();
      if (!words || words.join("\n") !== expected.join("\n")) {
        problems.push(`${label}: must spell the schema's enum as ${JSON.stringify(node.enum.join(" | "))}`);
      }
      return;
    }
    if (node.type === "object") {
      if (!isPlainObject(node.properties)) {
        problems.push(`${label}: the schema object lists no properties, so the template cannot be pinned to it`);
        return;
      }
      if (!isPlainObject(value)) {
        problems.push(`${label}: must be an object`);
        return;
      }
      const keys = Object.keys(value);
      for (const key of keys) {
        if (!Object.hasOwn(node.properties, key)) problems.push(`${label}.${key}: is not in the schema`);
      }
      for (const key of Object.keys(node.properties)) {
        const alternativeCarrier = key === "text" && Object.hasOwn(node.properties, "path") && keys.includes("path")
          && !(node.required ?? []).includes("text");
        if (!alternativeCarrier && !keys.includes(key)) problems.push(`${label}.${key}: is in the schema but absent from the template`);
      }
      for (const key of keys) {
        if (Object.hasOwn(node.properties, key)) walk(value[key], node.properties[key], `${label}.${key}`);
      }
      return;
    }
    if (node.type === "array") {
      if (!isPlainObject(node.items)) {
        problems.push(`${label}: the schema array names no items, so the template cannot be pinned to it`);
        return;
      }
      if (!Array.isArray(value) || value.length === 0) {
        problems.push(`${label}: must show at least one item`);
        return;
      }
      value.forEach((item, index) => walk(item, node.items, `${label}[${index}]`));
      if (Array.isArray(node.items.oneOf)) {
        const shown = value.map((item) => item?.kind);
        for (const option of node.items.oneOf) {
          const kind = option?.properties?.kind?.const;
          if (!shown.includes(kind)) problems.push(`${label}: shows no item of kind ${JSON.stringify(kind)}`);
        }
      }
      return;
    }
    if (node.type === "integer") {
      if (!Number.isInteger(value)) problems.push(`${label}: must be an integer`);
      return;
    }
    if (node.type === "string") {
      if (typeof value !== "string") problems.push(`${label}: must be a string`);
      else if (value.includes(" | ")) problems.push(`${label}: spells a vocabulary the schema fixes no enum for`);
      return;
    }
    problems.push(`${label}: schema type ${JSON.stringify(node.type)} is one this pin cannot read`);
  };
  walk(template, schema, "$");
  return problems;
}

function main() {
  let failed = false;
  for (const { doc, schema } of TEMPLATES) {
    let problems;
    try {
      const template = readTemplate(fs.readFileSync(path.join(ROOT, doc), "utf8"));
      problems = template === null
        ? ["has no ```json template"]
        : templateProblems(template, JSON.parse(fs.readFileSync(path.join(ROOT, schema), "utf8")));
    } catch (error) {
      problems = [`cannot be checked against ${schema}: ${error.message}`];
    }
    for (const problem of problems) process.stdout.write(`FAIL: ${doc} ${problem}\n`);
    if (problems.length > 0) failed = true;
  }
  if (failed) process.exitCode = 1;
  else process.stdout.write(`PASS: ${TEMPLATES.length} templates carry their schemas' fields and vocabulary (${TEMPLATES.map((pair) => pair.doc).join(", ")})\n`);
}

// require.main is a module identity, not a path comparison, so it stays
// correct when the script is reached through a symlink or junction.
if (require.main === module) main();

module.exports = { templateProblems, readTemplate, TEMPLATES };
