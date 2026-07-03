import { test } from "node:test";
import assert from "node:assert";
import { isGitCommitOrPush } from "./index.ts";

test("detects direct commit/push forms", () => {
	for (const cmd of [
		"git commit -m 'x'",
		"git commit --amend",
		"git commit -am wip",
		"git push",
		"git push -u origin main",
		"git push origin dev-alfred",
	]) {
		assert.equal(isGitCommitOrPush(cmd), true, cmd);
	}
});

test("detects commit/push in a chained segment", () => {
	assert.equal(isGitCommitOrPush("cd repo && git commit -m x"), true);
	assert.equal(isGitCommitOrPush("git add -A; git push"), true);
});

test("ignores read-only lookalikes and non-git commands", () => {
	for (const cmd of [
		"git log --grep=commit",
		"git status",
		"git diff HEAD",
		"git rev-parse commit",
		"echo commit && echo push",
		"gitcommit",
		"git commitfoo",
	]) {
		assert.equal(isGitCommitOrPush(cmd), false, cmd);
	}
});

test("known limitation: positional between git and subcommand is not detected", () => {
	// Documents current behavior — `git -C dir commit` slips through the gate.
	assert.equal(isGitCommitOrPush("git -C /repo commit -m x"), false);
});
