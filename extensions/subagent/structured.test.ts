import { test } from "node:test";
import assert from "node:assert";
import { extractAnswer, extractVerdict, parseTrailingJson } from "./structured.ts";

test("parseTrailingJson reads a fenced json block", () => {
	const obj = parseTrailingJson('Here is my reasoning.\n```json\n{"answer": "42"}\n```');
	assert.deepEqual(obj, { answer: "42" });
});

test("parseTrailingJson takes the LAST fenced block", () => {
	const obj = parseTrailingJson('```json\n{"answer": "1"}\n```\nmore\n```json\n{"answer": "2"}\n```');
	assert.deepEqual(obj, { answer: "2" });
});

test("parseTrailingJson falls back to a trailing bare object", () => {
	const obj = parseTrailingJson('The verdict:\n{"verdict": "APPROVED", "summary": "ok"}');
	assert.deepEqual(obj, { verdict: "APPROVED", summary: "ok" });
});

test("parseTrailingJson ignores braces inside strings", () => {
	const obj = parseTrailingJson('note\n{"answer": "use {curly} braces"}');
	assert.deepEqual(obj, { answer: "use {curly} braces" });
});

test("parseTrailingJson returns null when there is no object", () => {
	assert.equal(parseTrailingJson("just prose, no json here"), null);
});

test("extractAnswer prefers the structured answer field", () => {
	assert.equal(extractAnswer('Long analysis...\n```json\n{"answer": "42"}\n```'), "42");
});

test("extractAnswer coerces non-string answers", () => {
	assert.equal(extractAnswer('```json\n{"answer": 42}\n```'), "42");
	assert.equal(extractAnswer('```json\n{"answer": true}\n```'), "true");
});

test("extractAnswer falls back to the full trimmed reply", () => {
	assert.equal(extractAnswer("  42  "), "42");
});

test("extractAnswer collapses two verbose voters to the same answer", () => {
	const a = extractAnswer('The result is 42.\n```json\n{"answer": "42"}\n```');
	const b = extractAnswer('After computing, forty-two — i.e.\n```json\n{"answer": "42"}\n```');
	assert.equal(a, b);
});

test("extractVerdict reads APPROVED from the block", () => {
	assert.equal(extractVerdict('Looks solid overall.\n```json\n{"verdict": "APPROVED"}\n```'), "approved");
});

test("extractVerdict reads CHANGES_REQUESTED from the block", () => {
	assert.equal(extractVerdict('```json\n{"verdict": "CHANGES_REQUESTED", "summary": "fix x"}\n```'), "changes");
});

test("extractVerdict does not false-positive on prose mentioning approved", () => {
	assert.equal(
		extractVerdict('I would have APPROVED this earlier but no.\n```json\n{"verdict": "CHANGES_REQUESTED"}\n```'),
		"changes",
	);
});

test("extractVerdict falls back to the legacy prose contract", () => {
	assert.equal(extractVerdict("Everything checks out.\nAPPROVED"), "approved");
	assert.equal(extractVerdict("Please fix the failing test first."), "changes");
});
