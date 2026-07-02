/**
 * Structured output contracts for multi-agent modes.
 *
 * Consensus voting and the review loop used to key off free-form prose
 * (normalize-and-vote on the whole reply; `/^APPROVED$/m` regex). That is
 * brittle — a voter that answers "The result is 42." never matches another
 * that answers "42", and a reviewer that writes "Looks good, APPROVED overall"
 * would (or would not) trip the regex by accident.
 *
 * Instead we ask voting/review agents to end their reply with a small trailing
 * JSON block and key decisions off that structured field. Parsing degrades
 * gracefully: if no block is found we fall back to the previous prose behavior,
 * so agents that ignore the contract still work.
 */

/** Appended to consensus voter tasks so votes can be compared on `answer`, not prose. */
export const CONSENSUS_ANSWER_CONTRACT =
	"\n\nWhen finished, end your reply with a fenced JSON block holding only your final answer:\n" +
	'```json\n{"answer": "<your concise final answer>"}\n```\n' +
	"The JSON block MUST be the last thing in your reply. Put reasoning above it.";

/** Appended to reviewer tasks so the loop keys off `verdict`, not a prose regex. */
export const REVIEW_VERDICT_CONTRACT =
	"\n\nEnd your reply with a fenced JSON block stating your verdict:\n" +
	'```json\n{"verdict": "APPROVED", "summary": "<one line>"}\n```\n' +
	'Use "APPROVED" only if the work is acceptable as-is. Otherwise use "CHANGES_REQUESTED" ' +
	"and list the required changes above the block. The JSON block MUST be the last thing in your reply.";

export type ReviewVerdict = "approved" | "changes";

function tryParseObject(candidate: string): Record<string, unknown> | null {
	try {
		const value = JSON.parse(candidate);
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

/** Return the last top-level `{...}` in `s`, respecting string literals. */
function lastBalancedObject(s: string): string | null {
	let depth = 0;
	let start = -1;
	let inStr = false;
	let esc = false;
	let quote = "";
	let best: string | null = null;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (inStr) {
			if (esc) esc = false;
			else if (ch === "\\") esc = true;
			else if (ch === quote) inStr = false;
			continue;
		}
		if (ch === '"' || ch === "'") {
			inStr = true;
			quote = ch;
		} else if (ch === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === "}") {
			if (depth > 0) {
				depth--;
				if (depth === 0 && start !== -1) best = s.slice(start, i + 1);
			}
		}
	}
	return best;
}

/**
 * Extract a trailing JSON object from agent output. Prefers the last fenced
 * ```json block; otherwise falls back to the last balanced `{...}` in the text.
 * Returns null when nothing parses.
 */
export function parseTrailingJson(text: string): Record<string, unknown> | null {
	if (!text) return null;

	const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
	let match: RegExpExecArray | null;
	let lastFence: string | null = null;
	while ((match = fenceRe.exec(text)) !== null) lastFence = match[1];
	if (lastFence) {
		const obj = tryParseObject(lastFence.trim());
		if (obj) return obj;
	}

	const balanced = lastBalancedObject(text);
	if (balanced) {
		const obj = tryParseObject(balanced);
		if (obj) return obj;
	}
	return null;
}

/**
 * The comparable answer for consensus voting: the structured `answer` field if
 * present, otherwise the full trimmed reply (legacy behavior).
 */
export function extractAnswer(text: string): string {
	const obj = parseTrailingJson(text);
	if (obj && "answer" in obj) {
		const a = obj.answer;
		if (typeof a === "string") return a.trim();
		if (typeof a === "number" || typeof a === "boolean") return String(a);
		if (a != null) return JSON.stringify(a);
	}
	return text.trim();
}

/**
 * The review verdict: the structured `verdict` field if present, otherwise the
 * legacy prose contract (`APPROVED` on its own line).
 */
export function extractVerdict(text: string): ReviewVerdict {
	const obj = parseTrailingJson(text);
	if (obj && typeof obj.verdict === "string") {
		return obj.verdict.trim().toUpperCase() === "APPROVED" ? "approved" : "changes";
	}
	return /^\s*APPROVED\s*$/m.test(text) ? "approved" : "changes";
}
