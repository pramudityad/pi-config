# SDK-Based Subagent Orchestrator Implementation Plan

> **For AI:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Replace the CLI-spawn `subagent` extension with an in-process orchestrator built on the pi SDK, adding skill scoping, warm context, file-based scratchpad, review loops, and consensus voting.

**Architecture:** A single `subagent` tool whose `execute()` creates nested `AgentSession` instances via `createAgentSession()`. Sessions live in orchestrator memory for the duration of one workflow (one tool call), enabling warm context and review loops. Pure logic (agent discovery, consensus resolution, scratchpad pathing) is split into testable modules; SDK/session orchestration and TUI rendering stay in the extension entry point.

**Tech Stack:** TypeScript, pi SDK (`@earendil-works/pi-coding-agent`: `createAgentSession`, `SessionManager`, `DefaultResourceLoader`), pi-tui, typebox, `node --test` (native TS).

**Design doc:** `docs/plans/2026-06-09-sdk-subagent-orchestrator-design.md`

---

## File Structure

```
extensions/subagent/
├── index.ts          # Tool registration, mode dispatch, TUI rendering (entry)
├── agents.ts         # Agent discovery + skills: frontmatter parsing  (MODIFY)
├── orchestrator.ts   # SDK session creation, runSingleAgent, warm cache (NEW)
├── scratchpad.ts     # Scratchpad path + lifecycle helpers             (NEW)
├── consensus.ts      # Vote normalization + majority resolution        (NEW)
├── agents.test.ts    # Unit: discovery + skills parsing                (NEW)
├── scratchpad.test.ts# Unit: pathing + lifecycle                       (NEW)
└── consensus.test.ts # Unit: vote resolution                           (NEW)
```

Agent definition files in `agents/*.md` get a new optional `skills:` field.

---

## Import Scope Note

The current `extensions/subagent/*.ts` import `@mariozechner/*`; the installed examples use `@earendil-works/*`. Task 1 (spike) determines which scope resolves at runtime. **Use whichever the spike proves works**, consistently across all new files. The plan below writes `@earendil-works/*` as the default; if the spike shows only `@mariozechner/*` resolves, swap all import lines accordingly.

---

## Phase 0 — De-risk

### Task 1: Spike — nested session inside an extension

**Files:**
- Create: `extensions/subagent/_spike.ts` (throwaway, deleted at end of task)

**Step 1: Write the spike extension**

```typescript
// extensions/subagent/_spike.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "spike",
		label: "Spike",
		description: "Spike test: create a nested session and run one prompt.",
		parameters: Type.Object({}),
		async execute() {
			try {
				const { session } = await createAgentSession({
					tools: ["read"],
					sessionManager: SessionManager.inMemory(),
				});
				let out = "";
				const unsub = session.subscribe((e) => {
					if (e.type === "message_update" && e.assistantMessageEvent.type === "text_delta") {
						out += e.assistantMessageEvent.delta;
					}
				});
				await session.prompt("Reply with exactly: SPIKE_OK");
				unsub();
				session.dispose();
				return { content: [{ type: "text", text: `nested session output: ${out}` }], details: {} };
			} catch (err) {
				return {
					content: [{ type: "text", text: `SPIKE FAILED: ${(err as Error).message}\n${(err as Error).stack}` }],
					details: {},
					isError: true,
				};
			}
		},
	});
}
```

**Step 2: Install the spike extension and run it**

```bash
mkdir -p ~/.pi/agent/extensions/_spike
ln -sf "$(pwd)/extensions/subagent/_spike.ts" ~/.pi/agent/extensions/_spike/index.ts
pi --mode json -p --tools spike "Use the spike tool" 2>&1 | grep -i "spike" | tail -5
```

Expected: output contains `SPIKE_OK` (or at least `nested session output:` with no `SPIKE FAILED`).

**Step 3: Decide path based on result**

- **PASS** → in-process nested sessions work. Continue with the plan as written.
- **FAIL** → record the error in the design doc's "Feasibility Findings" and switch
  to the hybrid fallback: `runSingleAgent` spawns `node <sdk-runner>.ts` per call
  instead of `createAgentSession` in-process. Update Task 3 accordingly (the
  session lifecycle becomes per-process; warm context degrades to "reuse session
  file" rather than "reuse live session"). Stop and report to the user before continuing.

**Step 4: Clean up the spike**

```bash
rm ~/.pi/agent/extensions/_spike/index.ts && rmdir ~/.pi/agent/extensions/_spike
rm extensions/subagent/_spike.ts
```

**Step 5: Commit the decision (doc only)**

```bash
git add docs/plans/2026-06-09-sdk-subagent-orchestrator-design.md
git commit -m "chore: record subagent spike result (in-process sessions verified)"
```

---

## Phase 1 — Agent discovery with skill scoping

### Task 2: Parse `skills:` from agent frontmatter

**Files:**
- Modify: `extensions/subagent/agents.ts`
- Test: `extensions/subagent/agents.test.ts`

**Step 1: Write the failing test**

```typescript
// extensions/subagent/agents.test.ts
import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadAgentsFromDir } from "./agents.ts";

function mkAgentDir(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-test-"));
	for (const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, name), content);
	}
	return dir;
}

test("parses skills field into array", () => {
	const dir = mkAgentDir({
		"db.md": "---\nname: db\ndescription: d\ntools: read, bash\nskills: pgcli, ecc-backend-patterns\n---\nbody",
	});
	const agents = loadAgentsFromDir(dir, "user");
	assert.equal(agents.length, 1);
	assert.deepEqual(agents[0].skills, ["pgcli", "ecc-backend-patterns"]);
	fs.rmSync(dir, { recursive: true, force: true });
});

test("missing skills field yields undefined (no skills)", () => {
	const dir = mkAgentDir({
		"plain.md": "---\nname: plain\ndescription: d\ntools: read\n---\nbody",
	});
	const agents = loadAgentsFromDir(dir, "user");
	assert.equal(agents[0].skills, undefined);
	fs.rmSync(dir, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test extensions/subagent/agents.test.ts`
Expected: FAIL — `loadAgentsFromDir` is not exported and `skills` does not exist.

**Step 3: Implement — export `loadAgentsFromDir`, add `skills` field**

In `extensions/subagent/agents.ts`, add `skills?: string[]` to `AgentConfig`:

```typescript
export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	skills?: string[];
	model?: string;
	systemPrompt: string;
	source: "user" | "project";
	filePath: string;
}
```

Change `function loadAgentsFromDir` to `export function loadAgentsFromDir`, and inside the push, parse skills exactly like tools:

```typescript
const skills = frontmatter.skills
	?.split(",")
	.map((s: string) => s.trim())
	.filter(Boolean);

agents.push({
	name: frontmatter.name,
	description: frontmatter.description,
	tools: tools && tools.length > 0 ? tools : undefined,
	skills: skills && skills.length > 0 ? skills : undefined,
	model: frontmatter.model,
	systemPrompt: body,
	source,
	filePath,
});
```

**Step 4: Run test to verify it passes**

Run: `node --test extensions/subagent/agents.test.ts`
Expected: PASS (2 tests).

**Step 5: Commit**

```bash
git add extensions/subagent/agents.ts extensions/subagent/agents.test.ts
git commit -m "feat(subagent): parse skills field from agent frontmatter"
```

---

## Phase 2 — Pure helper modules (scratchpad, consensus)

### Task 3: Scratchpad path + lifecycle helpers

**Files:**
- Create: `extensions/subagent/scratchpad.ts`
- Test: `extensions/subagent/scratchpad.test.ts`

**Step 1: Write the failing test**

```typescript
// extensions/subagent/scratchpad.test.ts
import { test } from "node:test";
import assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createScratchpad, scratchpadNotice, cleanupScratchpad } from "./scratchpad.ts";

test("createScratchpad makes a file under .pi/scratch and returns its path", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scratch-cwd-"));
	const p = createScratchpad(cwd, "wf123");
	assert.ok(p.includes(path.join(".pi", "scratch")));
	assert.ok(p.endsWith("wf123.md"));
	assert.ok(fs.existsSync(p));
	fs.rmSync(cwd, { recursive: true, force: true });
});

test("scratchpadNotice mentions the path and read/append guidance", () => {
	const notice = scratchpadNotice("/tmp/x/wf.md");
	assert.ok(notice.includes("/tmp/x/wf.md"));
	assert.match(notice, /read/i);
	assert.match(notice, /append/i);
});

test("cleanupScratchpad removes the file unless keep=true", () => {
	const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scratch-cwd-"));
	const p = createScratchpad(cwd, "wf");
	cleanupScratchpad(p, false);
	assert.ok(!fs.existsSync(p));
	const p2 = createScratchpad(cwd, "wf2");
	cleanupScratchpad(p2, true);
	assert.ok(fs.existsSync(p2));
	fs.rmSync(cwd, { recursive: true, force: true });
});
```

**Step 2: Run test to verify it fails**

Run: `node --test extensions/subagent/scratchpad.test.ts`
Expected: FAIL — module `./scratchpad.ts` not found.

**Step 3: Implement**

```typescript
// extensions/subagent/scratchpad.ts
import * as fs from "node:fs";
import * as path from "node:path";

export function createScratchpad(cwd: string, workflowId: string): string {
	const dir = path.join(cwd, ".pi", "scratch");
	fs.mkdirSync(dir, { recursive: true });
	const filePath = path.join(dir, `${workflowId}.md`);
	if (!fs.existsSync(filePath)) {
		fs.writeFileSync(
			filePath,
			`# Shared workflow scratchpad (${workflowId})\n\nAgents append findings below.\n\n`,
			{ encoding: "utf-8" },
		);
	}
	return filePath;
}

export function scratchpadNotice(filePath: string): string {
	return [
		`\n\nShared notes for this workflow: ${filePath}`,
		"Read it for context from other agents, and append your own findings as you work.",
	].join(" ");
}

export function cleanupScratchpad(filePath: string, keep: boolean): void {
	if (keep) return;
	try {
		fs.unlinkSync(filePath);
	} catch {
		/* ignore */
	}
}

export function newWorkflowId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
```

**Step 4: Run test to verify it passes**

Run: `node --test extensions/subagent/scratchpad.test.ts`
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add extensions/subagent/scratchpad.ts extensions/subagent/scratchpad.test.ts
git commit -m "feat(subagent): file-based scratchpad helpers"
```

---

### Task 4: Consensus vote resolution

**Files:**
- Create: `extensions/subagent/consensus.ts`
- Test: `extensions/subagent/consensus.test.ts`

**Step 1: Write the failing test**

```typescript
// extensions/subagent/consensus.test.ts
import { test } from "node:test";
import assert from "node:assert";
import { resolveConsensus } from "./consensus.ts";

test("unanimous agreement returns the answer with agreed status", () => {
	const r = resolveConsensus(["42", "42", "42"]);
	assert.equal(r.status, "agreed");
	assert.equal(r.answer, "42");
});

test("majority (2 of 3) returns majority with dissenters", () => {
	const r = resolveConsensus(["42", "42", "7"]);
	assert.equal(r.status, "majority");
	assert.equal(r.answer, "42");
	assert.deepEqual(r.dissenters, ["7"]);
});

test("all different returns tie with all answers", () => {
	const r = resolveConsensus(["a", "b", "c"]);
	assert.equal(r.status, "tie");
	assert.deepEqual(r.all, ["a", "b", "c"]);
});

test("normalizes whitespace and case for comparison", () => {
	const r = resolveConsensus([" Yes ", "yes", "YES"]);
	assert.equal(r.status, "agreed");
});
```

**Step 2: Run test to verify it fails**

Run: `node --test extensions/subagent/consensus.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement**

```typescript
// extensions/subagent/consensus.ts
export type ConsensusResult =
	| { status: "agreed"; answer: string; all: string[] }
	| { status: "majority"; answer: string; dissenters: string[]; all: string[] }
	| { status: "tie"; all: string[] };

function normalize(s: string): string {
	return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveConsensus(answers: string[]): ConsensusResult {
	const counts = new Map<string, { count: number; raw: string }>();
	for (const a of answers) {
		const key = normalize(a);
		const existing = counts.get(key);
		if (existing) existing.count++;
		else counts.set(key, { count: 1, raw: a.trim() });
	}

	const sorted = [...counts.entries()].sort((x, y) => y[1].count - x[1].count);
	const top = sorted[0];
	const topCount = top[1].count;
	const tiedAtTop = sorted.filter(([, v]) => v.count === topCount);

	if (tiedAtTop.length > 1 && topCount === 1) {
		return { status: "tie", all: answers.map((a) => a.trim()) };
	}
	if (topCount === answers.length) {
		return { status: "agreed", answer: top[1].raw, all: answers.map((a) => a.trim()) };
	}
	const dissenters = sorted.slice(1).map(([, v]) => v.raw);
	return { status: "majority", answer: top[1].raw, dissenters, all: answers.map((a) => a.trim()) };
}
```

**Step 4: Run test to verify it passes**

Run: `node --test extensions/subagent/consensus.test.ts`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add extensions/subagent/consensus.ts extensions/subagent/consensus.test.ts
git commit -m "feat(subagent): consensus vote resolution"
```

---

## Phase 3 — SDK orchestrator core

### Task 5: `runSingleAgent` via SDK (replace spawn) + skill scoping + warm cache

**Files:**
- Create: `extensions/subagent/orchestrator.ts`

This module owns session creation. It exposes one entry, `runSingleAgent`, plus a
`SessionCache` for warm context. No unit test (requires live model); validated by
Task 9 integration.

**Step 1: Implement the orchestrator**

```typescript
// extensions/subagent/orchestrator.ts
import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	ModelRegistry,
	SessionManager,
	type Skill,
} from "@earendil-works/pi-coding-agent";
import type { Message, Model } from "@earendil-works/pi-ai";
import type { AgentConfig } from "./agents.ts";

// Resolve an agent's model string. Handles both "provider/id"
// (e.g. "github-copilot/gpt-5.3-codex") and bare custom ids from models.json
// (e.g. "glm-5.1"). Returns undefined to fall back to session default.
const modelRegistry = ModelRegistry.create(AuthStorage.create());
function resolveModel(modelStr?: string): Model | undefined {
	if (!modelStr) return undefined;
	const slash = modelStr.indexOf("/");
	if (slash > 0) {
		const found = modelRegistry.find(modelStr.slice(0, slash), modelStr.slice(slash + 1));
		if (found) return found;
	}
	// Bare id: search all available models for a matching id.
	return undefined; // resolved async in create(); see note below
}

export interface RunResult {
	messages: Message[];
	usage: { input: number; output: number; cacheRead: number; cacheWrite: number; cost: number; contextTokens: number; turns: number };
	model?: string;
	stopReason?: string;
	errorMessage?: string;
	error?: string;
}

export interface RunOptions {
	cwd: string;
	scratchpadPath?: string;
	signal?: AbortSignal;
	onUpdate?: (messages: Message[]) => void;
}

// Build a ResourceLoader that exposes ONLY the agent's scoped skills.
async function buildResourceLoader(agent: AgentConfig, cwd: string): Promise<DefaultResourceLoader> {
	const wanted = new Set(agent.skills ?? []);
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: getAgentDir(),
		systemPromptOverride: agent.systemPrompt.trim() ? () => agent.systemPrompt : undefined,
		skillsOverride: (current) => ({
			skills: agent.skills ? current.skills.filter((s: Skill) => wanted.has(s.name)) : [],
			diagnostics: current.diagnostics,
		}),
	});
	await loader.reload();
	return loader;
}

export class SessionCache {
	private cache = new Map<string, Awaited<ReturnType<typeof createAgentSession>>["session"]>();

	async getOrCreate(agent: AgentConfig, opts: RunOptions): Promise<NonNullable<ReturnType<SessionCache["peek"]>>> {
		const existing = this.cache.get(agent.name);
		if (existing) return existing;
		const created = await this.create(agent, opts);
		this.cache.set(agent.name, created);
		return created;
	}

	peek(name: string) {
		return this.cache.get(name);
	}

	private async create(agent: AgentConfig, opts: RunOptions) {
		const resourceLoader = await buildResourceLoader(agent, opts.cwd);
		let model = resolveModel(agent.model);
		if (!model && agent.model) {
			// Bare id (custom model): match against available models by id.
			const available = await modelRegistry.getAvailable();
			model = available.find((m) => m.id === agent.model);
		}
		const { session } = await createAgentSession({
			cwd: opts.cwd,
			model,
			tools: agent.tools && agent.tools.length > 0 ? agent.tools : undefined,
			resourceLoader,
			sessionManager: SessionManager.inMemory(opts.cwd),
		});
		return session;
	}

	disposeAll() {
		for (const s of this.cache.values()) s.dispose();
		this.cache.clear();
	}
}

function accumulate(session: { messages: Message[] }): RunResult {
	const result: RunResult = {
		messages: session.messages,
		usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
	};
	for (const msg of session.messages) {
		if (msg.role !== "assistant") continue;
		result.usage.turns++;
		const u = msg.usage;
		if (u) {
			result.usage.input += u.input || 0;
			result.usage.output += u.output || 0;
			result.usage.cacheRead += u.cacheRead || 0;
			result.usage.cacheWrite += u.cacheWrite || 0;
			result.usage.cost += u.cost?.total || 0;
			result.usage.contextTokens = u.totalTokens || 0;
		}
		if (!result.model && msg.model) result.model = msg.model;
		if (msg.stopReason) result.stopReason = msg.stopReason;
		if (msg.errorMessage) result.errorMessage = msg.errorMessage;
	}
	return result;
}

// Run one task. If `cache` is provided, reuse/keep the agent's session warm.
export async function runSingleAgent(
	agent: AgentConfig,
	task: string,
	opts: RunOptions,
	cache?: SessionCache,
): Promise<RunResult> {
	const ownsSession = !cache;
	let session: Awaited<ReturnType<typeof createAgentSession>>["session"];
	const localCache = cache ?? new SessionCache();
	try {
		session = await localCache.getOrCreate(agent, opts);
	} catch (err) {
		return {
			messages: [],
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
			error: (err as Error).message,
			stopReason: "error",
		};
	}

	const unsub = opts.onUpdate ? session.subscribe(() => opts.onUpdate!(session.messages)) : () => {};

	const fullTask = opts.scratchpadPath ? `Task: ${task}` : `Task: ${task}`;

	try {
		await session.prompt(fullTask);
		return accumulate(session);
	} catch (err) {
		const r = accumulate(session);
		r.error = (err as Error).message;
		r.stopReason = r.stopReason ?? "error";
		return r;
	} finally {
		unsub();
		if (ownsSession) localCache.disposeAll();
	}
}

export function finalText(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role === "assistant") {
			for (const p of m.content) if (p.type === "text") return p.text;
		}
	}
	return "";
}
```

> Note: the scratchpad notice is appended to the task by the caller (Task 6),
> not here, so single-mode without scratchpad stays clean. The `fullTask`
> branch is intentionally identical pending Task 6 wiring; the scratchpad
> notice is concatenated by callers before invoking `runSingleAgent`.

**Step 2: Type-check by importing in a scratch run**

Run: `pi --tools read -p "noop" >/dev/null 2>&1; node --check extensions/subagent/orchestrator.ts 2>&1 | tail -3` (syntax check; full type validation happens when pi loads it in Task 6).
Expected: no syntax errors.

**Step 3: Commit**

```bash
git add extensions/subagent/orchestrator.ts
git commit -m "feat(subagent): SDK-based runSingleAgent with skill scoping and warm cache"
```

---

### Task 6: Rewrite `index.ts` — single/parallel/chain over the SDK orchestrator

**Files:**
- Modify: `extensions/subagent/index.ts`

Replace the `spawn`-based `runSingleAgent` and its callers with the orchestrator.
Keep the existing `SubagentParams` schema, `renderCall`, and `renderResult`
(they operate on `messages`, which the orchestrator still produces). Add
`scratchpad`/`keepScratch` params.

**Step 1: Update the params schema**

In `SubagentParams` (Type.Object), add:

```typescript
scratchpad: Type.Optional(Type.Boolean({ description: "Enable a shared file-based scratchpad for this workflow.", default: false })),
keepScratch: Type.Optional(Type.Boolean({ description: "Keep the scratchpad file after the run (debug). Default false.", default: false })),
```

**Step 2: Replace imports and the spawn runner**

Remove the `node:child_process` import and the entire `spawn`-based
`runSingleAgent` / `getPiInvocation` / `writePromptToTempFile` block. Add:

```typescript
import { SessionCache, runSingleAgent as runAgent, finalText } from "./orchestrator.ts";
import { createScratchpad, scratchpadNotice, cleanupScratchpad, newWorkflowId } from "./scratchpad.ts";
```

**Step 3: Adapt single mode**

Inside `execute`, single mode becomes:

```typescript
if (params.agent && params.task) {
	const agent = agents.find((a) => a.name === params.agent);
	if (!agent) {
		return {
			content: [{ type: "text", text: `Unknown agent: "${params.agent}". Available: ${agents.map((a) => a.name).join(", ") || "none"}` }],
			details: makeDetails("single")([]),
			isError: true,
		};
	}
	let scratchPath: string | undefined;
	if (params.scratchpad) scratchPath = createScratchpad(ctx.cwd, newWorkflowId());
	const taskText = scratchPath ? params.task + scratchpadNotice(scratchPath) : params.task;
	const r = await runAgent(agent, taskText, {
		cwd: params.cwd ?? ctx.cwd,
		scratchpadPath: scratchPath,
		signal,
		onUpdate: onUpdate ? (msgs) => onUpdate({ content: [{ type: "text", text: finalText(msgs) || "(running...)" }], details: makeDetails("single")([toSingleResult(agent, params.task!, r0(msgs))]) }) : undefined,
	});
	if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
	const sr = toSingleResult(agent, params.task, r);
	const isError = isFailedResult(sr);
	return {
		content: [{ type: "text", text: isError ? (sr.errorMessage || "(failed)") : (finalText(r.messages) || "(no output)") }],
		details: makeDetails("single")([sr]),
		isError,
	};
}
```

Add an adapter that maps `RunResult` → the existing `SingleResult` shape used by
the renderers (keep `SingleResult`/`SubagentDetails` interfaces as-is):

```typescript
function toSingleResult(agent: AgentConfig, task: string, r: RunResult, step?: number): SingleResult {
	return {
		agent: agent.name,
		agentSource: agent.source,
		task,
		exitCode: r.error || r.stopReason === "error" || r.stopReason === "aborted" ? 1 : 0,
		messages: r.messages,
		stderr: r.error ?? "",
		usage: r.usage,
		model: r.model ?? agent.model,
		stopReason: r.stopReason,
		errorMessage: r.errorMessage ?? r.error,
		step,
	};
}
```

> `r0(msgs)` in the onUpdate above is a partial; simplest is to skip streaming
> detail richness for single mode and pass `{ ...r, messages: msgs }`. Replace
> the `onUpdate` line with a helper `streamSingle(agent, task, msgs)` that calls
> `toSingleResult(agent, task, { ...emptyUsage, messages: msgs })`. Define
> `emptyUsage` once at module top.

**Step 4: Adapt chain mode (now warm)**

Chain uses one `SessionCache` for the whole workflow so repeated agents stay warm:

```typescript
if (params.chain && params.chain.length > 0) {
	const cache = new SessionCache();
	const scratchPath = params.scratchpad ? createScratchpad(ctx.cwd, newWorkflowId()) : undefined;
	const results: SingleResult[] = [];
	let previous = "";
	try {
		for (let i = 0; i < params.chain.length; i++) {
			const step = params.chain[i];
			const agent = agents.find((a) => a.name === step.agent);
			if (!agent) { /* push error SingleResult, return isError (same shape as single's unknown-agent) */ }
			let task = step.task.replace(/\{previous\}/g, previous);
			if (scratchPath) task += scratchpadNotice(scratchPath);
			const r = await runAgent(agent!, task, { cwd: step.cwd ?? ctx.cwd, scratchpadPath: scratchPath, signal,
				onUpdate: onUpdate ? (msgs) => onUpdate({ content: [{ type: "text", text: finalText(msgs) }], details: makeDetails("chain")([...results, toSingleResult(agent!, task, { messages: msgs, usage: emptyUsage() }, i + 1)]) }) : undefined,
			}, cache);
			const sr = toSingleResult(agent!, task, r, i + 1);
			results.push(sr);
			if (isFailedResult(sr)) {
				return { content: [{ type: "text", text: `Chain stopped at step ${i + 1} (${step.agent}): ${sr.errorMessage || "(no output)"}` }], details: makeDetails("chain")(results), isError: true };
			}
			previous = finalText(r.messages);
		}
		return { content: [{ type: "text", text: finalText(results[results.length - 1].messages) || "(no output)" }], details: makeDetails("chain")(results) };
	} finally {
		cache.disposeAll();
		if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
	}
}
```

**Step 5: Adapt parallel mode**

Parallel keeps isolated sessions (no shared cache — each task gets its own).
Reuse the existing `mapWithConcurrencyLimit`. Replace each task body to call
`runAgent(agent, task, { cwd, signal, onUpdate })` (no cache arg), wrap result via
`toSingleResult`. Keep the existing `allResults` placeholder + `emitParallelUpdate`
streaming logic; only the per-task runner call changes.

**Step 6: Load the extension and smoke-test all three modes**

```bash
# ensure the installed extension points at this repo (already symlinked via pi-config)
pi --mode json -p --tools subagent 'Use subagent single mode: agent "scout", task "list 3 files in this repo"' 2>&1 | tail -20
```

Expected: a JSON stream ending with scout's output; no `spawn`/module errors.

**Step 7: Commit**

```bash
git add extensions/subagent/index.ts
git commit -m "feat(subagent): single/parallel/chain over SDK orchestrator (warm chain, scratchpad)"
```

---

## Phase 4 — New modes

### Task 7: Review mode (implementer ↔ reviewer loop)

**Files:**
- Modify: `extensions/subagent/index.ts`

**Step 1: Add params**

```typescript
review: Type.Optional(Type.Object({
	implementer: Type.String({ description: "Agent that implements" }),
	reviewer: Type.String({ description: "Agent that reviews" }),
	task: Type.String({ description: "The task to implement and review" }),
	maxIterations: Type.Optional(Type.Number({ description: "Max impl↔review cycles. Default 3.", default: 3 })),
})),
```

Include `review` in the `modeCount` exclusivity check (`hasReview = Boolean(params.review)`).

**Step 2: Implement the loop**

```typescript
if (params.review) {
	const { implementer, reviewer, task, maxIterations = 3 } = params.review;
	const impl = agents.find((a) => a.name === implementer);
	const rev = agents.find((a) => a.name === reviewer);
	if (!impl || !rev) {
		return { content: [{ type: "text", text: `Unknown agent(s). Available: ${agents.map((a) => a.name).join(", ")}` }], details: makeDetails("chain")([]), isError: true };
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
			if (/^\s*APPROVED\s*$/m.test(verdict)) { approved = true; break; }
			implTask = `Address this review feedback and revise:\n\n${verdict}` + (scratchPath ? scratchpadNotice(scratchPath) : "");
		}
		const summary = approved ? "Review passed." : `Review did not converge within ${maxIterations} iterations.`;
		return { content: [{ type: "text", text: `${summary}\n\n${finalText(results[results.length - 1].messages)}` }], details: makeDetails("chain")(results), isError: !approved };
	} finally {
		cache.disposeAll();
		if (scratchPath) cleanupScratchpad(scratchPath, params.keepScratch ?? false);
	}
}
```

(Review mode renders via the existing `chain` renderer — it produces a `SingleResult[]` with `step` numbers.)

**Step 3: Smoke-test**

```bash
pi --mode json -p --tools subagent 'Use subagent review mode: implementer "worker", reviewer "reviewer", task "write a one-line hello function in /tmp/hello.js", maxIterations 2' 2>&1 | tail -20
```

Expected: at least one impl + one review result; ends with "Review passed." or the non-convergence note.

**Step 4: Commit**

```bash
git add extensions/subagent/index.ts
git commit -m "feat(subagent): review mode (implementer/reviewer loop)"
```

---

### Task 8: Consensus mode

**Files:**
- Modify: `extensions/subagent/index.ts`

**Step 1: Add params**

```typescript
consensus: Type.Optional(Type.Object({
	agent: Type.String({ description: "Agent to run repeatedly" }),
	task: Type.String({ description: "Question to answer" }),
	voters: Type.Optional(Type.Number({ description: "Number of independent runs. Default 3.", default: 3 })),
})),
```

Include in `modeCount` (`hasConsensus = Boolean(params.consensus)`).

**Step 2: Implement**

```typescript
if (params.consensus) {
	const { agent: agentName, task, voters = 3 } = params.consensus;
	const agent = agents.find((a) => a.name === agentName);
	if (!agent) return { content: [{ type: "text", text: `Unknown agent: "${agentName}"` }], details: makeDetails("parallel")([]), isError: true };
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
	return { content: [{ type: "text", text }], details: makeDetails("parallel")(results), isError: verdict.status === "tie" };
}
```

Add import: `import { resolveConsensus } from "./consensus.ts";`

**Step 3: Smoke-test**

```bash
pi --mode json -p --tools subagent 'Use subagent consensus mode: agent "scout", task "How many .md files are directly inside the agents/ directory? Reply with just the number.", voters 3' 2>&1 | tail -15
```

Expected: a "Consensus (...)" line.

**Step 4: Commit**

```bash
git add extensions/subagent/index.ts
git commit -m "feat(subagent): consensus mode (majority voting)"
```

---

## Phase 5 — Migration & rollout

### Task 9: Integration pass over all modes

**Files:** none (verification task)

**Step 1: Run each mode end-to-end with a cheap model**

```bash
for mode in single parallel chain review consensus; do echo "=== $mode ==="; done
# single
pi -p --tools subagent 'subagent single: agent "scout", task "name one file in this repo"'
# parallel
pi -p --tools subagent 'subagent parallel: tasks [{agent:"scout",task:"count agents"},{agent:"scout",task:"count prompts"}]'
# chain (verify warm: second worker step should reference first)
pi -p --tools subagent 'subagent chain: [{agent:"scout",task:"find the design doc"},{agent:"worker",task:"summarize {previous} in one line"}]'
```

Expected: each completes without module/SDK errors. Record any failures and fix
before proceeding.

**Step 2: Run all unit tests**

Run: `node --test extensions/subagent/*.test.ts`
Expected: all pass (agents, scratchpad, consensus).

**Step 3: Commit (if any fixes were made)**

```bash
git add -A && git commit -m "test(subagent): integration pass across all modes"
```

---

### Task 10: Add `skills:` to specialized agents + migrate workflows

**Files:**
- Modify: `agents/ecc-database-reviewer.md`, `agents/ecc-backend-reviewer.md`, `agents/ecc-e2e-runner.md`, `agents/ecc-security-reviewer.md` (add `skills:` lines)
- Modify: `prompts/implement-and-review.md` (use review mode)

**Step 1: Add `skills:` to the agents that need scoped skills**

For each, insert a `skills:` line in frontmatter. Examples:

- `ecc-database-reviewer.md`: `skills: pgcli, ecc-backend-patterns`
- `ecc-backend-reviewer.md`: `skills: ecc-backend-patterns, ecc-api-design`
- `ecc-e2e-runner.md`: `skills: ecc-e2e-testing`
- `ecc-security-reviewer.md`: `skills: ecc-security-review`

Leave `scout`, `planner`, `reviewer`, `worker` without `skills:` (they get none —
keep them lean; they rely on their system prompts).

**Step 2: Rewrite `/implement-and-review` to use review mode**

Replace `prompts/implement-and-review.md` body with:

```markdown
---
description: Worker implements, reviewer reviews in a loop until approved
---
Use the subagent tool in review mode:

- implementer: "worker"
- reviewer: "reviewer"
- task: $@
- maxIterations: 3
- scratchpad: true

Run review mode and report the final outcome.
```

**Step 3: Verify the migrated workflow**

```bash
pi -p '/implement-and-review add a comment to the top of README.md saying "managed by pi-config"'
```

Expected: review mode runs, worker edits, reviewer approves, command reports success.

**Step 4: Commit**

```bash
git add agents/*.md prompts/implement-and-review.md
git commit -m "feat(subagent): scope skills on ecc agents; migrate implement-and-review to review mode"
```

---

### Task 11: Update extension README + ensure `.pi/scratch` is ignored

**Files:**
- Modify: `extensions/subagent/README.md` (if present) or create a short one
- Modify: `.gitignore`

**Step 1: Ignore scratchpad output**

Append to `.gitignore`:

```
.pi/scratch/
```

**Step 2: Document the new modes**

Add a "Modes" section to `extensions/subagent/README.md` covering `review` and
`consensus` params, the `skills:` frontmatter field, and `scratchpad`/`keepScratch`.
(Content mirrors the design doc's Tool Interface + Mechanisms sections.)

**Step 3: Commit**

```bash
git add .gitignore extensions/subagent/README.md
git commit -m "docs(subagent): document new modes; ignore scratch output"
```

---

## Self-Review Notes

- **Spec coverage:** Replace (Tasks 5-6) ✓; bidirectional review loop (Task 7) ✓;
  shared scratchpad (Task 3, wired in 6-8) ✓; skill scoping (Tasks 2, 5, 10) ✓;
  built-in tool restriction (preserved via `tools` frontmatter → Task 5) ✓; warm
  context (Task 5 `SessionCache`, used in chain/review) ✓; consensus majority+tie
  (Tasks 4, 8) ✓; migration of 4 workflows (Task 10; `/implement`, `/scout-and-plan`,
  `/init-agents-md` keep chain semantics automatically — only `/implement-and-review`
  changes file) ✓.
- **Spike gate:** Task 1 must pass (or trigger the documented hybrid fallback)
  before Tasks 5+.
- **Import scope:** resolved by Task 1; apply consistently.
- **Type consistency:** `SingleResult`/`SubagentDetails` kept from current `index.ts`;
  `toSingleResult` adapts `RunResult` → `SingleResult`; renderers unchanged.
```
