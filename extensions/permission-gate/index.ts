/**
 * Permission Gate Extension
 *
 * Prompts for confirmation before running potentially dangerous bash commands.
 * Patterns checked: rm -rf, sudo, chmod/chown 777.
 *
 * Also enforces the "never commit/push to a protected branch" guardrail from
 * prompts/first-mate.md: a `git commit`/`git push` while on a protected branch
 * is hard-blocked when headless, or gated behind a confirmation when a UI is
 * present. This turns an advisory prose rule into a real Factor-8 gate.
 */

import { execSync } from "node:child_process";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Branches that must not receive direct commits/pushes. Covers first-mate.md
// ("NEVER commit to main/dev/sit") and the AGENTS.md branch flow
// (dev-alfred → sit-alfred → staging-alfred → master). Lift to config if this
// needs to vary per repo.
export const PROTECTED_BRANCHES = new Set([
	"main",
	"master",
	"dev",
	"sit",
	"dev-alfred",
	"sit-alfred",
	"staging-alfred",
]);

/**
 * True if a bash command line runs `git commit` or `git push` in any segment.
 * Splits on command separators so `cd repo && git commit` is caught, and only
 * matches when commit/push is the git subcommand — read-only lookalikes such as
 * `git log --grep=commit` are ignored.
 *
 * Known limitation: forms that put a positional between git and the subcommand
 * (e.g. `git -C dir commit`) are not detected.
 */
export function isGitCommitOrPush(command: string): boolean {
	return command
		.split(/&&|\|\||[;|]/)
		.some((seg) => /^\s*git\b(?:\s+-\S+|\s+--\S+)*\s+(commit|push)\b/i.test(seg));
}

/** Current branch at `cwd`, or null if not a git repo / detached HEAD. */
function currentBranch(cwd: string): string | null {
	try {
		const branch = execSync("git rev-parse --abbrev-ref HEAD", {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return branch && branch !== "HEAD" ? branch : null;
	} catch {
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	const dangerousPatterns = [/\brm\s+(-rf?|--recursive)/i, /\bsudo\b/i, /\b(chmod|chown)\b.*777/i];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;

		// ── Protected-branch guardrail (Factor 8) ──────────────────────────
		if (isGitCommitOrPush(command)) {
			const branch = currentBranch(ctx.cwd);
			if (branch && PROTECTED_BRANCHES.has(branch)) {
				if (!ctx.hasUI) {
					return {
						block: true,
						reason: `Commit/push to protected branch "${branch}" blocked (no UI). Use a feature branch or worktree.`,
					};
				}
				const choice = await ctx.ui.select(
					`⚠️ Commit/push to protected branch "${branch}":\n\n  ${command}\n\nAllow?`,
					["No", "Yes"],
				);
				if (choice !== "Yes") {
					return { block: true, reason: `Blocked: commit/push to protected branch "${branch}"` };
				}
			}
		}

		// ── Dangerous command guardrail ────────────────────────────────────
		const isDangerous = dangerousPatterns.some((p) => p.test(command));
		if (isDangerous) {
			if (!ctx.hasUI) {
				// In non-interactive mode, block by default
				return { block: true, reason: "Dangerous command blocked (no UI for confirmation)" };
			}

			const choice = await ctx.ui.select(`⚠️ Dangerous command:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);

			if (choice !== "Yes") {
				return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
