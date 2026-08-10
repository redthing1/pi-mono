import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ZDR_SESSION_LIST_DISABLED_MESSAGE } from "../src/core/privacy.ts";
import { listRpcSessions } from "../src/modes/rpc/rpc-sessions.ts";

const roots: string[] = [];

function createRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "pi-rpc-sessions-"));
	roots.push(root);
	return root;
}

function writeSession(directory: string): string {
	const path = join(directory, "2026-08-10T12-00-00-000Z_session-one.jsonl");
	const lines = [
		{
			type: "session",
			version: 3,
			id: "session-one",
			timestamp: "2026-08-10T12:00:00.000Z",
			cwd: directory,
		},
		{
			type: "message",
			id: "user-one",
			parentId: null,
			timestamp: "2026-08-10T12:01:00.000Z",
			message: { role: "user", content: "A concise first prompt", timestamp: 1_786_363_260_000 },
		},
		{
			type: "message",
			id: "assistant-one",
			parentId: "user-one",
			timestamp: "2026-08-10T12:02:00.000Z",
			message: {
				role: "assistant",
				content: [{ type: "text", text: "A response that must not enter catalog metadata" }],
				provider: "test",
				model: "test",
				stopReason: "stop",
				timestamp: 1_786_363_320_000,
			},
		},
	];
	writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
	return path;
}

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("RPC session catalog", () => {
	it("projects metadata without transcript search text under server-only ZDR", async () => {
		const root = createRoot();
		const path = writeSession(root);
		const sessions = await listRpcSessions({
			privacy: { clientZdr: false, remoteZdr: true },
			sessionManager: { getCwd: () => root, getSessionDir: () => root },
		});

		expect(sessions).toEqual([
			{
				id: "session-one",
				path,
				name: undefined,
				created: "2026-08-10T12:00:00.000Z",
				modified: "2026-08-10T12:02:00.000Z",
				messageCount: 2,
				firstMessage: "A concise first prompt",
			},
		]);
		expect(JSON.stringify(sessions)).not.toContain("must not enter catalog");
	});

	it("fails closed under client ZDR", async () => {
		await expect(
			listRpcSessions({
				privacy: { clientZdr: true, remoteZdr: true },
				sessionManager: { getCwd: () => "", getSessionDir: () => "" },
			}),
		).rejects.toThrow(ZDR_SESSION_LIST_DISABLED_MESSAGE);
	});
});
