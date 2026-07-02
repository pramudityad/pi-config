/**
 * Error compaction for subagent failure surfacing and bounded self-heal.
 *
 * Turns a raw, possibly huge error blob (stderr, stack traces, tool output)
 * into a compact form suitable for (a) surfacing to the caller and (b) feeding
 * back into a retry's context. Keeps the tail — where the actual failure
 * usually lives — plus an extracted signature line so the headline reason
 * survives truncation. Dependency-free and deterministic so it is trivially
 * unit-testable — mirrors runstate.ts.
 */

/** Heuristic for the single most informative "what went wrong" line. */
const SIGNATURE_RE =
	/(error|exception|failed|fatal|panic|traceback|not found|no such|cannot|can't|denied|refused|unauthorized|timed?\s*out|abort)/i;

/**
 * Compact a raw error into at most `maxLines` trailing lines, prefixed with an
 * extracted signature line (when not already visible in the tail) and an
 * "N earlier lines omitted" marker (when truncated).
 */
export function compactError(raw: string | undefined | null, maxLines = 12): string {
	const text = (raw ?? "").trim();
	if (!text) return "(no error output)";

	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trimEnd())
		.filter((l) => l.trim().length > 0);
	if (lines.length === 0) return "(no error output)";

	const tail = lines.slice(-maxLines);
	const omitted = lines.length - tail.length;

	const signature = lines.find((l) => SIGNATURE_RE.test(l));
	const out: string[] = [];
	if (signature && !tail.includes(signature)) out.push(signature);
	if (omitted > 0) out.push(`… ${omitted} earlier line${omitted === 1 ? "" : "s"} omitted`);
	out.push(...tail);
	return out.join("\n");
}
