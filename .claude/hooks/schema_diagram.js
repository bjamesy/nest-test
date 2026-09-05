#!/usr/bin/env node
/**
 * Regenerate a Mermaid flowchart from NestJS + Mongoose schema files.
 *
 * Each @Schema() class becomes a flowchart node listing its fields; each
 * ref: '...' relation becomes a labeled edge to the referenced entity's
 * node. Kept as a flowchart (not erDiagram) so the schema sheet matches
 * the same diagram type as docs/modules.mmd and docs/architecture.mmd.
 *
 * This is intentionally NOT ts-morph/AST-based and does NOT boot the Nest
 * app or connect to Mongo. It's a regex scan over `*.schema.ts` files
 * looking for `@Schema()` classes and `@Prop(...)` fields. That keeps it:
 *   - fast (runs on every schema file save)
 *   - zero-dependency (no LLM call, no compile step, no DB connection)
 *   - safe to run mid-edit (a syntax error in one file just skips it)
 *
 * Trade-off: it won't catch exotic patterns (dynamically composed schemas,
 * mixins, decorators split across helper functions). For a practice project
 * that's a fine trade. If you outgrow it, swap this for a ts-morph AST walk.
 *
 * Usage: node schema_diagram.js <srcDir> <outFile>
 *   e.g. node schema_diagram.js src docs/schema.mmd
 */

const fs = require("fs");
const path = require("path");

const [, , srcDirArg, outFileArg] = process.argv;
if (!srcDirArg || !outFileArg) {
  console.error("Usage: node schema_diagram.js <srcDir> <outFile>");
  process.exit(1);
}

const srcDir = path.resolve(srcDirArg);
const outFile = path.resolve(outFileArg);

function findSchemaFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findSchemaFiles(full));
    } else if (entry.name.endsWith(".schema.ts")) {
      results.push(full);
    }
  }
  return results;
}

// Matches: @Schema()  export class Something { ... } (non-greedy body)
const CLASS_RE = /@Schema\([^)]*\)\s*export\s+class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{([\s\S]*?)\n\}/g;

// Matches: @Prop({ ...options... }) fieldName: Type;   OR   @Prop() fieldName: Type;
const PROP_RE = /@Prop\(([^)]*)\)\s*\n?\s*(\w+)\??:\s*([^\n;]+);?/g;

function parseRefFromOptions(optionsStr) {
  const refMatch = optionsStr.match(/ref:\s*['"](\w+)['"]/);
  return refMatch ? refMatch[1] : null;
}

function stripArraySyntax(type) {
  return type.replace(/\[\]$/, "").trim();
}

function main() {
  const files = findSchemaFiles(srcDir);
  const entities = []; // { name, fields: [{name, type}], relations: [{field, targetType, array}] }

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    let classMatch;
    CLASS_RE.lastIndex = 0;
    while ((classMatch = CLASS_RE.exec(content)) !== null) {
      const [, className, body] = classMatch;
      const entity = { name: className, fields: [], relations: [] };

      let propMatch;
      PROP_RE.lastIndex = 0;
      while ((propMatch = PROP_RE.exec(body)) !== null) {
        const [, optionsStr, fieldName, rawType] = propMatch;
        const isArray = /\[\]\s*$/.test(rawType.trim()) || /Types\.ObjectId\[\]/.test(rawType);
        const ref = parseRefFromOptions(optionsStr);
        const cleanType = stripArraySyntax(rawType).replace(/^Types\.ObjectId$/, "ObjectId");

        if (ref) {
          entity.relations.push({ field: fieldName, target: ref, array: isArray });
        } else {
          entity.fields.push({ name: fieldName, type: cleanType });
        }
      }
      entities.push(entity);
    }
  }

  const lines = ["flowchart TD"];

  function escapeLabel(str) {
    return str.replace(/"/g, "'");
  }

  for (const entity of entities) {
    const fieldLines = entity.fields.map((f) => {
      const safeType = f.type.replace(/\s+/g, "_").replace(/[^\w<>_]/g, "");
      return escapeLabel(`${f.name}: ${safeType}`);
    });
    const label = [entity.name, ...fieldLines].join("<br/>");
    lines.push(`    ${entity.name}["${label}"]`);
  }

  for (const entity of entities) {
    for (const rel of entity.relations) {
      const arrow = rel.array ? "==>" : "-->";
      const label = rel.array ? `${rel.field} []` : rel.field;
      lines.push(`    ${entity.name} ${arrow}|"${escapeLabel(label)}"| ${rel.target}`);
    }
  }

  if (entities.length === 0) {
    lines.push('    %% No @Schema() classes found under ' + path.relative(process.cwd(), srcDir));
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lines.join("\n") + "\n");
  console.log(`Wrote ${entities.length} entities to ${path.relative(process.cwd(), outFile)}`);
}

main();
