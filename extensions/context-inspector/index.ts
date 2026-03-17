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
