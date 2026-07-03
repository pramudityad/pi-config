import { test } from "node:test";
import assert from "node:assert";
import { compactError } from "./errors.ts";

test("empty / whitespace-only input yields a placeholder", () => {
	assert.equal(compactError(""), "(no error output)");
	assert.equal(compactError(undefined), "(no error output)");
	assert.equal(compactError(null), "(no error output)");
	assert.equal(compactError("   \n  \n\t"), "(no error output)");
});

test("short error is returned intact with blank lines dropped", () => {
	assert.equal(compactError("line one\n\nline two"), "line one\nline two");
});

test("keeps only the last N lines and marks the omission", () => {
	const raw = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
	const lines = compactError(raw, 5).split("\n");
	assert.ok(lines[0].startsWith("… 15 earlier lines omitted"));
	assert.deepEqual(lines.slice(1), ["line 16", "line 17", "line 18", "line 19", "line 20"]);
});

test("surfaces a signature line that scrolled out of the tail", () => {
	const raw = ["Error: boom happened", ...Array.from({ length: 20 }, (_, i) => `frame ${i + 1}`)].join("\n");
	const lines = compactError(raw, 5).split("\n");
	assert.equal(lines[0], "Error: boom happened");
	assert.ok(lines[1].startsWith("…"));
	assert.equal(lines[lines.length - 1], "frame 20");
});

test("does not duplicate a signature already visible in the tail", () => {
	assert.equal(compactError("prep\nError: still here\nmore", 5), "prep\nError: still here\nmore");
});

test("singular phrasing when exactly one line is omitted", () => {
	const raw = Array.from({ length: 6 }, (_, i) => `x${i + 1}`).join("\n");
	assert.ok(compactError(raw, 5).split("\n")[0].startsWith("… 1 earlier line omitted"));
});
