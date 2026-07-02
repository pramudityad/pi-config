/**
 * Pending human-input questions for headless runs.
 *
 * When `ask_human` is invoked without a UI it cannot block for an answer, so it
 * persists the question here (auditable) and stops. A resume mechanism (the
 * separate P0 item) reads these back, collects answers, and continues the run.
 *
 * Dependency-free and clock-injected (callers pass timestamps, never read the
 * clock here) so it stays deterministic under test — mirrors runstate.ts.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type PendingKind = "input" | "confirm" | "select";

export interface PendingQuestion {
	id: string;
	question: string;
	context?: string;
	kind: PendingKind;
	options?: string[];
	createdAt: string;
	status: "pending" | "answered";
	answer?: string;
}

const PENDING_SUBDIR = path.join(".pi", "pending");

/** Directory holding pending-question files for a project. */
export function pendingDir(cwd: string): string {
	return path.join(cwd, PENDING_SUBDIR);
}

/** Absolute path of a pending-question file. */
export function pendingPath(cwd: string, id: string): string {
	return path.join(pendingDir(cwd), `${id}.json`);
}

/** Build a fresh pending question, omitting empty optional fields. */
export function makePendingQuestion(
	id: string,
	question: string,
	kind: PendingKind,
	createdAt: string,
	opts?: { context?: string; options?: string[] },
): PendingQuestion {
	return {
		id,
		question,
		kind,
		createdAt,
		status: "pending",
		...(opts?.context ? { context: opts.context } : {}),
		...(opts?.options && opts.options.length > 0 ? { options: opts.options } : {}),
	};
}

/** Persist a pending question atomically (tmp write + rename). */
export function savePendingQuestion(cwd: string, q: PendingQuestion): void {
	const dir = pendingDir(cwd);
	fs.mkdirSync(dir, { recursive: true });
	const finalPath = pendingPath(cwd, q.id);
	const tmpPath = `${finalPath}.tmp`;
	fs.writeFileSync(tmpPath, JSON.stringify(q, null, 2), "utf-8");
	fs.renameSync(tmpPath, finalPath);
}

/** Load a pending question, or null if missing/unreadable/corrupt. */
export function loadPendingQuestion(cwd: string, id: string): PendingQuestion | null {
	try {
		const parsed = JSON.parse(fs.readFileSync(pendingPath(cwd, id), "utf-8")) as PendingQuestion;
		if (!parsed || typeof parsed !== "object" || typeof parsed.question !== "string") return null;
		return parsed;
	} catch {
		return null;
	}
}
