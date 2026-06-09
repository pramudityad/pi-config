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
