/**
 * Usage-log extension — audit which skills and extensions actually get used.
 *
 * Records three kinds of invocation to a durable, append-only JSONL log so you
 * can periodically prune dead weight:
 *   - "skill":   a skill invocation. Skills are NOT tool calls — pi expands them
 *                (model-invoked or /skill:name) into a user-role message whose
 *                text opens with `<skill name="...">`, which we detect.
 *   - "tool":    an extension-provided or MCP tool call (built-in read/bash/grep/
 *                edit/write/find/ls are filtered out as noise).
 *   - "command": an extension slash command (e.g. /context, /plan).
 *
 * The log lives at ~/.pi/usage/usage-YYYY-MM.jsonl (override with PI_USAGE_DIR) —
 * global and cross-project, outside any repo, so it captures usage everywhere pi
 * runs. `/usage` reports counts + last-used and, by cross-referencing the log
 * against the installed inventory, the never-used delete candidates.
 *
 * Logging is best-effort: every write is guarded so a log failure never blocks
 * the agent. All logic lives in the dependency-free ./usage.ts helpers.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ExtensionAPI, type ExtensionContext, getAgentDir } from "@earendil-works/pi-coding-agent";
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
	type ReportMode,
	shouldLogTool,
	tally,
	type UsageKind,
	type UsageRecord,
	usageFileName,
} from "./usage.ts";

/** Also audit prompt-template slash commands. Off per the skills+extensions scope. */
const AUDIT_PROMPTS = false;

function usageDir(): string {
	return process.env.PI_USAGE_DIR || path.join(os.homedir(), ".pi", "usage");
}

function listUsageFiles(dir: string): string[] {
	try {
		return fs.readdirSync(dir).filter(isUsageFileName).sort();
	} catch {
		return [];
	}
}

function readAllRecords(dir: string): UsageRecord[] {
	const out: UsageRecord[] = [];
	for (const f of listUsageFiles(dir)) {
		try {
			out.push(...parseJsonl(fs.readFileSync(path.join(dir, f), "utf-8")));
		} catch {
			/* unreadable file — skip, keep reporting the rest */
		}
	}
	return out;
}

function safe<T>(fn: () => T, fallback: T): T {
	try {
		return fn();
	} catch {
		return fallback;
	}
}

/** Extension identifiers on disk: subdirs with an index.ts, plus top-level *.ts. */
function scanExtensions(extRoot: string): string[] {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(extRoot, { withFileTypes: true });
	} catch {
		return [];
	}
	const ids: string[] = [];
	for (const e of entries) {
		if (e.isDirectory()) {
			if (fs.existsSync(path.join(extRoot, e.name, "index.ts"))) ids.push(e.name);
		} else if (e.isFile() && e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") && !e.name.endsWith(".d.ts")) {
			ids.push(e.name.slice(0, -3));
		}
	}
	return ids;
}

/** Build the installed inventory (skills, extension tools, extension commands) plus passive extensions. */
function buildInventory(pi: ExtensionAPI): { inventory: InventoryItem[]; passive: string[] } {
	const inventory: InventoryItem[] = [];
	const commands = safe(() => pi.getCommands(), []);
	const tools = safe(() => pi.getAllTools(), []);
	const extRoot = safe(() => path.join(getAgentDir(), "extensions"), "");
	const contributing = new Set<string>();

	for (const c of commands) {
		if (c.source === "skill") {
			inventory.push({ kind: "skill", name: c.name.replace(/^skill:/, "") });
		} else if (c.source === "extension") {
			inventory.push({ kind: "command", name: c.name });
			const id = c.sourceInfo?.path ? extIdFromPath(c.sourceInfo.path) : null;
			if (id) contributing.add(id);
		}
	}

	for (const t of tools) {
		if (!shouldLogTool(t.name)) continue; // skip built-ins
		const id = t.sourceInfo?.path ? extIdFromPath(t.sourceInfo.path) : null;
		if (id) {
			// A tool defined by a local extension — part of the auditable inventory.
			inventory.push({ kind: "tool", name: t.name, source: id });
			contributing.add(id);
		}
		// Non-local tools (e.g. MCP) are still logged when called, but aren't
		// "never used" candidates — they surface under OTHER INVOKED if used.
	}

	const passive = extRoot ? passiveExtensions(scanExtensions(extRoot), contributing) : [];
	return { inventory, passive };
}

export default function usageLog(pi: ExtensionAPI): void {
	let dirReady = false;
	let warned = false;

	const append = (rec: UsageRecord, ctx: ExtensionContext): void => {
		try {
			const dir = usageDir();
			if (!dirReady) {
				fs.mkdirSync(dir, { recursive: true });
				dirReady = true;
			}
			fs.appendFileSync(path.join(dir, usageFileName(new Date(rec.ts))), `${JSON.stringify(rec)}\n`);
		} catch (err) {
			// Never let a logging failure break the agent; warn at most once.
			if (!warned && ctx?.ui?.notify) {
				warned = true;
				ctx.ui.notify(`usage-log: could not write usage log (${(err as Error).message}); auditing off this session.`, "warning");
			}
		}
	};

	const record = (kind: UsageKind, name: string, ctx: ExtensionContext): void => {
		append(makeRecord(kind, name, new Date(), { cwd: ctx.cwd, session: pi.getSessionName?.() }), ctx);
	};

	// Skills arrive as a user-role message opening with a <skill …> block.
	pi.on("message_start", async (event, ctx) => {
		const msg = event.message as { role?: string; content?: unknown };
		if (msg.role !== "user") return;
		const name = detectSkillName(messageToText(msg));
		if (name) record("skill", name, ctx);
	});

	// Extension / MCP tool calls (built-ins filtered). Must return nothing —
	// returning a { block } result here would gate tool execution.
	pi.on("tool_call", async (event, ctx) => {
		if (shouldLogTool(event.toolName)) record("tool", event.toolName, ctx);
	});

	// Extension slash commands. /skill:name is dropped (counted via the skill
	// block), and only extension-source commands are logged (skills+extensions scope).
	pi.on("input", async (event, ctx) => {
		if (event.source === "extension") return; // synthetic sends from other extensions
		const parsed = parseCommand(event.text);
		if (!parsed || parsed.kind === "skill-command") return;
		const cmd = safe(() => pi.getCommands(), []).find((c) => c.name === parsed.name);
		if (cmd && (cmd.source === "extension" || (AUDIT_PROMPTS && cmd.source === "prompt"))) {
			record("command", parsed.name, ctx);
		}
	});

	pi.registerCommand("usage", {
		description:
			"Audit skill/extension usage — counts, last-used, and never-used delete candidates ('/usage unused', '/usage skills', '/usage dump')",
		handler: async (args, ctx) => {
			const sub = (args ?? "").trim().toLowerCase();
			const dir = usageDir();

			if (sub === "dump") {
				const files = listUsageFiles(dir);
				const total = readAllRecords(dir).length;
				const lines = [`usage log dir: ${dir}`, `files: ${files.length}`, ...files.map((f) => `  ${f}`), `total records: ${total}`];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			const mode: ReportMode = sub === "unused" ? "unused" : sub === "skills" ? "skills" : "summary";
			const records = readAllRecords(dir);
			const entries = tally(records);
			const { inventory, passive } = buildInventory(pi);
			const cross = crossReference(entries, inventory);
			const report = formatReport(cross, passive, mode, { totalRecords: records.length, files: listUsageFiles(dir).length });
			ctx.ui.notify(report, "info");
		},
	});
}
