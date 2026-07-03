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
