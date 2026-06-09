# render_diagram — Mermaid → SVG + Excalidraw (Design)

**Date:** 2026-06-09
**Status:** Approved (pending implementation plan)

## Problem

The existing `render_graph` tool (`extensions/markdown-graph.ts`) reimplements a
small Mermaid-*like* DSL and renders crude Unicode art only. It is limited: tiny
DSL surface, rough layout, no real diagram engine, no exportable/editable output.

We want a real diagramming tool backed by **Mermaid** (mature text→diagram engine)
and **Excalidraw** (hand-drawn-style editable scenes), producing real files we can
open and edit, while still showing a terminal preview inside the pi TUI.

## Decisions (from brainstorming)

- **Output medium:** C + D — generate editable files **and** keep a terminal preview.
- **Format:** Mermaid is the single source of truth; emit **both** `.svg`/`.png`
  and a converted `.excalidraw` (via `@excalidraw/mermaid-to-excalidraw`).
- **Rendering toolchain:** Reuse the **existing Puppeteer/Chromium** from the
  `browser-tools` skill (no extra ~300MB Chromium install).
- **Coexistence:** **Keep both.** Leave `render_graph` untouched. Register the new
  tool under a different name: **`render_diagram`** (extension `mermaid-graph.ts`).

## Architecture

```
render_diagram tool (extensions/mermaid-graph.ts)
        │
        ├─ writes  diagram.mmd                  (source of truth, editable)
        │
        ├─ spawns  mermaid-render.js  ──────────┐
        │            (Node + Puppeteer headless) │ produces
        │            loads mermaid +             │  → diagram.svg
        │            mermaid-to-excalidraw       │  → diagram.png
        │            in a local HTML page    ────┘  → diagram.excalidraw
        │
        └─ reuses existing Unicode renderer ────→ inline TUI preview
                  (flowchart/graph only; status line for other types)
```

### Components

- **`extensions/mermaid-graph.ts`** — the pi extension. Registers `render_diagram`.
  Orchestrates: write `.mmd` → invoke renderer → run Unicode preview → return paths.
  Independently understandable; depends only on the renderer script + theme API.
- **`mermaid-render.js`** — standalone Node script (co-located with the extension).
  Launches Puppeteer (reusing browser-tools' Chromium), renders Mermaid → SVG,
  rasterizes PNG, converts to `.excalidraw` JSON. Runnable directly from CLI for
  testing. Single clear purpose: Mermaid text in → files out.
- **Unicode preview** — reuse the existing `markdown-graph.ts` renderer logic for
  the inline TUI fallback (flowchart/graph only).

## Tool interface

```
render_diagram({
  mermaid: string,        // required — Mermaid source
  name?:   string,        // optional — base filename (default: slug from first
                          //            line, else timestamp)
  outDir?: string,        // optional — default ./diagrams/
  formats?: string[]      // optional — subset of [svg, png, excalidraw, mmd];
                          //            default: all
})
```

Returns: inline Unicode preview (when renderable) + a status block listing the
written file paths.

## Dependencies & data flow

- **mermaid + @excalidraw/mermaid-to-excalidraw**: installed **locally** into the
  extension's own `node_modules` (small, no Chromium) so rendering works
  **offline**. Loaded into the Puppeteer page from those local files.
- **Chromium/Puppeteer**: reused from
  `skills/pi-skills/browser-tools/node_modules/puppeteer` (path resolved at
  runtime). If missing, the tool returns a clear "run npm install in browser-tools"
  error.
- **Output:** `./diagrams/<name>.{mmd,svg,png,excalidraw}` in the cwd by default.

## Terminal preview behavior (D)

- For `flowchart`/`graph` Mermaid (the common case), the same source feeds the
  existing Unicode renderer → inline ASCII preview.
- For diagram types the ASCII renderer cannot handle (sequence, gantt, class, ER,
  state, pie…), skip the art and show a clean status line:
  `✓ diagram.svg  ✓ diagram.excalidraw …`.

## Error handling

- **Mermaid parse errors** → surface Mermaid's own error message to the agent so it
  can fix the syntax.
- **Missing Chromium** → actionable error pointing to browser-tools setup.
- **Per-format independence**: if Excalidraw conversion fails, SVG/PNG still
  succeed (partial success reported). One failing format never blocks the others.

## Testing

- `mermaid-render.js` runnable standalone with a sample `.mmd` → asserts
  SVG/PNG/.excalidraw produced.
- Fixture diagrams (flowchart, sequence, class) to verify multi-type rendering and
  the preview fallback path.

## Out of scope (YAGNI)

- Editing/replacing the existing `render_graph` tool.
- Live/auto-open-in-browser preview.
- Remote rendering services.
- Authoring `.excalidraw` JSON by hand (always go through Mermaid).
```
