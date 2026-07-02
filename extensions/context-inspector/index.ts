import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { estimateTokens, isToolCallEventType } from "@mariozechner/pi-coding-agent";
import type { AgentMessage, Message } from "@mariozechner/pi-agent-core";

interface FileReadEntry {
	count: number;
	lastLines: number;
}

function estimateStringTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

interface TokenBreakdown {
	system: number;
	user: number;
	assistant: number;
	toolResult: number;
	total: number;
}

function categorizeTokens(messages: Message[]): TokenBreakdown {
	const breakdown: TokenBreakdown = { system: 0, user: 0, assistant: 0, toolResult: 0, total: 0 };

	for (const msg of messages) {
		const agentMsg = msg as AgentMessage;
		let tokens = 0;

		// Estimate tokens from message content
		if (typeof agentMsg.content === "string") {
			tokens = estimateStringTokens(agentMsg.content);
		} else if (Array.isArray(agentMsg.content)) {
			for (const part of agentMsg.content) {
				if (part.type === "text") {
					tokens += estimateStringTokens((part as { type: "text"; text: string }).text);
				} else if (part.type === "toolCall") {
					const tc = part as { type: "toolCall"; name: string; arguments: Record<string, unknown> };
					tokens += estimateStringTokens(tc.name + JSON.stringify(tc.arguments));
				} else if (part.type === "toolResult") {
					const tr = part as { type: "toolResult"; content: Array<{ type: string; text?: string }> };
					for (const c of tr.content) {
						if (c.text) tokens += estimateStringTokens(c.text);
					}
				}
			}
		}

		switch (agentMsg.role) {
			case "system":
				breakdown.system += tokens;
				break;
			case "user":
				breakdown.user += tokens;
				break;
			case "assistant":
				breakdown.assistant += tokens;
				break;
			case "toolResult":
				breakdown.toolResult += tokens;
				break;
			default:
				breakdown.user += tokens;
				break;
		}
		breakdown.total += tokens;
	}

	return breakdown;
}

interface MessageCounts {
	total: number;
	system: number;
	user: number;
	assistant: number;
	toolResult: number;
}

function countMessages(messages: Message[]): MessageCounts {
	const counts: MessageCounts = { total: 0, system: 0, user: 0, assistant: 0, toolResult: 0 };
	for (const msg of messages) {
		counts.total++;
		const role = (msg as AgentMessage).role;
		if (role === "system") counts.system++;
		else if (role === "user") counts.user++;
		else if (role === "assistant") counts.assistant++;
		else if (role === "toolResult") counts.toolResult++;
	}
	return counts;
}

function formatTokenCount(count: number): string {
	if (count < 1000) return `${count}`;
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	return `${Math.round(count / 1000)}k`;
}

function shortenPath(p: string): string {
	const home = os.homedir();
	return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

// Budget thresholds as a % of the model's context window.
const BUDGET_WARN_PERCENT = 70;
const BUDGET_CRITICAL_PERCENT = 85;

function budgetStatus(percent: number): { label: string; hint: string } {
	if (percent >= BUDGET_CRITICAL_PERCENT) return { label: "CRITICAL", hint: "Run /context compact now." };
	if (percent >= BUDGET_WARN_PERCENT) return { label: "high", hint: "Consider /context compact soon." };
	return { label: "ok", hint: "" };
}

/** Fire-and-forget compaction with user-visible progress notifications. */
function triggerCompaction(ctx: ExtensionCommandContext): void {
	if (typeof ctx.compact !== "function") {
		ctx.ui.notify("Compaction is not available in this context.", "warning");
		return;
	}
	ctx.ui.notify("Compacting context…", "info");
	ctx.compact({
		onComplete: () => ctx.ui.notify("Context compacted.", "info"),
		onError: (err) => ctx.ui.notify(`Compaction failed: ${err.message}`, "error"),
	});
}

export default function contextInspector(pi: ExtensionAPI): void {
	// In-memory state
	let latestMessages: Message[] = [];
	const filesRead = new Map<string, FileReadEntry>();
	const toolCallCounts = new Map<string, number>();

	// Capture messages array on every context build
	pi.on("context", async (event) => {
		latestMessages = [...event.messages];
		return undefined;
	});

	// Track file reads and tool call counts
	pi.on("tool_call", async (event) => {
		// Count all tool calls
		const current = toolCallCounts.get(event.toolName) ?? 0;
		toolCallCounts.set(event.toolName, current + 1);

		// Track file reads specifically
		if (isToolCallEventType("read", event)) {
			const filePath = event.input.path;
			const existing = filesRead.get(filePath);
			const lines = event.input.limit ?? 0;
			if (existing) {
				existing.count += 1;
				existing.lastLines = lines;
			} else {
				filesRead.set(filePath, { count: 1, lastLines: lines });
			}
		}

		return undefined;
	});

	// Reset state on new session
	pi.on("session_start", async () => {
		latestMessages = [];
		filesRead.clear();
		toolCallCounts.clear();
	});

	pi.registerCommand("context", {
		description: "Inspect the context window ('/context dump' saves full JSON, '/context compact' compacts now)",
		handler: async (args, ctx) => {
			const sub = args?.trim().toLowerCase() ?? "";
			const isDump = sub === "dump";

			if (sub === "compact") {
				triggerCompaction(ctx);
				return;
			}

			if (latestMessages.length === 0) {
				ctx.ui.notify("No context captured yet. Send a message first.", "info");
				return;
			}

			if (isDump) {
				// Write full messages to a JSON file
				const timestamp = Date.now();
				const tokens = categorizeTokens(latestMessages);
				const dumpData = {
					timestamp: new Date(timestamp).toISOString(),
					tokenEstimate: tokens.total,
					messageCount: latestMessages.length,
					messages: latestMessages,
				};

				const tmpDir = os.tmpdir();
				const dumpPath = path.join(tmpDir, `pi-context-dump-${timestamp}.json`);
				fs.writeFileSync(dumpPath, JSON.stringify(dumpData, null, 2));
				ctx.ui.notify(`Context dumped to:\n${dumpPath}`, "info");
				return;
			}

			// Build summary report
			const tokens = categorizeTokens(latestMessages);
			const counts = countMessages(latestMessages);

			// Get real usage if available
			const realUsage = ctx.getContextUsage();

			let report = "";
			report += "═══════════════════════════════════════\n";
			report += "         CONTEXT INSPECTOR\n";
			report += "═══════════════════════════════════════\n\n";

			// Token section
			report += "Tokens (estimated):\n";
			report += `  System prompt:      ~${formatTokenCount(tokens.system)}\n`;
			report += `  Conversation:       ~${formatTokenCount(tokens.user + tokens.assistant)}\n`;
			report += `  Tool results:       ~${formatTokenCount(tokens.toolResult)}\n`;
			report += `  Total:              ~${formatTokenCount(tokens.total)}\n`;

			let overBudget = false;
			let usagePct = 0;
			if (realUsage && realUsage.tokens != null) {
				usagePct =
					realUsage.percent ??
					(realUsage.contextWindow ? (realUsage.tokens / realUsage.contextWindow) * 100 : 0);
				const status = budgetStatus(usagePct);
				overBudget = usagePct >= BUDGET_CRITICAL_PERCENT;
				report += `\n  Real usage:         ${formatTokenCount(realUsage.tokens)} / ${formatTokenCount(realUsage.contextWindow)} tokens (${Math.round(usagePct)}%, ${status.label})\n`;
				if (status.hint) report += `                      ${status.hint}\n`;
			}

			// Messages section
			report += `\nMessages:             ${counts.total}\n`;
			report += `  System:              ${counts.system}\n`;
			report += `  User:               ${counts.user}\n`;
			report += `  Assistant:          ${counts.assistant}\n`;
			report += `  Tool results:        ${counts.toolResult}\n`;

			// Tool calls section
			if (toolCallCounts.size > 0) {
				const totalCalls = Array.from(toolCallCounts.values()).reduce((a, b) => a + b, 0);
				report += `\nTool Calls:           ${totalCalls}\n`;
				const sorted = [...toolCallCounts.entries()].sort((a, b) => b[1] - a[1]);
				for (const [name, count] of sorted) {
					report += `  ${name}:${" ".repeat(Math.max(1, 20 - name.length - 1))}${count}\n`;
				}
			}

			// Files read section
			if (filesRead.size > 0) {
				report += `\nFiles Read:            ${filesRead.size}\n`;
				const sorted = [...filesRead.entries()].sort((a, b) => b[1].count - a[1].count);
				for (const [filePath, entry] of sorted) {
					const short = shortenPath(filePath);
					const countStr = entry.count > 1 ? ` ×${entry.count}` : "";
					report += `  ${short}${countStr}\n`;
				}

				const duplicates = sorted.filter(([, e]) => e.count > 1);
				if (duplicates.length > 0) {
					report += `\n───────────────────────────────────────\n`;
					report += `Duplicates:  ${duplicates.length} file${duplicates.length > 1 ? "s" : ""} read more than once\n`;
					report += `───────────────────────────────────────\n`;
				}
			}

			ctx.ui.notify(report, overBudget ? "warning" : "info");

			if (overBudget && ctx.hasUI) {
				const ok = await ctx.ui.confirm(
					"Compact context now?",
					`Context is at ${Math.round(usagePct)}% of the window. Compaction summarizes older turns to free space.`,
				);
				if (ok) triggerCompaction(ctx);
			}
		},
	});
}
