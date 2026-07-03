import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { test } from "node:test";
import {
	crossReference,
	detectSkillName,
	extIdFromPath,
	formatReport,
	type InventoryItem,
	isUsageFileName,
	makeRecord,
	messageToText,
	parseCommand,
	parseJsonl,
	passiveExtensions,
	shouldLogTool,
	tally,
	type UsageRecord,
	usageFileName,
} from "./usage.ts";

const T0 = new Date("2026-07-03T10:00:00.000Z");

test("messageToText handles string and part-array content", () => {
	assert.equal(messageToText({ role: "user", content: "hi" }), "hi");
	assert.equal(
		messageToText({
			role: "user",
			content: [
				{ type: "text", text: "a" },
				{ type: "toolCall", name: "x" },
				{ type: "text", text: "b" },
			],
		}),
		"ab",
	);
	assert.equal(messageToText({ role: "user", content: [] }), "");
	assert.equal(messageToText(null), "");
	assert.equal(messageToText(undefined), "");
});

test("detectSkillName matches an expanded skill block, rejects prose", () => {
	const block = '<skill name="deep-research" location="/skills/deep-research/SKILL.md">\nReferences are relative to /skills/deep-research.\n\nDo research.\n</skill>';
	assert.equal(detectSkillName(block), "deep-research");
	// with a trailing user message appended
	assert.equal(detectSkillName(`${block}\n\nplease research widgets`), "deep-research");
	// leading whitespace tolerated
	assert.equal(detectSkillName(`\n  ${block}`), "deep-research");
	// assistant prose that merely mentions a skill tag mid-text does not match
	assert.equal(detectSkillName('Sure, I will use <skill name="x" location="y"> soon.'), null);
	// opening tag but no closing tag
	assert.equal(detectSkillName('<skill name="x" location="y">\nunterminated'), null);
	assert.equal(detectSkillName("just a normal message"), null);
});

test("shouldLogTool filters built-ins but keeps extension and MCP tools", () => {
	for (const b of ["bash", "read", "edit", "write", "grep", "find", "ls"]) assert.equal(shouldLogTool(b), false);
	assert.equal(shouldLogTool("ask_human"), true);
	assert.equal(shouldLogTool("mcp__claude_ai_Gmail__search_threads"), true);
});

test("parseCommand distinguishes commands, skill-commands, bash, and non-commands", () => {
	assert.deepEqual(parseCommand("/context"), { kind: "command", name: "context" });
	assert.deepEqual(parseCommand("  /plan on"), { kind: "command", name: "plan" });
	assert.deepEqual(parseCommand("/skill:deep-research go"), { kind: "skill-command", name: "deep-research" });
	assert.equal(parseCommand("!ls"), null);
	assert.equal(parseCommand("!!git status"), null);
	assert.equal(parseCommand("hello there"), null);
	assert.equal(parseCommand(""), null);
});

test("makeRecord injects the clock and omits an absent session", () => {
	const r = makeRecord("skill", "deep-research", T0, { cwd: "/x" });
	assert.deepEqual(r, { ts: "2026-07-03T10:00:00.000Z", kind: "skill", name: "deep-research", cwd: "/x" });
	assert.equal("session" in r, false);
	const r2 = makeRecord("tool", "ask_human", T0, { cwd: "/x", session: "s1" });
	assert.equal(r2.session, "s1");
});

test("usageFileName uses the UTC month and is TZ-stable at boundaries", () => {
	assert.equal(usageFileName(T0), "usage-2026-07.jsonl");
	assert.equal(usageFileName(new Date("2026-01-01T00:00:00.000Z")), "usage-2026-01.jsonl");
	assert.equal(usageFileName(new Date("2026-12-31T23:59:59.999Z")), "usage-2026-12.jsonl");
	assert.equal(isUsageFileName("usage-2026-07.jsonl"), true);
	assert.equal(isUsageFileName("usage-2026-7.jsonl"), false);
	assert.equal(isUsageFileName("notes.txt"), false);
});

test("parseJsonl skips blank and malformed lines", () => {
	const good = JSON.stringify(makeRecord("skill", "x", T0, { cwd: "/x" }));
	const text = `${good}\n\n{not json\n{"kind":"tool"}\n${good}\n`; // 2 valid, 1 blank, 1 malformed, 1 missing fields
	const recs = parseJsonl(text);
	assert.equal(recs.length, 2);
	assert.equal(recs[0].name, "x");
});

test("tally aggregates counts and last-used, sorted by count desc", () => {
	const recs: UsageRecord[] = [
		makeRecord("skill", "a", new Date("2026-07-01T00:00:00.000Z"), { cwd: "/x" }),
		makeRecord("skill", "a", new Date("2026-07-03T00:00:00.000Z"), { cwd: "/x" }),
		makeRecord("tool", "b", new Date("2026-07-02T00:00:00.000Z"), { cwd: "/x" }),
	];
	const t = tally(recs);
	assert.equal(t.length, 2);
	assert.deepEqual(t[0], { kind: "skill", name: "a", count: 2, lastUsed: "2026-07-03T00:00:00.000Z" });
	assert.deepEqual(t[1], { kind: "tool", name: "b", count: 1, lastUsed: "2026-07-02T00:00:00.000Z" });
});

test("crossReference splits used, unused, and orphans by kind+name", () => {
	const entries = tally([
		makeRecord("skill", "used-skill", T0, { cwd: "/x" }),
		makeRecord("tool", "gone-tool", T0, { cwd: "/x" }), // not in inventory -> orphan
	]);
	const inventory: InventoryItem[] = [
		{ kind: "skill", name: "used-skill" },
		{ kind: "skill", name: "never-skill" },
		{ kind: "command", name: "usage" },
	];
	const { used, unused, orphans } = crossReference(entries, inventory);
	assert.deepEqual(used.map((e) => e.name), ["used-skill"]);
	assert.deepEqual(unused.map((i) => i.name), ["usage", "never-skill"]); // command sorts before skill
	assert.deepEqual(orphans.map((e) => e.name), ["gone-tool"]);
});

test("extIdFromPath maps extension files and dirs, rejects outsiders (path-space independent)", () => {
	assert.equal(extIdFromPath("/home/u/.pi/agent/extensions/context-inspector/index.ts"), "context-inspector");
	assert.equal(extIdFromPath("/home/u/.pi/agent/extensions/protected-paths.ts"), "protected-paths");
	// resolves even when the path space differs from the agent dir (symlink case)
	assert.equal(extIdFromPath("/home/u/git/pi-config/extensions/ask-human/index.ts"), "ask-human");
	assert.equal(extIdFromPath("/home/u/.pi/agent/skills/foo/SKILL.md"), null);
	assert.equal(extIdFromPath("/home/u/.pi/agent/extensions"), null);
});

test("passiveExtensions returns on-disk extensions that contribute nothing", () => {
	const all = ["context-inspector", "permission-gate", "protected-paths", "usage-log"];
	const contributing = new Set(["context-inspector", "usage-log"]);
	assert.deepEqual(passiveExtensions(all, contributing), ["permission-gate", "protected-paths"]);
});

test("formatReport lists never-used candidates and passive extensions", () => {
	const entries = tally([makeRecord("skill", "used-skill", T0, { cwd: "/x" })]);
	const inventory: InventoryItem[] = [
		{ kind: "skill", name: "used-skill" },
		{ kind: "skill", name: "dead-skill" },
	];
	const cross = crossReference(entries, inventory);
	const summary = formatReport(cross, ["permission-gate"], "summary", { totalRecords: 1, files: 1 });
	assert.match(summary, /used-skill  ×1/);
	assert.match(summary, /dead-skill/);
	assert.match(summary, /PASSIVE EXTENSIONS/);
	assert.match(summary, /permission-gate/);

	const unused = formatReport(cross, [], "unused", { totalRecords: 1, files: 1 });
	assert.match(unused, /dead-skill/);
	assert.doesNotMatch(unused, /×1/); // "used" rows suppressed in unused mode
});

test("records round-trip through a monthly file, malformed lines ignored", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "usage-"));
	try {
		const file = path.join(dir, usageFileName(T0));
		const recs = [
			makeRecord("skill", "deep-research", T0, { cwd: "/x" }),
			makeRecord("tool", "ask_human", T0, { cwd: "/x", session: "s1" }),
		];
		for (const r of recs) fs.appendFileSync(file, `${JSON.stringify(r)}\n`);
		fs.appendFileSync(file, "{corrupt partial write\n");

		assert.equal(usageFileName(T0), "usage-2026-07.jsonl");
		assert.ok(fs.readdirSync(dir).filter(isUsageFileName).length === 1);
		const read = parseJsonl(fs.readFileSync(file, "utf-8"));
		assert.equal(read.length, 2);
		assert.deepEqual(tally(read).map((e) => e.name).sort(), ["ask_human", "deep-research"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
