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
      await page.setContent(html, { waitUntil: "load" });
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
