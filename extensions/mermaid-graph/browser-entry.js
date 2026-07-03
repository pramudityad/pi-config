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
