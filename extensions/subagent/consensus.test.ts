import { test } from "node:test";
import assert from "node:assert";
import { resolveConsensus } from "./consensus.ts";

test("unanimous agreement returns the answer with agreed status", () => {
	const r = resolveConsensus(["42", "42", "42"]);
	assert.equal(r.status, "agreed");
	assert.equal(r.answer, "42");
});

test("majority (2 of 3) returns majority with dissenters", () => {
	const r = resolveConsensus(["42", "42", "7"]);
	assert.equal(r.status, "majority");
	assert.equal(r.answer, "42");
	assert.deepEqual(r.dissenters, ["7"]);
});

test("all different returns tie with all answers", () => {
	const r = resolveConsensus(["a", "b", "c"]);
	assert.equal(r.status, "tie");
	assert.deepEqual(r.all, ["a", "b", "c"]);
});

test("normalizes whitespace and case for comparison", () => {
	const r = resolveConsensus([" Yes ", "yes", "YES"]);
	assert.equal(r.status, "agreed");
});
