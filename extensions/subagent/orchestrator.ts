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

const modelRegistry = ModelRegistry.create(AuthStorage.create());

function resolveModel(modelStr?: string): Model | undefined {
	if (!modelStr) return undefined;
	const slash = modelStr.indexOf("/");
	if (slash > 0) {
		const found = modelRegistry.find(modelStr.slice(0, slash), modelStr.slice(slash + 1));
		if (found) return found;
	}
	return undefined;
}

async function resolveModelAsync(modelStr?: string): Promise<Model | undefined> {
	let model = resolveModel(modelStr);
	if (!model && modelStr) {
		const available = await modelRegistry.getAvailable();
		model = available.find((m) => m.id === modelStr);
	}
	return model;
}

// Build a ResourceLoader that exposes ONLY the agent's scoped skills.
async function buildResourceLoader(
	agent: AgentConfig,
	cwd: string,
): Promise<DefaultResourceLoader> {
	const wanted = new Set(agent.skills ?? []);
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: getAgentDir(),
		...(agent.systemPrompt.trim()
			? { systemPromptOverride: () => agent.systemPrompt }
			: {}),
		skillsOverride: (current) => ({
			skills: agent.skills ? current.skills.filter((s: Skill) => wanted.has(s.name)) : [],
			diagnostics: current.diagnostics,
		}),
	});
	await loader.reload();
	return loader;
}

export interface RunResult {
	messages: Message[];
	usage: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		cost: number;
		contextTokens: number;
		turns: number;
	};
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
		const model = await resolveModelAsync(agent.model);
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

function accumulate(messages: Message[]): RunResult["usage"] {
	const usage: RunResult["usage"] = {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		cost: 0,
		contextTokens: 0,
		turns: 0,
	};
	for (const msg of messages) {
		if (msg.role !== "assistant") continue;
		usage.turns++;
		const u = msg.usage;
		if (u) {
			usage.input += u.input || 0;
			usage.output += u.output || 0;
			usage.cacheRead += u.cacheRead || 0;
			usage.cacheWrite += u.cacheWrite || 0;
			usage.cost += u.cost?.total || 0;
			usage.contextTokens = u.totalTokens || 0;
		}
	}
	return usage;
}

export async function runSingleAgent(
	agent: AgentConfig,
	task: string,
	opts: RunOptions,
	cache?: SessionCache,
): Promise<RunResult> {
	const ownsSession = !cache;
	const localCache = cache ?? new SessionCache();
	let session: Awaited<ReturnType<typeof createAgentSession>>["session"];
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

	try {
		await session.prompt(task);
		const messages = session.messages;
		return {
			messages,
			usage: accumulate(messages),
			model: messages[messages.length - 1]?.model,
			stopReason: messages[messages.length - 1]?.stopReason,
			errorMessage: messages[messages.length - 1]?.errorMessage,
		};
	} catch (err) {
		const messages = session.messages;
		return {
			messages,
			usage: accumulate(messages),
			error: (err as Error).message,
			stopReason: messages[messages.length - 1]?.stopReason ?? "error",
			model: messages[messages.length - 1]?.model,
			errorMessage: messages[messages.length - 1]?.errorMessage,
		};
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
