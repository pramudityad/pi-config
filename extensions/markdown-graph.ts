/**
 * Markdown Graph Extension - Renders beautiful Unicode/ANSI graphs in the terminal
 *
 * Provides a `render_graph` tool that takes a simple DSL and produces
 * terminal-native diagrams with box-drawing characters and ANSI colors.
 *
 * Supports:
 * - Flowcharts (process flows, decision trees)
 * - Architecture diagrams (system components, services)
 * - Bar charts (data comparison, metrics)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ─── Types ──────────────────────────────────────────────────────────────

interface Node {
	id: string;
	label: string;
	shape: "rect" | "round" | "diamond" | "cylinder";
}

interface Edge {
	from: string;
	to: string;
	style: "solid" | "bold" | "dashed" | "line";
	label?: string;
}

type DiagramType = "flowchart" | "architecture" | "barchart";

interface ParsedDiagram {
	type: DiagramType;
	title?: string;
	nodes: Node[];
	edges: Edge[];
	bars?: { label: string; value: number }[];
}

interface LayoutNode extends Node {
	x: number;
	y: number;
	width: number;
	height: number;
}

// ─── DSL Parser ─────────────────────────────────────────────────────────

function parseDSL(dsl: string): ParsedDiagram {
	const lines = dsl.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
	if (lines.length === 0) throw new Error("Empty DSL input");

	const firstLine = lines[0].toLowerCase();

	if (firstLine.startsWith("barchart")) {
		const titleMatch = lines[0].match(/barchart\s+"([^"]+)"/i);
		const title = titleMatch ? titleMatch[1] : undefined;
		const bars: { label: string; value: number }[] = [];
		for (let i = 1; i < lines.length; i++) {
			const barMatch = lines[i].match(/^(.+?)\s*[:=]\s*(-?\d+(?:\.\d+)?)$/) || lines[i].match(/^(\S+)\s+(-?\d+(?:\.\d+)?)$/);
			if (barMatch) {
				bars.push({ label: barMatch[1].trim(), value: parseFloat(barMatch[2]) });
			}
		}
		return { type: "barchart", title, nodes: [], edges: [], bars };
	}

	const type: DiagramType = firstLine.startsWith("architecture") ? "architecture" : "flowchart";
	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const nodeMap = new Map<string, Node>();

	const nodeRegex = /(\(\((.+?)\)\)|\{(.+?)\}|\((.+?)\)|\[(.+?)\])/g;
	const edgeRegex = /(==>|-.->|--->|---|-->)/

	function addNode(raw: string): string {
		let label = raw;
		let shape: Node["shape"] = "rect";

		if (raw.startsWith("((") && raw.endsWith("))")) {
			label = raw.slice(2, -2);
			shape = "cylinder";
		} else if (raw.startsWith("{") && raw.endsWith("}")) {
			label = raw.slice(1, -1);
			shape = "diamond";
		} else if (raw.startsWith("(") && raw.endsWith(")")) {
			label = raw.slice(1, -1);
			shape = "round";
		} else if (raw.startsWith("[") && raw.endsWith("]")) {
			label = raw.slice(1, -1);
			shape = "rect";
		}

		const id = label.trim();
		if (!nodeMap.has(id)) {
			const node: Node = { id, label: id, shape };
			nodeMap.set(id, node);
			nodes.push(node);
		}
		return id;
	}

	for (let i = type === "flowchart" || type === "architecture" ? 1 : 0; i < lines.length; i++) {
		const line = lines[i];

		// Find all node references in the line
		const nodeRefs: string[] = [];
		let m: RegExpExecArray | null;
		nodeRegex.lastIndex = 0;
		while ((m = nodeRegex.exec(line)) !== null) {
			const raw = m[0];
			nodeRefs.push(addNode(raw));
		}

		// Find edges between consecutive nodes
		const parts = line.split(edgeRegex).filter(Boolean);
		let refIdx = 0;
		for (let p = 0; p < parts.length; p++) {
			const part = parts[p].trim();
			if (part === "==>" || part === "-.->" || part === "--->" || part === "---" || part === "-->") {
				const from = nodeRefs[refIdx];
				const to = nodeRefs[refIdx + 1];
				if (from && to) {
					// Check for label on the edge (-->|label|)
					let label: string | undefined;
					const nextPart = parts[p + 1]?.trim();
					if (nextPart) {
						const labelMatch = nextPart.match(/^\|(.+?)\|/);
						if (labelMatch) {
							label = labelMatch[1];
							parts[p + 1] = nextPart.slice(labelMatch[0].length);
						}
					}

					let style: Edge["style"] = "solid";
					if (part === "==>") style = "bold";
					else if (part === "-.->") style = "dashed";
					else if (part === "---") style = "line";

					edges.push({ from, to, style, label });
				}
				refIdx++;
			}
		}
	}

	return { type, nodes, edges };
}

// ─── Layout Engine ──────────────────────────────────────────────────────

function layoutNodes(diagram: ParsedDiagram, maxWidth: number): LayoutNode[] {
	const pad = 4;
	const layoutNodes: LayoutNode[] = [];

	// Build adjacency and compute layers via topological sort
	const inDegree = new Map<string, number>();
	const adj = new Map<string, string[]>();

	for (const node of diagram.nodes) {
		inDegree.set(node.id, 0);
		adj.set(node.id, []);
	}

	for (const edge of diagram.edges) {
		adj.get(edge.from)?.push(edge.to);
		inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
	}

	// Assign layers (BFS)
	const layers: string[][] = [];
	const queue: string[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id);
	}

	const visited = new Set<string>();
	while (queue.length > 0) {
		layers.push([...queue]);
		const nextQueue: string[] = [];
		for (const id of queue) {
			visited.add(id);
			for (const child of adj.get(id) || []) {
				if (!visited.has(child)) {
					inDegree.set(child, (inDegree.get(child) || 1) - 1);
					if (inDegree.get(child) === 0) {
						nextQueue.push(child);
					}
				}
			}
		}
		queue.length = 0;
		queue.push(...nextQueue);
	}

	// Handle any nodes not visited (cycles) — put them in last layer
	const unvisited = diagram.nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
	if (unvisited.length > 0) {
		layers.push(unvisited);
	}

	// Position nodes
	const nodeMap = new Map(diagram.nodes.map((n) => [n.id, n]));

	for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
		const layer = layers[layerIdx];
		const layerWidth = layer.length;

		for (let i = 0; i < layer.length; i++) {
			const node = nodeMap.get(layer[i])!;
			const labelLen = node.label.length + pad;
			const nodeWidth = node.shape === "diamond" ? labelLen + 4 : labelLen + 2;
			const nodeHeight = node.shape === "cylinder" ? 3 : node.shape === "diamond" ? 3 : 1;

			// Spread nodes horizontally within layer
			const spacing = Math.min(maxWidth / (layerWidth + 1), 30);
			const x = Math.round(i * spacing + spacing / 2);
			const y = layerIdx * (nodeHeight + 3);

			layoutNodes.push({
				...node,
				x,
				y,
				width: nodeWidth,
				height: nodeHeight,
			});
		}
	}

	return layoutNodes;
}

// ─── Renderers ──────────────────────────────────────────────────────────

const COLORS = {
	rect: "text",
	round: "success",
	diamond: "warning",
	cylinder: "accent",
};

function renderNodeBox(node: LayoutNode, theme: any): string[] {
	const label = node.label;
	const pad = 2;
	const innerWidth = label.length + pad;

	const color = COLORS[node.shape];
	const t = (s: string) => theme.fg(color, s);
	const dim = (s: string) => theme.fg("dim", s);

	switch (node.shape) {
		case "rect": {
			const top = t("╭" + "─".repeat(innerWidth) + "╮");
			const mid = t("│") + " ".repeat(pad / 2) + t(label) + " ".repeat(pad / 2) + t("│");
			const bot = t("╰" + "─".repeat(innerWidth) + "╯");
			return [top, mid, bot];
		}
		case "round": {
			const top = t("╭" + "─".repeat(innerWidth) + "╮");
			const mid = t("│") + " ".repeat(pad / 2) + t(label) + " ".repeat(pad / 2) + t("│");
			const bot = t("╰" + "─".repeat(innerWidth) + "╯");
			return [top, mid, bot];
		}
		case "diamond": {
			const diamondPad = innerWidth;
			const top = " ".repeat(Math.floor(diamondPad / 2) + 1) + t("╱" + "─".repeat(innerWidth) + "╲");
			const mid = t("│") + " ".repeat(pad / 2) + t(label) + " ".repeat(pad / 2) + t("│");
			const bot = " ".repeat(Math.floor(diamondPad / 2) + 1) + t("╲" + "─".repeat(innerWidth) + "╱");
			return [top, mid, bot];
		}
		case "cylinder": {
			const top = t("╭" + "═".repeat(innerWidth) + "╮");
			const mid = t("║") + " ".repeat(pad / 2) + t(label) + " ".repeat(pad / 2) + t("║");
			const bot = t("╰" + "─".repeat(innerWidth) + "╯");
			return [top, mid, bot];
		}
		default: {
			const top = t("╭" + "─".repeat(innerWidth) + "╮");
			const mid = t("│") + " ".repeat(pad / 2) + t(label) + " ".repeat(pad / 2) + t("│");
			const bot = t("╰" + "─".repeat(innerWidth) + "╯");
			return [top, mid, bot];
		}
	}
}

function renderFlowchart(diagram: ParsedDiagram, theme: any, maxWidth: number): string {
	const nodes = layoutNodes(diagram, maxWidth);

	if (nodes.length === 0) {
		return theme.fg("dim", "(empty diagram)");
	}

	// Build a canvas
	const nodeMap = new Map<string, LayoutNode>();
	const nodeBoxes = new Map<string, string[]>();

	let maxX = 0;
	let maxY = 0;

	for (const n of nodes) {
		nodeMap.set(n.id, n);
		const box = renderNodeBox(n, theme);
		nodeBoxes.set(n.id, box);
		const boxWidth = visibleLen(box[0]);
		if (n.x + boxWidth > maxX) maxX = n.x + boxWidth;
		if (n.y + box.length > maxY) maxY = n.y + box.length;
	}

	// Create canvas
	const canvas: string[][] = [];
	for (let y = 0; y <= maxY + 4; y++) {
		canvas.push([]);
	}

	// Place nodes on canvas
	for (const n of nodes) {
		const box = nodeBoxes.get(n.id)!;
		for (let row = 0; row < box.length; row++) {
			if (!canvas[n.y + row]) canvas[n.y + row] = [];
			placeText(canvas, n.x, n.y + row, box[row]);
		}
	}

	// Draw edges
	const dim = (s: string) => theme.fg("dim", s);
	const muted = (s: string) => theme.fg("muted", s);

	for (const edge of diagram.edges) {
		const from = nodeMap.get(edge.from);
		const to = nodeMap.get(edge.to);
		if (!from || !to) continue;

		const fromBox = nodeBoxes.get(edge.from)!;
		const toBox = nodeBoxes.get(edge.to)!;

		// From bottom center of source to top center of target
		const fromX = from.x + Math.floor(visibleLen(fromBox[0]) / 2);
		const fromY = from.y + fromBox.length; // bottom of source
		const toX = to.x + Math.floor(visibleLen(toBox[0]) / 2);
		const toY = to.y; // top of target

		const arrowChar = edge.style === "bold" ? dim("━") : edge.style === "dashed" ? dim("╌") : dim("│");

		// Vertical line from source
		const midY = Math.floor((fromY + toY) / 2);
		for (let y = fromY; y < midY; y++) {
			placeText(canvas, fromX, y, arrowChar);
		}

		// Horizontal connector if different x
		if (fromX !== toX) {
			const hChar = edge.style === "bold" ? dim("━") : edge.style === "dashed" ? dim("╌") : dim("─");
			const minX = Math.min(fromX, toX);
			const maxX = Math.max(fromX, toX);
			for (let x = minX; x <= maxX; x++) {
				placeText(canvas, x, midY, hChar);
			}
			// Vertical line to target
			for (let y = midY; y < toY; y++) {
				placeText(canvas, toX, y, arrowChar);
			}
		} else {
			for (let y = midY; y < toY; y++) {
				placeText(canvas, fromX, y, arrowChar);
			}
		}

		// Arrow head
		placeText(canvas, toX, toY - 1, dim("▼"));

		// Edge label
		if (edge.label) {
			const labelX = Math.floor((fromX + toX) / 2) + 1;
			const labelY = midY;
			placeText(canvas, labelX, labelY, muted(edge.label));
		}
	}

	// Flatten canvas
	return canvas.map((row) => row.join("")).join("\n").trimEnd();
}

function renderBarchart(diagram: ParsedDiagram, theme: any, maxWidth: number): string {
	const bars = diagram.bars || [];
	if (bars.length === 0) return theme.fg("dim", "(no data)");

	const lines: string[] = [];

	// Title
	if (diagram.title) {
		lines.push(theme.fg("accent", diagram.title));
		lines.push("");
	}

	// Calculate bar dimensions
	const maxLabelLen = Math.max(...bars.map((b) => b.label.length));
	const labelPad = maxLabelLen + 2;
	const maxBarWidth = Math.max(10, maxWidth - labelPad - 10);
	const maxVal = Math.max(...bars.map((b) => Math.abs(b.value)));

	const barChars = ["▓", "▒", "░"];
	const success = (s: string) => theme.fg("success", s);
	const accent = (s: string) => theme.fg("accent", s);
	const dim = (s: string) => theme.fg("dim", s);
	const muted = (s: string) => theme.fg("muted", s);

	for (const bar of bars) {
		const ratio = maxVal > 0 ? bar.value / maxVal : 0;
		const barWidth = Math.round(ratio * maxBarWidth);
		const filled = Math.round(barWidth);
		const empty = maxBarWidth - filled;

		const label = bar.label.padEnd(maxLabelLen);
		const barStr = "▓".repeat(Math.max(0, filled)) + dim("░".repeat(Math.max(0, empty)));
		const value = bar.value.toLocaleString();

		lines.push(
			muted(label) + " " + dim("│") + success(barStr) + dim("│") + " " + accent(value),
		);
	}

	return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────

function visibleLen(str: string): number {
	// Strip ANSI escape codes
	// eslint-disable-next-line no-control-regex
	const stripped = str.replace(/\x1b\[[0-9;]*m/g, "");
	return stripped.length;
}

function placeText(canvas: string[][], x: number, y: number, text: string): void {
	while (canvas.length <= y) canvas.push([]);
	const row = canvas[y];
	// Extend row with spaces if needed
	while (row.length < x) row.push(" ");
	// Place each character, skipping ANSI sequences
	let col = x;
	let i = 0;
	while (i < text.length) {
		if (text[i] === "\x1b") {
			// ANSI escape sequence - find the end
			let seq = "\x1b";
			i++;
			while (i < text.length && text[i] !== "m") {
				seq += text[i];
				i++;
			}
			if (i < text.length) {
				seq += text[i];
				i++;
			}
			// Prepend sequence to current position
			if (col < row.length) {
				row[col] = seq + (row[col] || " ");
			} else {
				while (row.length < col) row.push(" ");
				row.push(seq + " ");
			}
		} else {
			while (row.length <= col) row.push(" ");
			row[col] = text[i];
			col++;
			i++;
		}
	}
}

// ─── Main Render Function ───────────────────────────────────────────────

function renderGraph(dsl: string, theme: any, maxWidth: number = 80): string {
	try {
		const diagram = parseDSL(dsl);

		switch (diagram.type) {
			case "barchart":
				return renderBarchart(diagram, theme, maxWidth);
			case "flowchart":
			case "architecture":
				return renderFlowchart(diagram, theme, maxWidth);
			default:
				return theme.fg("error", `Unknown diagram type: ${diagram.type}`);
		}
	} catch (e: any) {
		return theme.fg("error", `Graph render error: ${e.message}`);
	}
}

// ─── Extension ──────────────────────────────────────────────────────────

const RenderGraphParams = Type.Object({
	dsl: Type.String({
		description:
			'Graph DSL. Start with diagram type: "flowchart", "architecture", or \'barchart "Title"\'. Then define nodes and edges.',
	}),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "render_graph",
		label: "Render Graph",
		description:
			"Render a Unicode/ANSI graph diagram from DSL. Supports flowcharts, architecture diagrams, and bar charts. Use the markdown-graph skill for DSL syntax reference.",
		promptSnippet: "Render flowcharts, architecture diagrams, and bar charts as terminal-native Unicode graphs",
		promptGuidelines: [
			"When the user asks to visualize, draw, or diagram something, use render_graph instead of writing plain text",
			"Keep node labels short (8-14 chars) and limit to 8-10 nodes per graph",
			"Use the markdown-graph skill for full DSL syntax reference",
		],
		parameters: RenderGraphParams,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const result = renderGraph(params.dsl, { fg: (_c: string, s: string) => s }, 80);
			return {
				content: [{ type: "text", text: result }],
				details: { dsl: params.dsl, type: params.dsl.trim().split("\n")[0] },
			};
		},

		renderCall(args, theme, _context) {
			const typeLine = args.dsl?.trim().split("\n")[0] || "graph";
			return new Text(
				theme.fg("toolTitle", "render_graph ") + theme.fg("muted", typeLine),
				0,
				0,
			);
		},

		renderResult(result, _options, theme, _context) {
			const text = result.content[0];
			if (text?.type === "text") {
				// Re-render with theme colors for display
				const dsl = result.details?.dsl;
				if (dsl) {
					const rendered = renderGraph(dsl, theme, 80);
					return new Text(rendered, 0, 0);
				}
				return new Text(text.text, 0, 0);
			}
			return new Text(theme.fg("dim", "(no output)"), 0, 0);
		},
	});
}
