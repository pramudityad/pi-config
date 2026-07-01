/**
 * Subagent Tool - Delegate tasks to specialized agents
 *
 * In-process SDK orchestrator. Each subagent is a nested AgentSession
 * created via createAgentSession(), not a spawned process.
 *
 * Supports five modes:
 *   - Single: { agent: "name", task: "..." }
 *   - Parallel: { tasks: [...] }
 *   - Chain: { chain: [...] }
 *   - Review 🆕: { review: { implementer, reviewer, task, maxIterations } }
 *   - Consensus 🆕: { consensus: { agent, task, voters } }
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import { type ExtensionAPI, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { Type } from "@sinclair/typebox";
import { type AgentConfig, type AgentScope, discoverAgents } from "./agents.ts";
import { resolveConsensus } from "./consensus.ts";
import { SessionCache, runSingleAgent as runAgent, finalText } from "./orchestrator.ts";
import { createScratchpad, scratchpadNotice, cleanupScratchpad, newWorkflowId } from "./scratchpad.ts";
import {
	type RunState,
	type StepRecord,
	fingerprintSteps,
	finalizeRunState,
	initRunState,
	loadRunState,
	recordStep,
	resumableSteps,
	runStatePath,
	saveRunState,
} from "./runstate.ts";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const COLLAPSED_ITEM_COUNT = 10;

function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	return `${(count / 1000000).toFixed(1)}M`;
}

function formatUsageStats(
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens?: number;
		turns?: number;
	},
	model?: string,
): string {
	const parts: string[] = [];
	if (usage.turns) parts.push(`${usage.turns} turn${usage.turns > 1 ? "s" : ""}`);
	if (usage.input) parts.push(`↑${formatTokens(usage.input)}`);
	if (usage.output) parts.push(`↓${formatTokens(usage.output)}`);
	if (usage.cacheRead) parts.push(`R${formatTokens(usage.cacheRead)}`);
	if (usage.cacheWrite) parts.push(`W${formatTokens(usage.cacheWrite)}`);
	if (usage.cost) parts.push(`$${usage.cost.toFixed(4)}`);
	if (usage.contextTokens && usage.contextTokens > 0) {
		parts.push(`ctx:${formatTokens(usage.contextTokens)}`);
	}
	if (model) parts.push(model);
	return parts.join(" ");
}

function formatToolCall(
	toolName: string,
	args: Record<string, unknown>,
	themeFg: (color: any, text: string) => string,
): string {
	const shortenPath = (p: string) => {
		const home = os.homedir();
		return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
	};

	switch (toolName) {
		case "bash": {
			const command = (args.command as string) || "...";
			const preview = command.length > 60 ? `${command.slice(0, 60)}...` : command;
			return themeFg("muted", "$ ") + themeFg("toolOutput", preview);
		}
		case "read": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const offset = args.offset as number | undefined;
			const limit = args.limit as number | undefined;
			let text = themeFg("accent", filePath);
			if (offset !== undefined || limit !== undefined) {
				const startLine = offset ?? 1;
				const endLine = limit !== undefined ? startLine + limit - 1 : "";
				text += themeFg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}
			return themeFg("muted", "read ") + text;
		}
		case "write": {
			const rawPath = (args.file_path || args.path || "...") as string;
			const filePath = shortenPath(rawPath);
			const content = (args.content || "") as string;
			const lines = content.split("\n").length;
			let text = themeFg("muted", "write ") + themeFg("accent", filePath);
			if (lines > 1) text += themeFg("dim", ` (${lines} lines)`);
			return text;
		}
		case "edit": {
			const rawPath = (args.file_path || args.path || "...") as string;
			return themeFg("muted", "edit ") + themeFg("accent", shortenPath(rawPath));
		}
		case "ls": {
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "ls ") + themeFg("accent", shortenPath(rawPath));
		}
		case "find": {
			const pattern = (args.pattern || "*") as string;
			const rawPath = (args.path || ".") as string;
			return themeFg("muted", "find ") + themeFg("accent", pattern) + themeFg("dim", ` in ${shortenPath(rawPath)}`);
		}
		case "grep": {
			const pattern = (args.pattern || "") as string;
			const rawPath = (args.path || ".") as string;
			return (
				themeFg("muted", "grep ") +
				themeFg("accent", `/${pattern}/`) +
				themeFg("dim", ` in ${shortenPath(rawPath)}`)
			);
		}
		default: {
			const argsStr = JSON.stringify(args);
			const preview = argsStr.length > 50 ? `${argsStr.slice(0, 50)}...` : argsStr;
			return themeFg("accent", toolName) + themeFg("dim", ` ${preview}`);
		}
	}
}

interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	contextTokens: number;
	turns: number;
}

interface SingleResult {
	agent: string;
	agentSource: "user" | "project" | "unknown";
	task: string;
	exitCode: number;
	messages: Message[];
	stderr: string;
	usage: UsageStats;
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	step?: number;
}

interface SubagentDetails {
	mode: "single" | "parallel" | "chain" | "review" | "consensus";
	agentScope: AgentScope;
	projectAgentsDir: string | null;
	results: SingleResult[];
}

function getFinalOutput(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const msg = messages[i];
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") return part.text;
			}
		}
	}
	return "";
}

type DisplayItem = { type: "text"; text: string } | { type: "toolCall"; name: string; args: Record<string, any> };

function getDisplayItems(messages: Message[]): DisplayItem[] {
	const items: DisplayItem[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant") {
			for (const part of msg.content) {
				if (part.type === "text") items.push({ type: "text", text: part.text });
				else if (part.type === "toolCall") items.push({ type: "toolCall", name: part.name, args: part.arguments });
			}
		}
	}
	return items;
}

async function mapWithConcurrencyLimit<TIn, TOut>(
	items: TIn[],
	concurrency: number,
	fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
	if (items.length === 0) return [];
	const limit = Math.max(1, Math.min(concurrency, items.length));
	const results: TOut[] = new Array(items.length);
	let nextIndex = 0;
	const workers = new Array(limit).fill(null).map(async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) return;
			results[current] = await fn(items[current], current);
		}
	});
	await Promise.all(workers);
	return results;
}

// ─── Adapter: RunResult → SingleResult (for existing renderers) ─────────

function emptyUsage(): UsageStats {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function toSingleResult(agent: AgentConfig, task: string, run: Awaited<ReturnType<typeof runAgent>>, step?: number): SingleResult {
	return {
		agent: agent.name,
		agentSource: agent.source,
		task,
		exitCode: run.error || run.stopReason === "error" || run.stopReason === "aborted" ? 1 : 0,
		messages: run.messages,
		stderr: run.error ?? "",
		usage: run.usage,
		model: run.model ?? agent.model,
		stopReason: run.stopReason,
		errorMessage: run.errorMessage ?? run.error,
		step,
	};
}

function isFailedResult(r: SingleResult): boolean {
	return r.exitCode !== 0 || r.stopReason === "error" || r.stopReason === "aborted";
}

// ─── Durable run state (persist / resume) ──────────────────────────────

function nowIso(): string {
	return new Date().toISOString();
}

/** Compact a completed/failed SingleResult into a persistable StepRecord. */
function toStepRecord(r: SingleResult, step: number, output: string): StepRecord {
	return {
		step,
		agent: r.agent,
		task: r.task,
		status: isFailedResult(r) ? "failed" : "completed",
		output,
		errorMessage: r.errorMessage,
		model: r.model,
		usage: r.usage,
	};
}

/** Rebuild a SingleResult from a persisted step so resumed steps still render. */
function reconstructResult(rec: StepRecord): SingleResult {
	const message = { role: "assistant", content: [{ type: "text", text: rec.output }] } as unknown as Message;
	return {
		agent: rec.agent,
		agentSource: "unknown",
		task: rec.task,
		exitCode: rec.status === "completed" ? 0 : 1,
		messages: [message],
		stderr: rec.errorMessage ?? "",
		usage: rec.usage ?? emptyUsage(),
		model: rec.model,
		stopReason: rec.status === "completed" ? undefined : "error",
		errorMessage: rec.errorMessage,
		step: rec.step,
	};
}

/** Persist the final state of a non-resumable mode (audit trail). */
function persistFinalState(
	cwd: string,
	runId: string,
	mode: SubagentDetails["mode"],
	results: SingleResult[],
): void {
	const state = initRunState(runId, mode, fingerprintSteps(results.map((r) => ({ agent: r.agent, task: r.task }))), nowIso());
	results.forEach((r, i) => recordStep(state, toStepRecord(r, i + 1, finalText(r.messages)), nowIso()));
	finalizeRunState(state, results.every((r) => !isFailedResult(r)) ? "completed" : "failed", nowIso());
	saveRunState(cwd, state);
}

// ─── Params ──────────────────────────────────────────────────────────────

const TaskItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task to delegate to the agent" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ChainItem = Type.Object({
	agent: Type.String({ description: "Name of the agent to invoke" }),
	task: Type.String({ description: "Task with optional {previous} placeholder for prior output" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
});

const ReviewParams = Type.Object({
	implementer: Type.String({ description: "Agent that implements" }),
	reviewer: Type.String({ description: "Agent that reviews" }),
	task: Type.String({ description: "The task to implement and review" }),
	maxIterations: Type.Optional(Type.Number({ description: "Max impl↔review cycles. Default 3.", default: 3 })),
});

const ConsensusParams = Type.Object({
	agent: Type.String({ description: "Agent to run repeatedly" }),
	task: Type.String({ description: "Question to answer" }),
	voters: Type.Optional(Type.Number({ description: "Number of independent runs. Default 3.", default: 3 })),
});

const AgentScopeSchema = StringEnum(["user", "project", "both"] as const, {
	description: 'Which agent directories to use. Default: "user". Use "both" to include project-local agents.',
	default: "user",
});

const SubagentParams = Type.Object({
	agent: Type.Optional(Type.String({ description: "Name of the agent to invoke (for single mode)" })),
	task: Type.Optional(Type.String({ description: "Task to delegate (for single mode)" })),
	tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} for parallel execution" })),
	chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} for sequential execution" })),
	review: Type.Optional(ReviewParams),
	consensus: Type.Optional(ConsensusParams),
	agentScope: Type.Optional(AgentScopeSchema),
	confirmProjectAgents: Type.Optional(
		Type.Boolean({ description: "Prompt before running project-local agents. Default: true.", default: true }),
	),
	scratchpad: Type.Optional(Type.Boolean({ description: "Enable a shared file-based scratchpad for this workflow.", default: false })),
	keepScratch: Type.Optional(Type.Boolean({ description: "Keep the scratchpad file after the run (debug). Default false.", default: false })),
	runId: Type.Optional(
		Type.String({
			description:
				"Resume a prior run by id, skipping already-completed steps (chain mode). The run is persisted to .pi/runs/<id>.json; a failed chain reports its id so it can be resumed.",
		}),
	),
	persist: Type.Optional(
		Type.Boolean({ description: "Persist durable run state to .pi/runs/ for resume/audit. Default: true.", default: true }),
	),
	cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (single mode)" })),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: [
			"Delegate tasks to specialized subagents with isolated context.",
			"Modes: single (agent + task), parallel (tasks array), chain (sequential with {previous} placeholder),",
			"review (implementer↔reviewer loop), consensus (majority voting).",
			'Default agent scope is "user" (from ~/.pi/agent/agents).',
			'To enable project-local agents in .pi/agents, set agentScope: "both" (or "project").',
		].join(" "),
		parameters: SubagentParams,

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const agentScope: AgentScope = params.agentScope ?? "user";
			const discovery = discoverAgents(ctx.cwd, agentScope);
			const agents = discovery.agents;
			const confirmProjectAgents = params.confirmProjectAgents ?? true;

			const hasChain = (params.chain?.length ?? 0) > 0;
			const hasTasks = (params.tasks?.length ?? 0) > 0;
			const hasSingle = Boolean(params.agent && params.task);
			const hasReview = Boolean(params.review);
			const hasConsensus = Boolean(params.consensus);
			const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle) + Number(hasReview) + Number(hasConsensus);

			const makeDetails =
				(mode: SubagentDetails["mode"]) =>
				(results: SingleResult[]): SubagentDetails => ({
					mode,
					agentScope,
					projectAgentsDir: discovery.projectAgentsDir,
					results,
				});

			if (modeCount !== 1) {
				const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
				return {
					content: [
						{
							type: "text",
							text: `Invalid parameters. Provide exactly one mode.\nAvailable agents: ${available}`,
						},
					],
					details: makeDetails("single")([]),
				};
			}

			if ((agentScope === "project" || agentScope === "both") && confirmProjectAgents && ctx.hasUI) {
				const requestedAgentNames = new Set<string>();
				if (params.chain) for (const step of params.chain) requestedAgentNames.add(step.agent);
				if (params.tasks) for (const t of params.tasks) requestedAgentNames.add(t.agent);
				if (params.review) {
					requestedAgentNames.add(params.review.implementer);
					requestedAgentNames.add(params.review.reviewer);
				}
				if (params.consensus) requestedAgentNames.add(params.consensus.agent);
				if (params.agent) requestedAgentNames.add(params.agent);

				const projectAgentsRequested = Array.from(requestedAgentNames)
					.map((name) => agents.find((a) => a.name === name))
					.filter((a): a is AgentConfig => a?.source === "project");

				if (projectAgentsRequested.length > 0) {
					const names = projectAgentsRequested.map((a) => a.name).join(", ");
					const dir = discovery.projectAgentsDir ?? "(unknown)";
					const ok = await ctx.ui.confirm(
						"Run project-local agents?",
						`Agents: ${names}\nSource: ${dir}\n\nProject agents are repo-controlled. Only continue for trusted repositories.`,
					);
					if (!ok)
						return {
							content: [{ type: "text", text: "Canceled: project-local agents not approved." }],
							details: makeDetails(hasChain ? "chain" : hasTasks ? "parallel" : "single")([]),
						};
				}
			}

			// ─── SINGLE ──────────────────────────────────────────────────────
			if (params.agent && params.task) {
				const agent = agents.find((a) => a.name === params.agent);
				if (!agent) {
					return {
						content: [
							{
								type: "text",
								text: `Unknown agent: "${params.agent}". Available: ${agents.map((a) => a.name).join(", ") || "none"}`,
							},
						],
						details: makeDetails("single")([]),
						isError: true,
					};
				}
				const scratchPath = params.scratchpad ? createScratchpad(ctx.cwd, newWorkflowId()) : undefined;
				const taskText = scratchPath ? params.task + scratchpadNotice(scratchPath) : params.task;
				const run = await runAgent(agent, taskText, {
					cwd: params.cwd ?? ctx.cwd,
					scratchpadPath: scratchPath,
					signal,
					onUpdate: onUpdate
						? (msgs) =>
							onUpdate({
								content: [{ type: "text", text: finalText(msgs) || "(running...)" }],
								details: makeDetails("single")([{ ...toSingleResult(agent, params.task, { messages: msgs, usage: emptyUsage() }), step: undefined }]),
							})
						: undefined,
				});
				if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
				const sr = toSingleResult(agent, params.task, run);
				const isError = isFailedResult(sr);
				return {
					content: [{ type: "text", text: isError ? (sr.errorMessage || "(failed)") : (finalText(run.messages) || "(no output)") }],
					details: makeDetails("single")([sr]),
					isError,
				};
			}

			// ─── CHAIN ───────────────────────────────────────────────────────
			if (params.chain && params.chain.length > 0) {
				const cache = new SessionCache();
				const scratchPath = params.scratchpad ? createScratchpad(ctx.cwd, newWorkflowId()) : undefined;
				const results: SingleResult[] = [];
				let previousOutput = "";

				// Durable run state: persist each step; resume skips completed ones.
				const persist = params.persist ?? true;
				const fingerprint = fingerprintSteps(params.chain.map((s) => ({ agent: s.agent, task: s.task })));
				const runId = params.runId ?? newWorkflowId();
				let reusable: StepRecord[] = [];
				let state: RunState | null = null;
				if (persist) {
					const prior = params.runId ? loadRunState(ctx.cwd, runId) : null;
					if (prior) {
						const r = resumableSteps(prior, fingerprint);
						if (r === null) {
							return {
								content: [
									{
										type: "text",
										text: `Cannot resume runId "${runId}": the chain differs from the recorded run. Omit runId to start fresh.`,
									},
								],
								details: makeDetails("chain")([]),
								isError: true,
							};
						}
						reusable = r;
						state = prior;
						state.status = "running";
					} else {
						state = initRunState(runId, "chain", fingerprint, nowIso());
					}
					saveRunState(ctx.cwd, state);
				}

				try {
					for (let i = 0; i < params.chain.length; i++) {
						const step = params.chain[i];

						// Resume: reuse a previously completed leading step.
						const reused = reusable[i];
						if (reused && reused.status === "completed") {
							results.push(reconstructResult(reused));
							previousOutput = reused.output;
							continue;
						}

						const agent = agents.find((a) => a.name === step.agent);
						if (!agent) {
							const sr: SingleResult = {
								agent: step.agent,
								agentSource: "unknown",
								task: step.task,
								exitCode: 1,
								messages: [],
								stderr: `Unknown agent: "${step.agent}"`,
								usage: emptyUsage(),
								step: i + 1,
							};
							results.push(sr);
							if (state) {
								recordStep(state, toStepRecord(sr, i + 1, ""), nowIso());
								finalizeRunState(state, "failed", nowIso());
								saveRunState(ctx.cwd, state);
							}
							return {
								content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): unknown agent` }],
								details: makeDetails("chain")(results),
								isError: true,
							};
						}
						let task = step.task.replace(/\{previous\}/g, previousOutput);
						if (scratchPath) task += scratchpadNotice(scratchPath);
						const run = await runAgent(agent, task, {
							cwd: step.cwd ?? ctx.cwd,
							scratchpadPath: scratchPath,
							signal,
							onUpdate: onUpdate
								? (msgs) =>
									onUpdate({
										content: [{ type: "text", text: finalText(msgs) }],
										details: makeDetails("chain")([...results, { ...toSingleResult(agent, task, { messages: msgs, usage: emptyUsage() }, i + 1) }]),
									})
								: undefined,
						}, cache);
						const sr = toSingleResult(agent, task, run, i + 1);
						results.push(sr);
						const stepOutput = finalText(run.messages);
						if (state) {
							recordStep(state, toStepRecord(sr, i + 1, stepOutput), nowIso());
							saveRunState(ctx.cwd, state);
						}
						if (isFailedResult(sr)) {
							if (state) {
								finalizeRunState(state, "failed", nowIso());
								saveRunState(ctx.cwd, state);
							}
							const resumeHint = persist
								? `\n\nResume after fixing with runId: "${runId}" (state: ${runStatePath(ctx.cwd, runId)})`
								: "";
							return {
								content: [
									{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${sr.errorMessage || "(no output)"}${resumeHint}` },
								],
								details: makeDetails("chain")(results),
								isError: true,
							};
						}
						previousOutput = stepOutput;
					}
					if (state) {
						finalizeRunState(state, "completed", nowIso());
						saveRunState(ctx.cwd, state);
					}
					return {
						content: [{ type: "text", text: finalText(results[results.length - 1].messages) || "(no output)" }],
						details: makeDetails("chain")(results),
					};
				} finally {
					cache.disposeAll();
					if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
				}
			}

			// ─── PARALLEL ────────────────────────────────────────────────────
			if (params.tasks && params.tasks.length > 0) {
				if (params.tasks.length > MAX_PARALLEL_TASKS)
					return {
						content: [
							{
								type: "text",
								text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
							},
						],
						details: makeDetails("parallel")([]),
					};

				const allResults: SingleResult[] = new Array(params.tasks.length);
				for (let i = 0; i < params.tasks.length; i++) {
					allResults[i] = {
						agent: params.tasks[i].agent,
						agentSource: "unknown",
						task: params.tasks[i].task,
						exitCode: -1,
						messages: [],
						stderr: "",
						usage: emptyUsage(),
					};
				}

				const emitParallelUpdate = () => {
					if (onUpdate) {
						const running = allResults.filter((r) => r.exitCode === -1).length;
						const done = allResults.filter((r) => r.exitCode !== -1).length;
						onUpdate({
							content: [{ type: "text", text: `Parallel: ${done}/${allResults.length} done, ${running} running...` }],
							details: makeDetails("parallel")([...allResults]),
						});
					}
				};

				const results = await mapWithConcurrencyLimit(params.tasks, MAX_CONCURRENCY, async (t, index) => {
					const agent = agents.find((a) => a.name === t.agent);
					if (!agent) {
						allResults[index] = {
							agent: t.agent,
							agentSource: "unknown",
							task: t.task,
							exitCode: 1,
							messages: [],
							stderr: `Unknown agent: "${t.agent}"`,
							usage: emptyUsage(),
						};
						emitParallelUpdate();
						return allResults[index];
					}
					const run = await runAgent(agent, t.task, {
						cwd: t.cwd ?? ctx.cwd,
						signal,
						onUpdate: (msgs) => {
							allResults[index] = { ...toSingleResult(agent, t.task, { messages: msgs, usage: emptyUsage() }), step: undefined };
							emitParallelUpdate();
						},
					});
					allResults[index] = toSingleResult(agent, t.task, run);
					emitParallelUpdate();
					return allResults[index];
				});

				const successCount = results.filter((r) => !isFailedResult(r)).length;
				const summaries = results.map((r) => {
					const output = finalText(r.messages);
					const preview = output.slice(0, 100) + (output.length > 100 ? "..." : "");
					return `[${r.agent}] ${!isFailedResult(r) ? "completed" : "failed"}: ${preview || "(no output)"}`;
				});
				if (params.persist ?? true) persistFinalState(ctx.cwd, params.runId ?? newWorkflowId(), "parallel", results);
				return {
					content: [
						{
							type: "text",
							text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}`,
						},
					],
					details: makeDetails("parallel")(results),
				};
			}

			// ─── REVIEW ─────────────────────────────────────────────────────
			if (params.review) {
				const { implementer, reviewer, task, maxIterations = 3 } = params.review;
				const impl = agents.find((a) => a.name === implementer);
				const rev = agents.find((a) => a.name === reviewer);
				if (!impl || !rev) {
					return {
						content: [{ type: "text", text: `Unknown agent(s). Available: ${agents.map((a) => a.name).join(", ")}` }],
						details: makeDetails("chain")([]),
						isError: true,
					};
				}
				const cache = new SessionCache();
				const scratchPath = params.scratchpad ? createScratchpad(ctx.cwd, newWorkflowId()) : undefined;
				const results: SingleResult[] = [];
				try {
					let implTask = task + (scratchPath ? scratchpadNotice(scratchPath) : "");
					let approved = false;
					for (let i = 0; i < maxIterations; i++) {
						const ir = await runAgent(impl, implTask, { cwd: ctx.cwd, scratchpadPath: scratchPath, signal }, cache);
						results.push(toSingleResult(impl, implTask, ir, results.length + 1));
						if (isFailedResult(results[results.length - 1])) break;
						const reviewTask = `Review this work and reply with APPROVED on its own line if acceptable, otherwise list required changes:\n\n${finalText(ir.messages)}` + (scratchPath ? scratchpadNotice(scratchPath) : "");
						const rr = await runAgent(rev, reviewTask, { cwd: ctx.cwd, scratchpadPath: scratchPath, signal }, cache);
						results.push(toSingleResult(rev, reviewTask, rr, results.length + 1));
						const verdict = finalText(rr.messages);
						if (/^\s*APPROVED\s*$/m.test(verdict)) {
							approved = true;
							break;
						}
						implTask = `Address this review feedback and revise:\n\n${verdict}` + (scratchPath ? scratchpadNotice(scratchPath) : "");
					}
					const summary = approved ? "Review passed." : `Review did not converge within ${maxIterations} iterations.`;
					if (params.persist ?? true) persistFinalState(ctx.cwd, params.runId ?? newWorkflowId(), "review", results);
					return {
						content: [{ type: "text", text: `${summary}\n\n${finalText(results[results.length - 1].messages)}` }],
						details: makeDetails("chain")(results),
						isError: !approved,
					};
				} finally {
					cache.disposeAll();
					if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
				}
			}

			// ─── CONSENSUS ───────────────────────────────────────────────────
			if (params.consensus) {
				const { agent: agentName, task, voters = 3 } = params.consensus;
				const agent = agents.find((a) => a.name === agentName);
				if (!agent) {
					return {
						content: [{ type: "text", text: `Unknown agent: "${agentName}"` }],
						details: makeDetails("parallel")([]),
						isError: true,
					};
				}
				const tasks = Array.from({ length: Math.min(voters, MAX_PARALLEL_TASKS) }, () => task);
				const runs = await mapWithConcurrencyLimit(tasks, MAX_CONCURRENCY, async (t) =>
					runAgent(agent, t, { cwd: ctx.cwd, signal }),
				);
				const results = runs.map((r, i) => toSingleResult(agent, `vote ${i + 1}`, r, i + 1));
				const answers = runs.map((r) => finalText(r.messages));
				const verdict = resolveConsensus(answers);
				let text: string;
				if (verdict.status === "agreed") text = `Consensus (unanimous, ${voters} voters): ${verdict.answer}`;
				else if (verdict.status === "majority") text = `Consensus (majority): ${verdict.answer}\nDissenting: ${verdict.dissenters.join(" | ")}`;
				else text = `No consensus (tie). Answers:\n${verdict.all.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`;
				if (params.persist ?? true) persistFinalState(ctx.cwd, params.runId ?? newWorkflowId(), "consensus", results);
				return {
					content: [{ type: "text", text }],
					details: makeDetails("parallel")(results),
					isError: verdict.status === "tie",
				};
			}

			// Fallback
			const available = agents.map((a) => `${a.name} (${a.source})`).join(", ") || "none";
			return {
				content: [{ type: "text", text: `Invalid parameters. Available agents: ${available}` }],
				details: makeDetails("single")([]),
			};
		},

		renderCall(args, theme) {
			const scope: AgentScope = args.agentScope ?? "user";
			if (args.review) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `review (${args.review.maxIterations ?? 3} max cycles)`) +
					theme.fg("muted", ` [${scope}]`) +
					`\n  ${theme.fg("accent", args.review.implementer)} ↔ ${theme.fg("accent", args.review.reviewer)}`;
				const preview = args.review.task.length > 60 ? `${args.review.task.slice(0, 60)}...` : args.review.task;
				text += `\n  ${theme.fg("dim", preview)}`;
				return new Text(text, 0, 0);
			}
			if (args.consensus) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `consensus (${args.consensus.voters ?? 3} voters)`) +
					theme.fg("muted", ` [${scope}]`) +
					`\n  ${theme.fg("accent", args.consensus.agent)}`;
				const preview = args.consensus.task.length > 60 ? `${args.consensus.task.slice(0, 60)}...` : args.consensus.task;
				text += `\n  ${theme.fg("dim", preview)}`;
				return new Text(text, 0, 0);
			}
			if (args.chain && args.chain.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `chain (${args.chain.length} steps)`) +
					theme.fg("muted", ` [${scope}]`);
				for (let i = 0; i < Math.min(args.chain.length, 3); i++) {
					const step = args.chain[i];
					const cleanTask = step.task.replace(/\{previous\}/g, "").trim();
					const preview = cleanTask.length > 40 ? `${cleanTask.slice(0, 40)}...` : cleanTask;
					text +=
						"\n  " +
						theme.fg("muted", `${i + 1}.`) +
						" " +
						theme.fg("accent", step.agent) +
						theme.fg("dim", ` ${preview}`);
				}
				if (args.chain.length > 3) text += `\n  ${theme.fg("muted", `... +${args.chain.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			if (args.tasks && args.tasks.length > 0) {
				let text =
					theme.fg("toolTitle", theme.bold("subagent ")) +
					theme.fg("accent", `parallel (${args.tasks.length} tasks)`) +
					theme.fg("muted", ` [${scope}]`);
				for (const t of args.tasks.slice(0, 3)) {
					const preview = t.task.length > 40 ? `${t.task.slice(0, 40)}...` : t.task;
					text += `\n  ${theme.fg("accent", t.agent)}${theme.fg("dim", ` ${preview}`)}`;
				}
				if (args.tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${args.tasks.length - 3} more`)}`;
				return new Text(text, 0, 0);
			}
			const agentName = args.agent || "...";
			const preview = args.task ? (args.task.length > 60 ? `${args.task.slice(0, 60)}...` : args.task) : "...";
			let text =
				theme.fg("toolTitle", theme.bold("subagent ")) +
				theme.fg("accent", agentName) +
				theme.fg("muted", ` [${scope}]`);
			text += `\n  ${theme.fg("dim", preview)}`;
			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as SubagentDetails | undefined;
			if (!details || details.results.length === 0) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
			}

			const mdTheme = getMarkdownTheme();

			const renderDisplayItems = (items: DisplayItem[], limit?: number) => {
				const toShow = limit ? items.slice(-limit) : items;
				const skipped = limit && items.length > limit ? items.length - limit : 0;
				let text = "";
				if (skipped > 0) text += theme.fg("muted", `... ${skipped} earlier items\n`);
				for (const item of toShow) {
					if (item.type === "text") {
						const preview = expanded ? item.text : item.text.split("\n").slice(0, 3).join("\n");
						text += `${theme.fg("toolOutput", preview)}\n`;
					} else {
						text += `${theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme))}\n`;
					}
				}
				return text.trimEnd();
			};

			if (details.mode === "single" && details.results.length === 1) {
				const r = details.results[0];
				const isError = r.exitCode !== 0 || r.stopReason === "error" || r.stopReason === "aborted";
				const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
				const displayItems = getDisplayItems(r.messages);
				const finalOutput = getFinalOutput(r.messages);

				if (expanded) {
					const container = new Container();
					let header = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
					if (isError && r.stopReason) header += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
					container.addChild(new Text(header, 0, 0));
					if (isError && r.errorMessage)
						container.addChild(new Text(theme.fg("error", `Error: ${r.errorMessage}`), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Task ───"), 0, 0));
					container.addChild(new Text(theme.fg("dim", r.task), 0, 0));
					container.addChild(new Spacer(1));
					container.addChild(new Text(theme.fg("muted", "─── Output ───"), 0, 0));
					if (displayItems.length === 0 && !finalOutput) {
						container.addChild(new Text(theme.fg("muted", "(no output)"), 0, 0));
					} else {
						for (const item of displayItems) {
							if (item.type === "toolCall")
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
						}
						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}
					}
					const usageStr = formatUsageStats(r.usage, r.model);
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", usageStr), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(r.agent))}${theme.fg("muted", ` (${r.agentSource})`)}`;
				if (isError && r.stopReason) text += ` ${theme.fg("error", `[${r.stopReason}]`)}`;
				if (isError && r.errorMessage) text += `\n${theme.fg("error", `Error: ${r.errorMessage}`)}`;
				else if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
				else {
					text += `\n${renderDisplayItems(displayItems, COLLAPSED_ITEM_COUNT)}`;
					if (displayItems.length > COLLAPSED_ITEM_COUNT) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				}
				const usageStr = formatUsageStats(r.usage, r.model);
				if (usageStr) text += `\n${theme.fg("dim", usageStr)}`;
				return new Text(text, 0, 0);
			}

			const aggregateUsage = (results: SingleResult[]) => {
				const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 };
				for (const r of results) {
					total.input += r.usage.input;
					total.output += r.usage.output;
					total.cacheRead += r.usage.cacheRead;
					total.cacheWrite += r.usage.cacheWrite;
					total.cost += r.usage.cost;
					total.turns += r.usage.turns;
				}
				return total;
			};

			if (details.mode === "chain" || details.mode === "review") {
				const successCount = details.results.filter((r) => r.exitCode === 0).length;
				const icon = successCount === details.results.length ? theme.fg("success", "✓") : theme.fg("error", "✗");

				if (expanded) {
					const container = new Container();
					container.addChild(
						new Text(
							icon +
								" " +
								theme.fg("toolTitle", theme.bold(`${details.mode} `)) +
								theme.fg("accent", `${successCount}/${details.results.length} steps`),
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(
								`${theme.fg("muted", `─── Step ${r.step}: `) + theme.fg("accent", r.agent)} ${rIcon}`,
								0,
								0,
							),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const stepUsage = formatUsageStats(r.usage, r.model);
						if (stepUsage) container.addChild(new Text(theme.fg("dim", stepUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text =
					icon +
					" " +
					theme.fg("toolTitle", theme.bold(`${details.mode} `)) +
					theme.fg("accent", `${successCount}/${details.results.length} steps`);
				for (const r of details.results) {
					const rIcon = r.exitCode === 0 ? theme.fg("success", "✓") : theme.fg("error", "✗");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", `─── Step ${r.step}: `)}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0) text += `\n${theme.fg("muted", "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				const usageStr = formatUsageStats(aggregateUsage(details.results));
				if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			if (details.mode === "parallel" || details.mode === "consensus") {
				const running = details.results.filter((r) => r.exitCode === -1).length;
				const successCount = details.results.filter((r) => !isFailedResult(r)).length;
				const failCount = details.results.filter((r) => r.exitCode !== -1 && isFailedResult(r)).length;
				const isRunning = running > 0;
				const icon = isRunning
					? theme.fg("warning", "⏳")
					: failCount > 0
						? theme.fg("warning", "◐")
						: theme.fg("success", "✓");
				const status = isRunning
					? `${successCount + failCount}/${details.results.length} done, ${running} running`
					: `${successCount}/${details.results.length} tasks`;

				if (expanded && !isRunning) {
					const container = new Container();
					container.addChild(
						new Text(
							`${icon} ${theme.fg("toolTitle", theme.bold(`${details.mode} `))}${theme.fg("accent", status)}`,
							0,
							0,
						),
					);

					for (const r of details.results) {
						const rIcon = r.exitCode === -1
							? theme.fg("warning", "⏳")
							: isFailedResult(r)
								? theme.fg("error", "✗")
								: theme.fg("success", "✓");
						const displayItems = getDisplayItems(r.messages);
						const finalOutput = getFinalOutput(r.messages);

						container.addChild(new Spacer(1));
						container.addChild(
							new Text(`${theme.fg("muted", "─── ") + theme.fg("accent", r.agent)} ${rIcon}`, 0, 0),
						);
						container.addChild(new Text(theme.fg("muted", "Task: ") + theme.fg("dim", r.task), 0, 0));

						for (const item of displayItems) {
							if (item.type === "toolCall") {
								container.addChild(
									new Text(
										theme.fg("muted", "→ ") + formatToolCall(item.name, item.args, theme.fg.bind(theme)),
										0,
										0,
									),
								);
							}
						}

						if (finalOutput) {
							container.addChild(new Spacer(1));
							container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
						}

						const taskUsage = formatUsageStats(r.usage, r.model);
						if (taskUsage) container.addChild(new Text(theme.fg("dim", taskUsage), 0, 0));
					}

					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) {
						container.addChild(new Spacer(1));
						container.addChild(new Text(theme.fg("dim", `Total: ${usageStr}`), 0, 0));
					}
					return container;
				}

				let text = `${icon} ${theme.fg("toolTitle", theme.bold(`${details.mode} `))}${theme.fg("accent", status)}`;
				for (const r of details.results) {
					const rIcon =
						r.exitCode === -1
							? theme.fg("warning", "⏳")
							: isFailedResult(r)
								? theme.fg("error", "✗")
								: theme.fg("success", "✓");
					const displayItems = getDisplayItems(r.messages);
					text += `\n\n${theme.fg("muted", "─── ")}${theme.fg("accent", r.agent)} ${rIcon}`;
					if (displayItems.length === 0)
						text += `\n${theme.fg("muted", r.exitCode === -1 ? "(running...)" : "(no output)")}`;
					else text += `\n${renderDisplayItems(displayItems, 5)}`;
				}
				if (!isRunning) {
					const usageStr = formatUsageStats(aggregateUsage(details.results));
					if (usageStr) text += `\n\n${theme.fg("dim", `Total: ${usageStr}`)}`;
				}
				if (!expanded) text += `\n${theme.fg("muted", "(Ctrl+O to expand)")}`;
				return new Text(text, 0, 0);
			}

			const text = result.content[0];
			return new Text(text?.type === "text" ? text.text : "(no output)", 0, 0);
		},
	});
}
