import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
}
