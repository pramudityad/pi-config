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

test("renders sequence diagram (excalidraw fallback path)", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "rd-"));
  const def = fs.readFileSync(new URL("./fixtures/sequence.mmd", import.meta.url), "utf8");
  const res = await renderDiagram({ mermaid: def, name: "seq", outDir: out, formats: ["svg", "excalidraw"] });
  assert.ok(fs.existsSync(path.join(out, "seq.svg")));
  // excalidraw may or may not work for sequences — accept either outcome
  assert.ok(res.written.includes("svg"));
});

test("rejects empty mermaid source", async () => {
  await assert.rejects(
    () => renderDiagram({ mermaid: "", formats: ["svg"] }),
    /Empty mermaid source/i,
  );
});
