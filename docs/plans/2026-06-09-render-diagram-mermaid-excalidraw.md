# render_diagram Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a new pi tool `render_diagram` that takes Mermaid source and emits an editable `.mmd`, a rendered `.svg`, a raster `.png`, and an editable `.excalidraw` scene, plus an inline Unicode preview in the TUI — leaving the existing `render_graph` untouched.

**Architecture:** A subdirectory extension `extensions/mermaid-graph/` with: a browser entry bundled by esbuild (`browser-entry.js` → `dist/bundle.js`) that exposes `window.renderDiagram()`; a standalone Node renderer (`mermaid-render.mjs`) that drives the existing browser-tools Puppeteer/Chromium to produce files; a Unicode preview module (`unicode-preview.ts`) reused from the current renderer for flowcharts; and `index.ts` that registers the tool and orchestrates everything.

**Tech Stack:** TypeScript (pi extension), Node ESM, esbuild, mermaid@11.15.0, @excalidraw/mermaid-to-excalidraw@2.2.2, @excalidraw/excalidraw@0.18.1, Puppeteer (reused from `skills/pi-skills/browser-tools/node_modules`).

---

## Key facts validated during brainstorming (do not re-derive)

- Extensions support subdirectory form: `~/.pi/agent/extensions/*/index.ts` is auto-discovered.
- Puppeteer + Chromium already exist at
  `/Users/FLP9damarpramuditya/.pi/agent/skills/pi-skills/browser-tools/node_modules` (puppeteer 24.31.0;
  `puppeteer.executablePath()` resolves to the cached Chrome for Testing). Resolve it with
  `createRequire(<that path>/)`.
- `mermaid.render(id, def)` → `{ svg }`. `parseMermaidToExcalidraw(def)` → `{ elements (skeletons), files }`.
  `convertToExcalidrawElements(elements)` (from `@excalidraw/excalidraw`) → full elements with `id`/`seed`/etc.
- Bare ESM imports do NOT resolve in a raw Puppeteer page → bundle a browser entry with esbuild (IIFE).
- A spike of the entire chain succeeded: SVG (14.5KB) + 13 full Excalidraw elements + valid `.excalidraw` v2 JSON.
- `node_modules/` is gitignored (`**/node_modules/`). Commit `package.json` + `package-lock.json`; do NOT commit `node_modules/` or `dist/bundle.js` (built artifact, gitignored — see Task 1).

## File Structure

All paths relative to repo root (`~/.pi/agent` → `~/git/pi-config`).

- `extensions/mermaid-graph/package.json` — deps + build/test scripts (already scaffolded with the 4 deps).
- `extensions/mermaid-graph/.gitignore` — ignore `dist/` (built bundle).
- `extensions/mermaid-graph/browser-entry.js` — imports mermaid + converters; exposes `window.renderDiagram`.
- `extensions/mermaid-graph/build.mjs` — esbuild bundling `browser-entry.js` → `dist/bundle.js`.
- `extensions/mermaid-graph/mermaid-render.mjs` — standalone Node renderer (Puppeteer); CLI-runnable.
- `extensions/mermaid-graph/unicode-preview.ts` — flowchart-only Unicode preview; returns `null` when not renderable.
- `extensions/mermaid-graph/index.ts` — the pi extension; registers `render_diagram`; orchestration + rendering.
- `extensions/mermaid-graph/test/render.test.mjs` — standalone test (node:test) for `mermaid-render.mjs`.
- `extensions/mermaid-graph/test/fixtures/flowchart.mmd`, `sequence.mmd` — test inputs.

---

## Task 1: Scaffold package, scripts, and ignore built artifacts

**Files:**
- Modify: `extensions/mermaid-graph/package.json`
- Create: `extensions/mermaid-graph/.gitignore`

**Step 1: Set package.json contents**

```json
{
  "name": "mermaid-graph-ext",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "test": "node --test test/"
  },
  "dependencies": {
    "@excalidraw/excalidraw": "^0.18.1",
    "@excalidraw/mermaid-to-excalidraw": "^2.2.2",
    "esbuild": "^0.28.0",
    "mermaid": "^11.15.0"
  }
}
```

**Step 2: Create `.gitignore`**

```
dist/
node_modules/
```

**Step 3: Ensure deps are installed**

Run: `cd extensions/mermaid-graph && npm install`
Expected: `node_modules/` present; no error. (Already installed during the spike; this verifies a clean install reproduces.)

**Step 4: Commit**

```bash
git add extensions/mermaid-graph/package.json extensions/mermaid-graph/package-lock.json extensions/mermaid-graph/.gitignore
git commit -m "feat(mermaid-graph): scaffold extension package + deps"
```

---

## Task 2: Browser entry + esbuild build → dist/bundle.js

**Files:**
- Create: `extensions/mermaid-graph/browser-entry.js`
- Create: `extensions/mermaid-graph/build.mjs`

**Step 1: Write `browser-entry.js`**

```js
import mermaid from "mermaid";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

mermaid.initialize({ startOnLoad: false });

// Returns { svg, excalidraw: { elements, files } | null, excalidrawError: string | null }
window.renderDiagram = async (definition) => {
  const id = "d" + Math.random().toString(36).slice(2);
  const { svg } = await mermaid.render(id, definition);
  let excalidraw = null;
  let excalidrawError = null;
  try {
    const { elements, files } = await parseMermaidToExcalidraw(definition);
    const full = convertToExcalidrawElements(elements);
    excalidraw = { elements: full, files: files || {} };
  } catch (e) {
    excalidrawError = String((e && e.message) || e);
  }
  return { svg, excalidraw, excalidrawError };
};
```

**Step 2: Write `build.mjs`**

```js
import { build } from "esbuild";
import { fileURLToPath } from "url";
import path from "path";

const dir = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(dir, "browser-entry.js")],
  bundle: true,
  format: "iife",
  outfile: path.join(dir, "dist", "bundle.js"),
  logLevel: "error",
  // Excalidraw expects a browser; define a benign env.
  define: { "process.env.NODE_ENV": '"production"' },
});

console.log("built dist/bundle.js");
```

**Step 3: Build and verify**

Run: `cd extensions/mermaid-graph && npm run build`
Expected: prints `built dist/bundle.js`; `dist/bundle.js` exists (~14MB).
Verify: `test -f dist/bundle.js && echo OK`

**Step 4: Commit**

```bash
git add extensions/mermaid-graph/browser-entry.js extensions/mermaid-graph/build.mjs
git commit -m "feat(mermaid-graph): browser entry + esbuild bundle"
```

(Note: `dist/bundle.js` is gitignored. The renderer in Task 3 builds it on demand if missing.)

---

## Task 3: Standalone Node renderer (TDD)

**Files:**
- Create: `extensions/mermaid-graph/mermaid-render.mjs`
- Create: `extensions/mermaid-graph/test/fixtures/flowchart.mmd`
- Create: `extensions/mermaid-graph/test/fixtures/sequence.mmd`
- Test: `extensions/mermaid-graph/test/render.test.mjs`

**Step 1: Write fixtures**

`test/fixtures/flowchart.mmd`:
```
flowchart TD
  A[Start] --> B{Decision}
  B -->|yes| C[Do it]
  B -->|no| D[Skip]
```

`test/fixtures/sequence.mmd`:
```
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi
```

**Step 2: Write the failing test `test/render.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderDiagram } from "../mermaid-render.mjs";

test("renders flowchart to svg + png + excalidraw", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rd-"));
  const def = fs.readFileSync(new URL("./fixtures/flowchart.mmd", import.meta.url), "utf8");
  const res = await renderDiagram({ mermaid: def, name: "flow", outDir: out, formats: ["mmd", "svg", "png", "excalidraw"] });

  assert.ok(fs.existsSync(path.join(out, "flow.mmd")));
  assert.ok(fs.existsSync(path.join(out, "flow.svg")));
  assert.ok(fs.existsSync(path.join(out, "flow.png")));
  assert.ok(fs.existsSync(path.join(out, "flow.excalidraw")));

  const exc = JSON.parse(fs.readFileSync(path.join(out, "flow.excalidraw"), "utf8"));
  assert.equal(exc.type, "excalidraw");
  assert.equal(exc.version, 2);
  assert.ok(exc.elements.length > 0);
  assert.ok(exc.elements[0].id);

  assert.deepEqual([...res.written].sort(), ["excalidraw", "mmd", "png", "svg"]);
});

test("surfaces mermaid parse errors", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rd-"));
  await assert.rejects(
    () => renderDiagram({ mermaid: "flowchart TD\n A -->", name: "bad", outDir: out, formats: ["svg"] }),
    /mermaid|parse|syntax/i,
  );
});
```

Run: `cd extensions/mermaid-graph && node --test test/render.test.mjs`
Expected: FAIL — `Cannot find module '../mermaid-render.mjs'`.

**Step 3: Implement `mermaid-render.mjs`**

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const __dir = path.dirname(fileURLToPath(import.meta.url));

// Resolve puppeteer from the browser-tools skill (shared Chromium, no extra install).
const BROWSER_TOOLS = "/Users/FLP9damarpramuditya/.pi/agent/skills/pi-skills/browser-tools/node_modules/";

function loadPuppeteer() {
  try {
    const require = createRequire(BROWSER_TOOLS);
    return require("puppeteer");
  } catch (e) {
    throw new Error(
      "Puppeteer not found. Run: cd ~/.pi/agent/skills/pi-skills/browser-tools && npm install",
    );
  }
}

function ensureBundle() {
  const bundle = path.join(__dir, "dist", "bundle.js");
  if (!fs.existsSync(bundle)) {
    const r = spawnSync("node", [path.join(__dir, "build.mjs")], { cwd: __dir, stdio: "inherit" });
    if (r.status !== 0) throw new Error("Failed to build dist/bundle.js");
  }
  return fs.readFileSync(bundle, "utf8");
}

function slug(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// renderDiagram({ mermaid, name?, outDir?, formats? }) -> { written: string[], paths: Record<string,string>, excalidrawError?: string }
export async function renderDiagram({ mermaid, name, outDir = "diagrams", formats = ["mmd", "svg", "png", "excalidraw"] }) {
  if (!mermaid || !mermaid.trim()) throw new Error("Empty mermaid source");
  const base = slug(name) || slug(mermaid.split("\n")[0]) || `diagram-${Date.now()}`;
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  const paths = {};
  const wantsBrowser = formats.some((f) => f === "svg" || f === "png" || f === "excalidraw");

  if (formats.includes("mmd")) {
    const p = path.join(outDir, `${base}.mmd`);
    fs.writeFileSync(p, mermaid.endsWith("\n") ? mermaid : mermaid + "\n");
    written.push("mmd"); paths.mmd = p;
  }

  let excalidrawError;
  if (wantsBrowser) {
    const bundle = ensureBundle();
    const puppeteer = loadPuppeteer();
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script>${bundle}</script></body></html>`;
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const result = await page.evaluate(async (d) => {
        try { return { ok: true, ...(await window.renderDiagram(d)) }; }
        catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
      }, mermaid);

      if (!result.ok) throw new Error("Mermaid render failed: " + result.error);

      if (formats.includes("svg")) {
        const p = path.join(outDir, `${base}.svg`);
        fs.writeFileSync(p, result.svg);
        written.push("svg"); paths.svg = p;
      }
      if (formats.includes("png")) {
        // Render SVG into the page and screenshot it for a clean raster.
        await page.evaluate((svg) => { document.getElementById("root").innerHTML = svg; }, result.svg);
        const el = await page.$("#root svg");
        const p = path.join(outDir, `${base}.png`);
        await el.screenshot({ path: p, omitBackground: true });
        written.push("png"); paths.png = p;
      }
      if (formats.includes("excalidraw")) {
        if (result.excalidraw) {
          const file = {
            type: "excalidraw", version: 2, source: "render_diagram",
            elements: result.excalidraw.elements,
            appState: { viewBackgroundColor: "#ffffff", gridSize: null },
            files: result.excalidraw.files || {},
          };
          const p = path.join(outDir, `${base}.excalidraw`);
          fs.writeFileSync(p, JSON.stringify(file, null, 2));
          written.push("excalidraw"); paths.excalidraw = p;
        } else {
          excalidrawError = result.excalidrawError || "excalidraw conversion unavailable for this diagram type";
        }
      }
    } finally {
      await browser.close();
    }
  }

  return { written, paths, base, ...(excalidrawError ? { excalidrawError } : {}) };
}

// CLI: node mermaid-render.mjs <file.mmd> [outDir] [name]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , file, outDir, name] = process.argv;
  if (!file) { console.error("usage: node mermaid-render.mjs <file.mmd> [outDir] [name]"); process.exit(1); }
  const src = fs.readFileSync(file, "utf8");
  const res = await renderDiagram({ mermaid: src, outDir: outDir || "diagrams", name });
  console.log(JSON.stringify(res, null, 2));
}
```

**Step 4: Run tests to verify they pass**

Run: `cd extensions/mermaid-graph && node --test test/render.test.mjs`
Expected: PASS (both tests). First run builds the bundle if absent (may take ~30s).

**Step 5: Commit**

```bash
git add extensions/mermaid-graph/mermaid-render.mjs extensions/mermaid-graph/test/
git commit -m "feat(mermaid-graph): standalone puppeteer renderer + tests"
```

---

## Task 4: Unicode preview module (flowchart only)

**Files:**
- Create: `extensions/mermaid-graph/unicode-preview.ts`
- Test: `extensions/mermaid-graph/test/preview.test.mjs`

**Context:** The existing `extensions/markdown-graph.ts` already contains a working flowchart
parser + renderer (`parseDSL`, `layoutNodes`, `renderFlowchart`, `renderNodeBox`, `visibleLen`,
`placeText`, `COLORS`). Reuse it by copying those functions into `unicode-preview.ts` and exposing a
single wrapper. Do NOT modify `markdown-graph.ts`.

**Step 1: Create `unicode-preview.ts`**

Copy verbatim into this file, from `extensions/markdown-graph.ts`, these definitions:
`Node`, `Edge`, `DiagramType`, `ParsedDiagram`, `LayoutNode` interfaces; and the functions
`parseDSL`, `layoutNodes`, `COLORS`, `renderNodeBox`, `renderFlowchart`, `visibleLen`, `placeText`.
Then append this wrapper at the end and export it:

```ts
// Returns a Unicode flowchart preview, or null if the source is not a
// flowchart/graph the simple renderer can handle (caller shows a status line instead).
export function renderFlowchartPreview(mermaid: string, theme: any, maxWidth = 80): string | null {
  const first = mermaid.trim().split("\n")[0]?.toLowerCase() ?? "";
  if (!(first.startsWith("flowchart") || first.startsWith("graph"))) return null;
  // Normalize "graph TD"/"flowchart LR" → the parser only checks the first token.
  const normalized = first.startsWith("graph")
    ? mermaid.replace(/^\s*graph\b/i, "flowchart")
    : mermaid;
  try {
    const diagram = parseDSL(normalized);
    if (diagram.nodes.length === 0) return null;
    const out = renderFlowchart(diagram, theme, maxWidth);
    return out && out.trim().length > 0 ? out : null;
  } catch {
    return null;
  }
}
```

**Step 2: Write the test `test/preview.test.mjs`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFlowchartPreview } from "../unicode-preview.ts";

const theme = { fg: (_c, s) => s };

test("renders a flowchart preview", () => {
  const out = renderFlowchartPreview("flowchart TD\n A[Start] --> B[End]", theme);
  assert.ok(out && out.includes("Start") && out.includes("End"));
});

test("normalizes graph keyword", () => {
  const out = renderFlowchartPreview("graph LR\n A[One] --> B[Two]", theme);
  assert.ok(out && out.includes("One"));
});

test("returns null for sequence diagrams", () => {
  const out = renderFlowchartPreview("sequenceDiagram\n Alice->>Bob: Hi", theme);
  assert.equal(out, null);
});
```

**Step 3: Run the test**

Run: `cd extensions/mermaid-graph && node --test test/preview.test.mjs`
Expected: PASS (3 tests). (Node 24 runs `.ts` via its built-in stripping; if the runner cannot
import `.ts`, change the import to a built `.js` — but pi itself loads `.ts` extensions, so `.ts`
import under `node --test` is expected to work on this Node version.)

**Step 4: Commit**

```bash
git add extensions/mermaid-graph/unicode-preview.ts extensions/mermaid-graph/test/preview.test.mjs
git commit -m "feat(mermaid-graph): flowchart unicode preview module + tests"
```

---

## Task 5: The pi extension — register `render_diagram`

**Files:**
- Create: `extensions/mermaid-graph/index.ts`

**Step 1: Write `index.ts`**

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { renderFlowchartPreview } from "./unicode-preview.ts";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Import the renderer's exported function without spawning a subprocess.
const { renderDiagram } = require("./mermaid-render.mjs");

const Params = Type.Object({
  mermaid: Type.String({ description: "Mermaid diagram source (flowchart, sequence, class, state, er, gantt, pie, etc.)" }),
  name: Type.Optional(Type.String({ description: "Base filename (no extension). Defaults to a slug of the first line." })),
  outDir: Type.Optional(Type.String({ description: "Output directory. Default: ./diagrams" })),
  formats: Type.Optional(Type.Array(Type.String(), { description: "Subset of: mmd, svg, png, excalidraw. Default: all." })),
});

function statusBlock(res: any): string {
  const lines = (res.written as string[]).map((f) => `  \u2713 ${res.paths[f]}`);
  if (res.excalidrawError) lines.push(`  \u26a0 excalidraw skipped: ${res.excalidrawError}`);
  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "render_diagram",
    label: "Render Diagram",
    description:
      "Render a Mermaid diagram to editable files: .mmd source, .svg, .png, and an editable .excalidraw scene. " +
      "Shows a Unicode preview for flowcharts. Supports all Mermaid diagram types. Distinct from render_graph (terminal-only).",
    promptSnippet: "Render Mermaid diagrams to editable .svg/.png/.excalidraw files",
    promptGuidelines: [
      "Use render_diagram when the user wants a real, editable diagram file (Excalidraw or SVG), not just terminal art.",
      "Write standard Mermaid syntax. The tool reports the written file paths.",
      "render_graph remains available for quick terminal-only Unicode diagrams.",
    ],
    parameters: Params,

    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const outDir = params.outDir || "diagrams";
      const formats = params.formats || ["mmd", "svg", "png", "excalidraw"];
      try {
        const res = await renderDiagram({ mermaid: params.mermaid, name: params.name, outDir, formats });
        const text = `Wrote ${res.written.length} file(s):\n${statusBlock(res)}`;
        return {
          content: [{ type: "text", text }],
          details: { mermaid: params.mermaid, paths: res.paths, written: res.written, excalidrawError: res.excalidrawError },
        };
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `render_diagram error: ${e.message}` }],
          details: { error: e.message, mermaid: params.mermaid },
          isError: true,
        };
      }
    },

    renderCall(args, theme, _ctx) {
      const first = args.mermaid?.trim().split("\n")[0] || "diagram";
      return new Text(theme.fg("toolTitle", "render_diagram ") + theme.fg("muted", first), 0, 0);
    },

    renderResult(result, _options, theme, _ctx) {
      const details: any = result.details || {};
      if (details.error) return new Text(theme.fg("error", `render_diagram: ${details.error}`), 0, 0);

      const preview = details.mermaid ? renderFlowchartPreview(details.mermaid, theme, 80) : null;
      const status = (details.written || [])
        .map((f: string) => theme.fg("success", "\u2713 ") + theme.fg("muted", details.paths[f]))
        .concat(details.excalidrawError ? [theme.fg("warning", `\u26a0 excalidraw: ${details.excalidrawError}`)] : [])
        .join("\n");

      const body = preview ? `${preview}\n\n${status}` : status;
      return new Text(body || theme.fg("dim", "(no output)"), 0, 0);
    },
  });
}
```

**Step 2: Load it in a real pi session (manual smoke test)**

Run: `pi -e extensions/mermaid-graph/index.ts`
Then ask the model: `render_diagram with mermaid "flowchart TD\n A[Start] --> B[End]"`.
Expected: tool runs; `diagrams/*.svg`, `*.png`, `*.excalidraw`, `*.mmd` created; TUI shows a Unicode
flowchart preview followed by the file paths.
Verify files: `ls diagrams/`

**Step 3: Commit**

```bash
git add extensions/mermaid-graph/index.ts
git commit -m "feat(mermaid-graph): register render_diagram tool"
```

---

## Task 6: Multi-type + fallback verification

**Files:** (no new files; verification + fixtures already exist)

**Step 1: Sequence diagram (no Unicode preview, files still produced)**

Run: `cd extensions/mermaid-graph && node mermaid-render.mjs test/fixtures/sequence.mmd /tmp/rd-seq seq`
Expected JSON output lists `written` including `svg`, `png`, `excalidraw` (or an `excalidrawError`
for unsupported conversion — that is acceptable; svg/png must still succeed).
Verify: `ls /tmp/rd-seq` shows `seq.svg`, `seq.png`.

**Step 2: Confirm preview fallback**

In a `pi -e` session, call `render_diagram` with the sequence fixture content.
Expected: NO Unicode art (renderFlowchartPreview returns null), only the file-path status block.

**Step 3: Confirm `render_graph` still works (regression)**

In the same session, call `render_graph` with `flowchart\n A[X] --> B[Y]`.
Expected: existing Unicode output unchanged.

**Step 4: Commit (if any fixture/doc tweaks were needed)**

```bash
git add -A extensions/mermaid-graph
git commit -m "test(mermaid-graph): verify multi-type rendering + preview fallback" || echo "nothing to commit"
```

---

## Task 7: Document the new tool

**Files:**
- Modify: `docs/plans/2026-06-09-render-diagram-mermaid-excalidraw-design.md` (append "Implemented" note)
- Create: `extensions/mermaid-graph/README.md`

**Step 1: Write `extensions/mermaid-graph/README.md`**

```markdown
# mermaid-graph extension

Registers the `render_diagram` tool: Mermaid source -> `.mmd`, `.svg`, `.png`, and editable `.excalidraw`.
Coexists with the terminal-only `render_graph` tool.

## Setup
    cd extensions/mermaid-graph && npm install && npm run build

## How it works
- `browser-entry.js` (bundled by esbuild to `dist/bundle.js`) exposes `window.renderDiagram`.
- `mermaid-render.mjs` drives the browser-tools Puppeteer/Chromium headless to produce files.
- `unicode-preview.ts` renders a flowchart preview in the TUI (other types show a status line).

## CLI
    node mermaid-render.mjs path/to/diagram.mmd [outDir] [name]

## Tests
    npm test
```

**Step 2: Append an "Implemented" line to the design doc**

Add at the bottom of `docs/plans/2026-06-09-render-diagram-mermaid-excalidraw-design.md`:
```
## Status update
Implemented on branch `feat/render-diagram` as `extensions/mermaid-graph/`. See README there.
```

**Step 3: Commit**

```bash
git add extensions/mermaid-graph/README.md docs/plans/2026-06-09-render-diagram-mermaid-excalidraw-design.md
git commit -m "docs(mermaid-graph): README + design status update"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** C+D output (Task 3 files + Task 4/5 preview); Mermaid→both (Task 3 svg+excalidraw);
  reuse browser-tools Puppeteer (Task 3 `loadPuppeteer`); keep both tools w/ new name `render_diagram`
  (Task 5 + Task 6 Step 3 regression); offline local deps (Task 1); per-format independence + error
  surfacing (Task 3 `excalidrawError`, Task 5 isError); testing (Tasks 3,4,6). All covered.
- **Placeholder scan:** none — every code step contains complete code.
- **Type consistency:** `renderDiagram({ mermaid, name, outDir, formats }) -> { written, paths, base, excalidrawError? }`
  used identically in Tasks 3, 5, 6. `renderFlowchartPreview(mermaid, theme, maxWidth) -> string | null`
  used identically in Tasks 4, 5.
- **Risk note:** `node --test` importing `.ts` (Task 4) depends on Node's TS stripping; fallback documented.
```
