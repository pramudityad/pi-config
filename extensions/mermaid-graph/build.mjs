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
