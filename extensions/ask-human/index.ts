/**
 * Ask Human Extension (Factor 7 — contact humans with tool calls)
 *
 * Registers an `ask_human` tool the model can emit mid-run to escalate a
 * question to a person. With a UI it routes to ctx.ui (input / confirm /
 * select) and returns the answer inline. Headless, it persists an auditable
 * pending question to .pi/pending/<id>.json and stops — the separate P0 resume
 * mechanism feeds the answer back.
 *
 * This replaces ad-hoc blocking ctx.ui.confirm() calls with a structured,
 * auditable escalation path that also works outside a live terminal.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { makePendingQuestion, type PendingKind, pendingPath, savePendingQuestion } from "./pending.ts";

const AskHumanParams = Type.Object({
	question: Type.String({ description: "The question to put to the human." }),
	context: Type.Optional(Type.String({ description: "Optional background shown to the human to help them answer." })),
	kind: Type.Optional(
		Type.Union([Type.Literal("input"), Type.Literal("confirm"), Type.Literal("select")], {
			description:
				'How to collect the answer: "input" (free text), "confirm" (yes/no), or "select" (one of `options`). Default "input".',
			default: "input",
		}),
	),
	options: Type.Optional(Type.Array(Type.String(), { description: 'Choices to pick from when kind is "select".' })),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_human",
		label: "Ask Human",
		description: [
			"Escalate a question to a human mid-run and get their answer back.",
			"With a UI, prompts the person directly; headless, records an auditable pending question and pauses for resume.",
			'Use kind "confirm" for yes/no approvals, "select" with options for a fixed choice, otherwise "input" for free text.',
		].join(" "),
		promptSnippet: "Ask a human for input, approval, or a decision when you cannot safely proceed on your own",
		promptGuidelines: [
			"Call ask_human instead of guessing when a decision is the user's to make, a step is irreversible, or requirements are ambiguous.",
			"Keep the question specific and self-contained; put any needed background in `context`.",
		],
		parameters: AskHumanParams,

		async execute(toolCallId, params, _signal, _onUpdate, ctx) {
			const kind = (params.kind ?? "input") as PendingKind;
			const { question, context, options } = params;

			// ── Interactive: route to the UI and return the answer ──────────
			if (ctx.hasUI) {
				const prompt = context ? `${question}\n\n${context}` : question;
				let answer: string | undefined;
				if (kind === "confirm") {
					const ok = await ctx.ui.confirm(question, context ?? "");
					answer = ok ? "yes" : "no";
				} else if (kind === "select") {
					const opts = options && options.length > 0 ? options : ["Yes", "No"];
					answer = await ctx.ui.select(prompt, opts);
				} else {
					answer = await ctx.ui.input(prompt);
				}
				if (answer === undefined) {
					return {
						content: [{ type: "text", text: "No answer provided (the human dismissed the prompt)." }],
						details: { kind, question, answered: false },
						isError: true,
					};
				}
				return {
					content: [{ type: "text", text: answer }],
					details: { kind, question, answer, answered: true },
				};
			}

			// ── Headless: persist an auditable pending question and stop ─────
			const q = makePendingQuestion(toolCallId, question, kind, new Date().toISOString(), { context, options });
			savePendingQuestion(ctx.cwd, q);
			const file = pendingPath(ctx.cwd, toolCallId);
			return {
				content: [
					{
						type: "text",
						text: `Human input required but no UI is available. Recorded a pending question at ${file}. Provide an answer there and resume the run to continue.`,
					},
				],
				details: { kind, question, pending: true, path: file },
				isError: true,
			};
		},

		renderCall(args, theme) {
			return new Text(theme.fg("toolTitle", "ask_human ") + theme.fg("muted", args.question ?? ""), 0, 0);
		},
	});
}
