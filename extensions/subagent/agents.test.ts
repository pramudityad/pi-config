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
