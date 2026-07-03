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
