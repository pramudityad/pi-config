import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createScratchpad, scratchpadNotice, cleanupScratchpad } from "./scratchpad.ts";

test("createScratchpad makes a file under .pi/scratch and returns its path", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scratch-cwd-"));
	const p = createScratchpad(cwd, "wf123");
	assert.ok(p.includes(path.join(".pi", "scratch")));
	assert.ok(p.endsWith("wf123.md"));
	assert.ok(fs.existsSync(p));
	fs.rmSync(cwd, { recursive: true, force: true });
});

test("scratchpadNotice mentions the path and read/append guidance", () => {
	const notice = scratchpadNotice("/tmp/x/wf.md");
	assert.ok(notice.includes("/tmp/x/wf.md"));
	assert.match(notice, /read/i);
	assert.match(notice, /append/i);
});

test("cleanupScratchpad removes the file unless keep=true", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scratch-cwd-"));
	const p = createScratchpad(cwd, "wf");
	cleanupScratchpad(p, false);
	assert.ok(!fs.existsSync(p));
	const p2 = createScratchpad(cwd, "wf2");
	cleanupScratchpad(p2, true);
	assert.ok(fs.existsSync(p2));
	fs.rmSync(cwd, { recursive: true, force: true });
});
