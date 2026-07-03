import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadPendingQuestion, makePendingQuestion, pendingDir, pendingPath, savePendingQuestion } from "./pending.ts";

const T0 = "2026-07-01T00:00:00.000Z";

test("save/load round-trips a pending question under .pi/pending", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pending-"));
	try {
		const q = makePendingQuestion("tc1", "Proceed?", "confirm", T0, { context: "risky op" });
		savePendingQuestion(cwd, q);
		assert.ok(pendingPath(cwd, "tc1").startsWith(pendingDir(cwd)));
		assert.ok(fs.existsSync(pendingPath(cwd, "tc1")));
		assert.deepEqual(loadPendingQuestion(cwd, "tc1"), q);
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
});

test("makePendingQuestion marks pending and omits empty optional fields", () => {
	const q = makePendingQuestion("tc2", "Pick one", "select", T0, { options: ["a", "b"] });
	assert.equal(q.status, "pending");
	assert.equal(q.context, undefined);
	assert.deepEqual(q.options, ["a", "b"]);

	const bare = makePendingQuestion("tc3", "Free text?", "input", T0, { options: [] });
	assert.equal(bare.context, undefined);
	assert.equal(bare.options, undefined);
});

test("loadPendingQuestion returns null for missing or corrupt files", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pending-"));
	try {
		assert.equal(loadPendingQuestion(cwd, "nope"), null);
		fs.mkdirSync(pendingDir(cwd), { recursive: true });
		fs.writeFileSync(pendingPath(cwd, "bad"), "{not json", "utf-8");
		assert.equal(loadPendingQuestion(cwd, "bad"), null);
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
});
