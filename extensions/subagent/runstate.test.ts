import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	fingerprintSteps,
	finalizeRunState,
	initRunState,
	loadRunState,
	recordStep,
	resumableSteps,
	runStatePath,
	runsDir,
	saveRunState,
	type StepRecord,
} from "./runstate.ts";

const T0 = "2026-07-01T00:00:00.000Z";
const T1 = "2026-07-01T00:01:00.000Z";

function step(n: number, status: "completed" | "failed", output = `out${n}`): StepRecord {
	return { step: n, agent: `a${n}`, task: `t${n}`, status, output };
}

test("fingerprintSteps is stable and changes when the plan changes", () => {
	const plan = [
		{ agent: "scout", task: "recon" },
		{ agent: "worker", task: "build {previous}" },
	];
	assert.equal(fingerprintSteps(plan), fingerprintSteps(plan));
	const edited = [{ agent: "scout", task: "recon" }, { agent: "worker", task: "build DIFFERENT" }];
	assert.notEqual(fingerprintSteps(plan), fingerprintSteps(edited));
});

test("save/load round-trips run state under .pi/runs", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "runstate-"));
	try {
		const state = initRunState("wf1", "chain", "abc123", T0);
		recordStep(state, step(1, "completed"), T1);
		saveRunState(cwd, state);

		assert.ok(runStatePath(cwd, "wf1").startsWith(runsDir(cwd)));
		assert.ok(fs.existsSync(runStatePath(cwd, "wf1")));

		const loaded = loadRunState(cwd, "wf1");
		assert.ok(loaded);
		assert.equal(loaded!.id, "wf1");
		assert.equal(loaded!.steps.length, 1);
		assert.equal(loaded!.steps[0].output, "out1");
		assert.equal(loaded!.updatedAt, T1);
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
});

test("loadRunState returns null for a missing run", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "runstate-"));
	try {
		assert.equal(loadRunState(cwd, "does-not-exist"), null);
	} finally {
		fs.rmSync(cwd, { recursive: true, force: true });
	}
});

test("recordStep replaces an existing step (idempotent on step number)", () => {
	const state = initRunState("wf", "chain", "fp", T0);
	recordStep(state, step(1, "failed", "first"), T0);
	recordStep(state, step(1, "completed", "retry"), T1);
	assert.equal(state.steps.length, 1);
	assert.equal(state.steps[0].status, "completed");
	assert.equal(state.steps[0].output, "retry");
});

test("resumableSteps returns the leading completed run, stopping at first non-completed", () => {
	const state = initRunState("wf", "chain", "fp", T0);
	recordStep(state, step(1, "completed"), T0);
	recordStep(state, step(2, "completed"), T0);
	recordStep(state, step(3, "failed"), T0);
	const reusable = resumableSteps(state, "fp");
	assert.ok(reusable);
	assert.equal(reusable!.length, 2);
	assert.deepEqual(
		reusable!.map((s) => s.step),
		[1, 2],
	);
});

test("resumableSteps refuses to resume when the fingerprint changed", () => {
	const state = initRunState("wf", "chain", "fp-old", T0);
	recordStep(state, step(1, "completed"), T0);
	assert.equal(resumableSteps(state, "fp-new"), null);
});

test("finalizeRunState sets terminal status and bumps updatedAt", () => {
	const state = initRunState("wf", "chain", "fp", T0);
	finalizeRunState(state, "completed", T1);
	assert.equal(state.status, "completed");
	assert.equal(state.updatedAt, T1);
});
