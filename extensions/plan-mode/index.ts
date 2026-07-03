/**
 * Plan Mode Extension
 *
 * Read-only exploration mode for safe code analysis.
 * When enabled, only read-only tools are available.
 *
 * Features:
 * - /plan command or Ctrl+Alt+P to toggle
 * - Bash restricted to allowlisted read-only commands
 * - Extracts numbered plan steps from "Plan:" sections
 * - [DONE:n] markers to complete steps during execution
 * - Progress tracking widget during execution
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key } from "@mariozechner/pi-tui";
import { extractTodoItems, isSafeCommand, markCompletedSteps, type TodoItem } from "./utils.js";

// Tools
// Read-only built-ins (bash is further gated by isSafeCommand) plus the ask_human tool
// so the agent can ask clarifying questions while planning.
const PLAN_MODE_TOOLS = ["read", "grep", "find", "ls", "bash", "ask_human"];
// Fallback only. The real default tool set (including custom tools like subagent,
// render_diagram, ask_human) is captured at runtime via pi.getActiveTools() and restored.
const NORMAL_MODE_TOOLS = ["read", "bash", "edit", "write", "grep", "find", "ls"];

// Type guard for assistant messages
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

// Extract text content from an assistant message
function getTextContent(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

export default function planModeExtension(pi: ExtensionAPI): void {
	let planModeEnabled = false;
	let executionMode = false;
	let todoItems: TodoItem[] = [];
	// The full default tool set, captured before we first restrict tools. Restoring this
	// (rather than a hardcoded list) keeps grep/find/ls and custom tools available after
	// plan mode is toggled off.
	let defaultTools: string[] | null = null;
	// Whether we've already nudged the agent to escalate via ask_human since the last user
	// input. Bounds self-correction to one nudge per clarification episode (prevents loops).
	let planNudgedSinceLastInput = false;

	function captureDefaultTools(): void {
		if (defaultTools === null) {
			defaultTools = pi.getActiveTools();
		}
	}

	function restoreTools(): void {
		pi.setActiveTools(defaultTools ?? NORMAL_MODE_TOOLS);
	}

	pi.registerFlag("plan", {
		description: "Start in plan mode (read-only exploration)",
		type: "boolean",
		default: false,
	});

	function updateStatus(ctx: ExtensionContext): void {
		const hasTodos = todoItems.length > 0;
		// Show the todo widget both while planning and while executing, so the plan is
		// visible (and refreshes) as soon as it is created — not only during execution.
		const showTodos = (executionMode || planModeEnabled) && hasTodos;

		// Footer status
		if (executionMode && hasTodos) {
			const completed = todoItems.filter((t) => t.completed).length;
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("accent", `📋 ${completed}/${todoItems.length}`));
		} else if (planModeEnabled) {
			ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", hasTodos ? `⏸ plan (${todoItems.length})` : "⏸ plan"));
		} else {
			ctx.ui.setStatus("plan-mode", undefined);
		}

		// Widget showing todo list
		if (showTodos) {
			const lines = todoItems.map((item) => {
				if (item.completed) {
					return (
						ctx.ui.theme.fg("success", "☑ ") + ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(item.text))
					);
				}
				return `${ctx.ui.theme.fg("muted", "☐ ")}${item.text}`;
			});
			ctx.ui.setWidget("plan-todos", lines);
		} else {
			ctx.ui.setWidget("plan-todos", undefined);
		}
	}

	function togglePlanMode(ctx: ExtensionContext): void {
		planModeEnabled = !planModeEnabled;
		executionMode = false;
		todoItems = [];
		planNudgedSinceLastInput = false;

		if (planModeEnabled) {
			captureDefaultTools();
			pi.setActiveTools(PLAN_MODE_TOOLS);
			ctx.ui.notify(`Plan mode enabled. Tools: ${PLAN_MODE_TOOLS.join(", ")}`);
		} else {
			restoreTools();
			ctx.ui.notify("Plan mode disabled. Full access restored.");
		}
		updateStatus(ctx);
	}

	function persistState(): void {
		pi.appendEntry("plan-mode", {
			enabled: planModeEnabled,
			todos: todoItems,
			executing: executionMode,
		});
	}

	pi.registerCommand("plan", {
		description: "Toggle plan mode (read-only exploration)",
		handler: async (_args, ctx) => togglePlanMode(ctx),
	});

	pi.registerCommand("todos", {
		description: "Show current plan todo list",
		handler: async (_args, ctx) => {
			if (todoItems.length === 0) {
				ctx.ui.notify("No todos. Create a plan first with /plan", "info");
				return;
			}
			const list = todoItems.map((item, i) => `${i + 1}. ${item.completed ? "✓" : "○"} ${item.text}`).join("\n");
			ctx.ui.notify(`Plan Progress:\n${list}`, "info");
		},
	});

	pi.registerShortcut(Key.ctrlAlt("p"), {
		description: "Toggle plan mode",
		handler: async (ctx) => togglePlanMode(ctx),
	});

	// Block destructive bash commands in plan mode
	pi.on("tool_call", async (event) => {
		// A proper escalation via ask_human refreshes the nudge budget so a later lapse
		// within the same user turn can still be corrected.
		if (event.toolName === "ask_human") {
			planNudgedSinceLastInput = false;
			return;
		}
		if (!planModeEnabled || event.toolName !== "bash") return;

		const command = event.input.command as string;
		if (!isSafeCommand(command)) {
			return {
				block: true,
				reason: `Plan mode: command blocked (not allowlisted). Use /plan to disable plan mode first.\nCommand: ${command}`,
			};
		}
	});

	// Each new user message starts a fresh clarification episode → allow a nudge again.
	pi.on("input", async () => {
		planNudgedSinceLastInput = false;
	});

	// Filter out stale plan/execution context.
	// - Stale plan-mode context is dropped whenever we're not in plan mode.
	// - Stale execution context is dropped only when we're not currently executing, so the
	//   live execution context injected for the current turn is never stripped.
	pi.on("context", async (event) => {
		if (planModeEnabled) return;

		const stripExecution = !executionMode;
		const isStaleMarker = (text: string | undefined): boolean =>
			!!text && (text.includes("[PLAN MODE ACTIVE]") || (stripExecution && text.includes("[EXECUTING PLAN")));

		return {
			messages: event.messages.filter((m) => {
				const msg = m as AgentMessage & { customType?: string };
				if (msg.customType === "plan-mode-context") return false;
				if (stripExecution && msg.customType === "plan-execution-context") return false;
				if (msg.role !== "user") return true;

				const content = msg.content;
				if (typeof content === "string") {
					return !isStaleMarker(content);
				}
				if (Array.isArray(content)) {
					return !content.some((c) => c.type === "text" && isStaleMarker((c as TextContent).text));
				}
				return true;
			}),
		};
	});

	// Inject plan/execution context before agent starts
	pi.on("before_agent_start", async () => {
		if (planModeEnabled) {
			return {
				message: {
					customType: "plan-mode-context",
					content: `[PLAN MODE ACTIVE]
You are in plan mode - a read-only exploration mode for safe code analysis.

Restrictions:
- You can only use: read, grep, find, ls, bash, ask_human
- You CANNOT use: edit, write (file modifications are disabled)
- Bash is restricted to an allowlist of read-only commands

CLARIFYING QUESTIONS — REQUIRED:
- If you need ANY clarification, decision, or missing information from the user, you MUST call the ask_human tool.
- Do NOT ask questions in plain text and do NOT defer them to the end — plain-text questions are not surfaced to the user and will be ignored.
- Pick the right kind: "select" (with options) for a fixed choice, "confirm" for yes/no, or "input" for free text.

Use brave-search skill via bash for web research.

Create a detailed numbered plan under a "Plan:" header:

Plan:
1. First step description
2. Second step description
...

Do NOT attempt to make changes - just describe what you would do.`,
					display: false,
				},
			};
		}

		if (executionMode && todoItems.length > 0) {
			const remaining = todoItems.filter((t) => !t.completed);
			const todoList = remaining.map((t) => `${t.step}. ${t.text}`).join("\n");
			const completedCount = todoItems.filter((t) => t.completed).length;
			return {
				message: {
					customType: "plan-execution-context",
					content: `[EXECUTING PLAN - Full tool access enabled]

Progress: ${completedCount}/${todoItems.length} completed

Remaining steps:
${todoList}

Execute each step in order.
After completing a step, you MUST include a [DONE:n] tag in your response.

Examples:
- After completing step 1: "I've created the file. [DONE:1]"
- After completing step 3: "Tests are passing. [DONE:3]"
- Multiple steps: "Done with setup. [DONE:1] [DONE:2]"

Important: Use the original step numbers shown above, not the position in the remaining list.`,
					display: false,
				},
			};
		}
	});

	// Track progress after each turn
	pi.on("turn_end", async (event, ctx) => {
		if (!executionMode || todoItems.length === 0) return;
		if (!isAssistantMessage(event.message)) return;

		const text = getTextContent(event.message);
		markCompletedSteps(text, todoItems);

		// Always update status and persist, even if no new completions
		// This ensures UI stays in sync
		updateStatus(ctx);
		persistState();
	});

	// Handle plan completion and plan mode UI
	pi.on("agent_end", async (event, ctx) => {
		// Check if execution is complete
		if (executionMode && todoItems.length > 0) {
			if (todoItems.every((t) => t.completed)) {
				const completedList = todoItems.map((t) => `~~${t.text}~~`).join("\n");
				pi.sendMessage(
					{ customType: "plan-complete", content: `**Plan Complete!** ✓\n\n${completedList}`, display: true },
					{ triggerTurn: false },
				);
				executionMode = false;
				todoItems = [];
				restoreTools();
				updateStatus(ctx);
				persistState(); // Save cleared state so resume doesn't restore old execution mode
			}
			return;
		}

		if (!planModeEnabled || !ctx.hasUI) return;

		// Extract todos from last assistant message
		const lastAssistant = [...event.messages].reverse().find(isAssistantMessage);
		const lastText = lastAssistant ? getTextContent(lastAssistant) : "";
		if (lastAssistant) {
			const extracted = extractTodoItems(lastText);
			if (extracted.length > 0) {
				todoItems = extracted;
				// Render/refresh the todo widget now that a plan exists (also covers refinement,
				// where agent_end runs again with a new plan), and persist so "Stay in plan
				// mode" retains the extracted todos across a resume.
				updateStatus(ctx);
				persistState();
			}
		}

		// If the agent stopped to ask for clarification in plain text (no plan produced) instead
		// of calling ask_human, steer it to re-ask via the tool so the question reaches the user.
		// Bounded to one nudge per clarification episode (see planNudgedSinceLastInput) so it
		// cannot loop; if the agent ignores the nudge, the human still sees the prose question.
		const askedInProse =
			todoItems.length === 0 && !/\*{0,2}Plan:\*{0,2}/i.test(lastText) && /\?/.test(lastText);
		if (askedInProse && !planNudgedSinceLastInput) {
			planNudgedSinceLastInput = true;
			pi.sendMessage(
				{
					customType: "plan-ask-human-nudge",
					content:
						'You asked for clarification in plain text. In plan mode you MUST use the ask_human tool so the question actually reaches the user — plain-text questions are not surfaced. Re-ask your question(s) now by calling ask_human (kind "select" with options, "confirm", or "input").',
					display: false,
				},
				{ triggerTurn: true },
			);
			return; // Wait for the ask_human turn instead of prompting "what next?".
		}

		// Show plan steps and prompt for next action
		if (todoItems.length > 0) {
			const todoListText = todoItems.map((t, i) => `${i + 1}. ☐ ${t.text}`).join("\n");
			pi.sendMessage(
				{
					customType: "plan-todo-list",
					content: `**Plan Steps (${todoItems.length}):**\n\n${todoListText}`,
					display: true,
				},
				{ triggerTurn: false },
			);
		}

		const choice = await ctx.ui.select("Plan mode - what next?", [
			todoItems.length > 0 ? "Execute the plan (track progress)" : "Execute the plan",
			"Stay in plan mode",
			"Refine the plan",
		]);

		if (choice?.startsWith("Execute")) {
			planModeEnabled = false;
			executionMode = todoItems.length > 0;
			restoreTools();
			updateStatus(ctx);
			persistState(); // Durably record the plan→execution transition immediately

			const execMessage =
				todoItems.length > 0
					? `Execute the plan. Start with: ${todoItems[0].text}`
					: "Execute the plan you just created.";
			pi.sendMessage(
				{ customType: "plan-mode-execute", content: execMessage, display: true },
				{ triggerTurn: true },
			);
		} else if (choice === "Refine the plan") {
			const refinement = await ctx.ui.editor("Refine the plan:", "");
			if (refinement?.trim()) {
				pi.sendUserMessage(refinement.trim());
			}
		}
	});

	// Restore state on session start/resume
	pi.on("session_start", async (_event, ctx) => {
		// Capture the full default tool set before we ever restrict it below.
		captureDefaultTools();

		if (pi.getFlag("plan") === true) {
			planModeEnabled = true;
		}

		const entries = ctx.sessionManager.getEntries();

		// Restore persisted state
		const planModeEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "plan-mode")
			.pop() as { data?: { enabled: boolean; todos?: TodoItem[]; executing?: boolean } } | undefined;

		if (planModeEntry?.data) {
			planModeEnabled = planModeEntry.data.enabled ?? planModeEnabled;
			todoItems = planModeEntry.data.todos ?? todoItems;
			executionMode = planModeEntry.data.executing ?? executionMode;
		}

		// On resume: re-scan messages to rebuild completion state
		// Only scan messages AFTER the last "plan-mode-execute" to avoid picking up [DONE:n] from previous plans
		const isResume = planModeEntry !== undefined;
		if (isResume && executionMode && todoItems.length > 0) {
			// Find the index of the last plan-mode-execute entry (marks when current execution started)
			let executeIndex = -1;
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i] as { type: string; customType?: string };
				if (entry.customType === "plan-mode-execute") {
					executeIndex = i;
					break;
				}
			}

			// Only scan messages after the execute marker
			const messages: AssistantMessage[] = [];
			for (let i = executeIndex + 1; i < entries.length; i++) {
				const entry = entries[i];
				if (entry.type === "message" && "message" in entry && isAssistantMessage(entry.message as AgentMessage)) {
					messages.push(entry.message as AssistantMessage);
				}
			}
			const allText = messages.map(getTextContent).join("\n");
			markCompletedSteps(allText, todoItems);
		}

		if (planModeEnabled) {
			pi.setActiveTools(PLAN_MODE_TOOLS);
		}
		updateStatus(ctx);
	});
}
