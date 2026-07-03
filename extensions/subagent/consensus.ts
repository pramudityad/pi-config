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
