# Mermaid-Graph Extension — Diagram Renderer

**Purpose:** Renders Mermaid diagram source to editable `.mmd`, `.svg`, `.png`, and `.excalidraw` files. Separate npm package with esbuild bundling and Puppeteer rendering.

6 files — `index.ts`, `unicode-preview.ts`, `mermaid-render.mjs`, `build.mjs`, `package.json`, plus `test/` dir.

## Code Conventions

- **Extension entry:** `export default function(pi: ExtensionAPI) { pi.registerTool({ name: "render_diagram", ... }) }` in `index.ts`
- **Node scripts:** `.mjs` extension for Puppeteer render logic (`mermaid-render.mjs`) and build (`build.mjs`)
- **TypeScript:** `import type` for type-only imports, `@sinclair/typebox` for param schemas
- **Import style:** Extension imports from both `@earendil-works/pi-coding-agent` and `@mariozechner/pi-tui` (different SDK paths than subagent)
- **Bundling:** esbuild bundles `browser-entry.js` → `dist/bundle.js` for Excalidraw inline rendering
- **Dependencies:** `mermaid ^11.15.0`, `@excalidraw/excalidraw ^0.18.1`, `@excalidraw/mermaid-to-excalidraw ^2.2.2`, `esbuild ^0.28.0`
- **No npm workspace linkage** — this is a standalone package with its own `package.json` and `package-lock.json`

## Architecture Patterns

```
index.ts                  — Tool registration + parameter schema
unicode-preview.ts        — Terminal Unicode flowchart preview (no deps)
mermaid-render.mjs        — Puppeteer-based SVG/PNG rendering
build.mjs                 — esbuild bundler for Excalidraw
test/
├── render.test.mjs       — Tests SVG, PNG, excalidraw output
├── preview.test.mjs      — Unicode preview tests
└── fixtures/             — .mmd test fixtures (flowchart, sequence)
```

- **Rendering pipeline:** Mermaid source → Puppeteer (headless Chromium) → SVG/PNG → optional Excalidraw conversion
- **Error handling:** Mermaid parse errors surfaced as rejected promises (tested: `assert.rejects()`)
- **Output paths:** Configurable via `outDir` param (default `./diagrams`)
- **Format selection:** `formats` param filters output — `["mmd", "svg", "png", "excalidraw"]` or subset
- **Unicode preview:** `renderFlowchartPreview()` for terminal-only flowchart rendering (no Puppeteer needed)

## Do's and Don'ts

- **Do** use `.mjs` for Node scripts that need ESM at the package level
- **Do** add test fixtures as `.mmd` files in `test/fixtures/`
- **Do** handle Puppeteer/render errors gracefully (return `isError: true`)
- **Don't** import `mermaid-render.mjs` from TypeScript directly — use dynamic `await import()` in the tool handler
- **Don't** add dependencies that increase the bundle size unnecessarily — esbuild is only for Excalidraw

## Testing

```bash
cd extensions/mermaid-graph
node build.mjs                              # Bundle dist/ first
node --test 'test/**/*.test.mjs'            # Run all tests
```

- Framework: `node:test` with `node:assert/strict`
- Puppeteer integration tests require a working headless Chromium
- Test patterns: output file existence checks, JSON structure validation for `.excalidraw`, error message matching via regex
