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
